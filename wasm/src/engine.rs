use wasm_bindgen::prelude::*;
use web_sys::console;
use serde_json::{Value, Map};
use crate::modules;
use crate::module_system::{self, ModuleDef, ModuleEvent};

/// Core WASM engine — the primary JavaScript-facing API.
///
/// Features:
/// - Dynamic action dispatch: `dispatch_action(module, action, params)`
/// - Event system: `drain_events()` for WASM -> JS push
/// - Module manifests: `get_module_manifests_json()`
/// - Full state sync: `get_state_json()` / `set_state()`
/// - Backward-compatible convenience methods
#[wasm_bindgen]
pub struct CoreEngine {
    defs: Vec<ModuleDef>,
    state: Map<String, Value>,
    events: Vec<ModuleEvent>,
}

/// Returns a JSON string describing all registered modules.
#[wasm_bindgen]
pub fn get_module_manifests_json() -> String {
    let manifests: Vec<Value> = modules::all_defs()
        .iter()
        .map(|d| d.manifest_json())
        .collect();
    serde_json::to_string(&manifests).unwrap_or_default()
}

#[wasm_bindgen]
impl CoreEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(initial_title: &str) -> Self {
        console::log_1(&"[Rust Core] Initializing CoreEngine with dynamic module system".into());

        let defs = modules::all_defs();
        let mut state = modules::collect_initial_state();
        state.insert("title".into(), Value::String(initial_title.to_string()));

        let module_count = defs.len();
        console::log_1(&format!("[Rust Core] {} modules registered", module_count).into());

