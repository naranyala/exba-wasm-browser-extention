//! Core module system for feature-complete WASM module abstraction.
//!
//! # Architecture
//!
//! Each module is defined by a static `ModuleDef` that declares:
//! - Metadata (name, version, description)
//! - State keys it manages
//! - An optional action handler for dynamic dispatch
//!
//! The `CoreEngine` stores state as a flat `Map<String, Value>`.
//! Modules receive their owned state slice during action dispatch,
//! and return updated key-value pairs to merge back.
//!
//! # Events
//!
//! Modules can emit events during action handling. Events are
//! accumulated in CoreEngine and drained by JS via `drain_events()`.
//! This enables WASM->JS push communication without callbacks.

use serde_json::{Value, Map};
use serde::{Serialize, Deserialize};

/// Structured error returned by module action handlers.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleError {
    pub code: String,
    pub message: String,
    pub details: Option<Value>,
}

impl ModuleError {
    pub fn new(code: &str, message: &str) -> Self {
        Self {
            code: code.to_string(),
            message: message.to_string(),
            details: None,
        }
    }

    pub fn with_details(code: &str, message: &str, details: Value) -> Self {
        Self {
            code: code.to_string(),
            message: message.to_string(),
            details: Some(details),
        }
    }
}

impl std::fmt::Display for ModuleError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let details_str = self.details.as_ref().map(|v| v.to_string()).unwrap_or_else(|| "null".to_string());
        write!(f, "[{}] {} ({})", self.code, self.message, details_str)
    }
}

/// An event emitted by a module during action handling.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleEvent {
    pub module: String,
    pub name: String,
    pub data: Value,
}

/// Result type for module action handlers.
pub type ActionResult = Result<(Map<String, Value>, Vec<ModuleEvent>), ModuleError>;

/// Function signature for module action handlers.
///
/// # Arguments
/// * `state` - All key-value pairs managed by this module (subset of full engine state)
/// * `action` - Action name string (e.g. "search", "generate", "greet")
/// * `params` - Action parameters as a JSON object
///
/// # Returns
/// * `Ok((state_changes, events))` - Updated state keys + events to emit
/// * `Err(error)` - Structured error
pub type ActionHandler = fn(
    state: &Map<String, Value>,
    action: &str,
    params: &Map<String, Value>,
) -> ActionResult;

/// Static definition of a WASM module.
///
/// To create a new module:
/// 1. Implement `module_def()` in your module file
/// 2. Register it in `modules/mod.rs::all_defs()`
/// 3. Add initial state in `modules/mod.rs::collect_initial_state()`
pub struct ModuleDef {
    pub name: &'static str,
    pub version: &'static str,
    pub description: &'static str,
    pub state_keys: &'static [&'static str],
    pub handle_action: Option<ActionHandler>,
}

impl ModuleDef {
    pub const fn new(
        name: &'static str,
        version: &'static str,
        description: &'static str,
        state_keys: &'static [&'static str],
        handle_action: Option<ActionHandler>,
    ) -> Self {
        Self { name, version, description, state_keys, handle_action }
    }

    pub fn manifest_json(&self) -> Value {
        serde_json::json!({
            "name": self.name,
            "version": self.version,
            "description": self.description,
            "state_keys": self.state_keys,
        })
    }
}

/// Dispatches an action to the appropriate module.
///
/// # Arguments
/// * `defs` - All registered module definitions
/// * `state` - Full engine state (will be modified in-place with changes)
/// * `events` - Event accumulator (will be appended to)
/// * `module_name` - Target module name
/// * `action` - Action name
/// * `params_json` - Action parameters as JSON string
///
/// # Returns
/// JSON string: `{"ok": true, "events": [...]}` or `{"ok": false, "error": {...}}`
pub fn dispatch(
    defs: &[ModuleDef],
    state: &mut Map<String, Value>,
    events: &mut Vec<ModuleEvent>,
    module_name: &str,
    action: &str,
    params_json: &str,
) -> String {
    let def = match defs.iter().find(|d| d.name == module_name) {
        Some(d) => d,
        None => {
            let err = ModuleError::new("MODULE_NOT_FOUND", &format!("No module registered with name '{}'", module_name));
            return serde_json::json!({"ok": false, "error": err}).to_string();
        }
    };

    let handler = match def.handle_action {
        Some(h) => h,
        None => {
            let err = ModuleError::new("NO_HANDLER", &format!("Module '{}' has no action handler", module_name));
            return serde_json::json!({"ok": false, "error": err}).to_string();
        }
    };

    let params: Map<String, Value> = match serde_json::from_str(params_json) {
        Ok(p) => p,
        Err(e) => {
            let err = ModuleError::new("INVALID_PARAMS", &format!("Failed to parse params JSON: {}", e));
            return serde_json::json!({"ok": false, "error": err}).to_string();
        }
    };

    // Extract the module's owned state slice
    let module_state = extract_module_state(state, def.state_keys);

    match handler(&module_state, action, &params) {
        Ok((changes, new_events)) => {
            // Merge state changes
            for (key, value) in changes {
                state.insert(key, value);
            }
            // Accumulate events
            for mut evt in new_events {
                evt.module = module_name.to_string();
                events.push(evt);
            }
            serde_json::json!({"ok": true, "events": events}).to_string()
        }
        Err(err) => {
            serde_json::json!({"ok": false, "error": err}).to_string()
        }
    }
}

/// Drains accumulated events and returns them as a JSON array.
pub fn drain_events_json(events: &mut Vec<ModuleEvent>) -> String {
    let drained: Vec<ModuleEvent> = std::mem::take(events);
    serde_json::to_string(&drained).unwrap_or_else(|_| "[]".to_string())
}

/// Extract only the keys owned by a module from the full state.
fn extract_module_state(full_state: &Map<String, Value>, owned_keys: &[&'static str]) -> Map<String, Value> {
    let mut slice = Map::new();
    for key in owned_keys {
        if let Some(val) = full_state.get(*key) {
            slice.insert(key.to_string(), val.clone());
        }
    }
    slice
}

/// Serialize an `ActionResult` for returning to JS.
pub fn serialize_action_result(result: &ActionResult) -> String {
    match result {
        Ok((changes, events)) => {
            serde_json::json!({
                "ok": true,
                "changes": changes,
                "events": events,
            }).to_string()
        }
        Err(err) => {
            serde_json::json!({
                "ok": false,
                "error": err,
            }).to_string()
        }
    }
}