        Self { defs, state, events: vec![] }
    }

    // ═══════════════════════════════════════════════════════════
    // Dynamic action dispatch (universal API)
    // ═══════════════════════════════════════════════════════════

    /// Dispatch an action to a registered module.
    ///
    /// # Arguments
    /// * `module` - Module name (e.g. "menu", "crypto", "text")
    /// * `action` - Action name (e.g. "search", "generate_password")
    /// * `params` - JSON string of action parameters
    ///
    /// # Returns
    /// JSON: `{"ok": true, "events": [...]}` or `{"ok": false, "error": {...}}`
    pub fn dispatch_action(&mut self, module: &str, action: &str, params: &str) -> String {
        module_system::dispatch(&self.defs, &mut self.state, &mut self.events, module, action, params)
    }

    /// Drain all pending events from modules.
    /// Returns a JSON array of events and clears the event buffer.
    /// Call this after dispatch_action to process emitted events.
    pub fn drain_events(&mut self) -> String {
        module_system::drain_events_json(&mut self.events)
    }

    // ═══════════════════════════════════════════════════════════
    // State sync
    // ═══════════════════════════════════════════════════════════

    /// Get full engine state as JSON.
    pub fn get_state_json(&self) -> String {
        serde_json::to_string(&self.state).unwrap_or_default()
    }

    /// Set full engine state from JSON.
    /// Only updates keys present in the input; leaves others unchanged.
    pub fn set_state(&mut self, state_json: &str) {
        if let Ok(patch) = serde_json::from_str::<Map<String, Value>>(state_json) {
            for (key, value) in patch {
                self.state.insert(key, value);
            }
        }
    }

    /// Get the value of a specific state key.
    pub fn get_state_value(&self, key: &str) -> String {
        self.state
            .get(key)
            .map(|v| v.to_string())
            .unwrap_or_default()
    }

    /// Set a single state value.
    pub fn set_state_value(&mut self, key: &str, value: &str) {
        if let Ok(val) = serde_json::from_str::<Value>(value) {
            self.state.insert(key.to_string(), val);
        } else {
            self.state.insert(key.to_string(), Value::String(value.to_string()));
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Backward-compatible convenience methods
    // (Delegate to internal state or module logic)
    // ═══════════════════════════════════════════════════════════

    pub fn set_search_query(&mut self, query: &str) {
        self.state.insert("search_query".into(), Value::String(query.to_string()));
        self.refresh_filtered_items();
    }

    pub fn set_category(&mut self, category: &str) {
        self.state.insert("selected_category".into(), Value::String(category.to_string()));
        self.refresh_filtered_items();
    }

    pub fn increment(&mut self) {
        let current = self.state.get("count").and_then(|v| v.as_i64()).unwrap_or(0);
        self.state.insert("count".into(), Value::Number((current + 1).into()));
    }

    pub fn decrement(&mut self) {
        let current = self.state.get("count").and_then(|v| v.as_i64()).unwrap_or(0);
        self.state.insert("count".into(), Value::Number((current - 1).into()));
    }

    pub fn add_item(&mut self, item: &str) {
        let trimmed = item.trim().to_string();
        if !trimmed.is_empty() {
            let mut items: Vec<Value> = self.state
                .get("items")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            items.push(Value::String(trimmed));
            self.state.insert("items".into(), Value::Array(items));
        }
    }

    pub fn delete_item(&mut self, index: usize) {
        let mut items: Vec<Value> = self.state
            .get("items")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();
        if index < items.len() {
            items.remove(index);
            self.state.insert("items".into(), Value::Array(items));
        }
    }

    pub fn clear_items(&mut self) {
        self.state.insert("items".into(), Value::Array(vec![]));
    }

    pub fn generate_password(&mut self, length: usize) {
        let pw = modules::crypto::generate_password(length);
        self.state.insert("password_result".into(), Value::String(pw));
    }

    pub fn calculate_hash(&mut self, input: &str) {
        let hash = modules::crypto::calculate_hash(input);
        self.state.insert("hash_result".into(), Value::String(hash));
    }

    pub fn run_text_process(&mut self, text: &str, action: &str) {
        let result = modules::text::process_text(text, action);
        self.state.insert("processed_text".into(), Value::String(result));
    }

    pub fn run_greet(&mut self, name: &str) {
        let trimmed = name.trim();
        let msg = if trimmed.is_empty() {
            "Please enter a valid name.".to_string()
        } else {
            format!("Hello, {}! (Gently greeted by Rust)", trimmed)
        };
        self.state.insert("greet_msg".into(), Value::String(msg));
    }

    pub fn run_fibonacci(&mut self, n: u32) {
        let fib = if n <= 1 {
            n
        } else {
            let mut a = 0;
            let mut b = 1;
            for _ in 2..=n {
                let temp = a + b;
                a = b;
                b = temp;
            }
            b
        };
        self.state.insert("fib_val".into(), Value::Number(fib.into()));
    }

    fn refresh_filtered_items(&mut self) {
        let query = self.state
            .get("search_query")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let category = self.state
            .get("selected_category")
            .and_then(|v| v.as_str())
            .unwrap_or("All");

        let filtered: Vec<Value> = modules::menu::get_all_items()
            .into_iter()
            .filter(|item| {
                if category != "All" && item.tag != category {
                    return false;
                }
                modules::fuzzy::fuzzy_match(&item.title, query)
                    || modules::fuzzy::fuzzy_match(&item.description, query)
                    || modules::fuzzy::fuzzy_match(&item.tag, query)
            })
            .map(|i| serde_json::to_value(i).unwrap())
            .collect();

        self.state.insert("filtered_items".into(), Value::Array(filtered));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    #[wasm_bindgen_test]
    fn test_core_engine_new() {
        let engine = CoreEngine::new("Test");
        assert_eq!(
            engine.state.get("title").and_then(|v| v.as_str()),
            Some("Test")
        );
        assert_eq!(
            engine.state.get("count").and_then(|v| v.as_i64()),
            Some(0)
        );
    }

    #[wasm_bindgen_test]
    fn test_core_engine_state_sync() {
        let mut engine = CoreEngine::new("Test");
        engine.increment();
        engine.increment();
        engine.increment();
        let json = engine.get_state_json();
        assert!(json.contains("\"count\":3"));
    }

    #[wasm_bindgen_test]
    fn test_module_manifests_json() {
        let json = get_module_manifests_json();
        let manifests: Vec<Value> = serde_json::from_str(&json).unwrap();
        assert!(!manifests.is_empty(), "Should have at least one module manifest");
        let names: Vec<&str> = manifests.iter().filter_map(|m| m["name"].as_str()).collect();
        assert!(names.contains(&"fuzzy"));
        assert!(names.contains(&"crypto"));
        assert!(names.contains(&"menu"));
        assert!(names.contains(&"text"));
    }

    #[wasm_bindgen_test]
    fn test_dispatch_action() {
        let mut engine = CoreEngine::new("Test");

        // Dispatch to menu module
        let result = engine.dispatch_action("menu", "search", r#"{"query": "tab"}"#);
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed["ok"], true, "dispatch should succeed: {}", result);

        // State should be updated
        let query = engine.state.get("search_query").and_then(|v| v.as_str());
        assert_eq!(query, Some("tab"));

        // Dispatch to crypto
        let result = engine.dispatch_action("crypto", "generate_password", r#"{"length": 16}"#);
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed["ok"], true, "password gen should succeed: {}", result);
        let pw = engine.state.get("password_result").and_then(|v| v.as_str());
        assert!(pw.is_some_and(|p| p.len() == 16));
    }

    #[wasm_bindgen_test]
    fn test_dispatch_unknown_module() {
        let mut engine = CoreEngine::new("Test");
        let result = engine.dispatch_action("nonexistent", "foo", "{}");
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed["ok"], false);
        assert_eq!(parsed["error"]["code"], "MODULE_NOT_FOUND");
    }

    #[wasm_bindgen_test]
    fn test_set_and_get_state_value() {
        let mut engine = CoreEngine::new("Test");
        engine.set_state_value("custom_key", r#""custom_value""#);
        let val = engine.get_state_value("custom_key");
        assert_eq!(val, r#""custom_value""#);
    }

    #[wasm_bindgen_test]
    fn test_events_drain() {
        let mut engine = CoreEngine::new("Test");

        // Dispatch to text module which emits events
        let _ = engine.dispatch_action("text", "process", r#"{"text": "hello", "action": "reverse"}"#);

        // Drain events
        let events_json = engine.drain_events();
        let events: Vec<Value> = serde_json::from_str(&events_json).unwrap();
        assert!(events.len() > 0, "should have at least one event from text module");

        // Second drain should be empty
        let empty = engine.drain_events();
        assert_eq!(empty, "[]");
    }
}
