//! Comprehensive tests for the module_system module.
//! Tests all public functions: dispatch, drain_events_json, extract_module_state,
//! ModuleError, ModuleEvent, ModuleDef, serialize_action_result.

#[cfg(test)]
mod tests {
    use crate::module_system::{
        dispatch, drain_events_json, ModuleDef, ModuleError, ModuleEvent, ActionResult,
        serialize_action_result,
    };
    use serde_json::{Value, Map, json};
    use wasm_bindgen_test::*;

    // ─── Helpers ─────────────────────────────────────────────────────────────

    fn make_noop_def(name: &'static str) -> ModuleDef {
        ModuleDef::new(name, "0.1.0", "noop", &[], None)
    }

    fn make_echo_def(name: &'static str, state_keys: &'static [&'static str]) -> ModuleDef {
        fn echo_handler(
            _state: &Map<String, Value>,
            action: &str,
            params: &Map<String, Value>,
        ) -> ActionResult {
            match action {
                "echo" => {
                    let mut changes = Map::new();
                    changes.insert("echoed".into(), params.get("value").cloned().unwrap_or(Value::Null));
                    Ok((changes, vec![]))
                }
                "emit" => {
                    let event = ModuleEvent {
                        module: String::new(),
                        name: "test_event".to_string(),
                        data: json!({ "msg": "hello" }),
                    };
                    Ok((Map::new(), vec![event]))
                }
                _ => Err(ModuleError::new("UNKNOWN_ACTION", &format!("Unknown: {}", action))),
            }
        }
        ModuleDef::new(name, "0.1.0", "echo", state_keys, Some(echo_handler))
    }

    // ─── ModuleError ─────────────────────────────────────────────────────────

    #[wasm_bindgen_test]
    fn test_module_error_new() {
        let err = ModuleError::new("CODE", "message");
        assert_eq!(err.code, "CODE");
        assert_eq!(err.message, "message");
        assert!(err.details.is_none());
    }

    #[wasm_bindgen_test]
    fn test_module_error_with_details() {
        let err = ModuleError::with_details("CODE", "msg", json!({ "extra": true }));
        assert!(err.details.is_some());
        assert_eq!(err.details.unwrap()["extra"], true);
    }

    #[wasm_bindgen_test]
    fn test_module_error_display() {
        let err = ModuleError::new("ERR_CODE", "something went wrong");
        let s = format!("{}", err);
        assert!(s.contains("ERR_CODE"));
        assert!(s.contains("something went wrong"));
    }

    #[wasm_bindgen_test]
    fn test_module_error_display_with_details() {
        let err = ModuleError::with_details("CODE", "msg", json!(42));
        let s = format!("{}", err);
        assert!(s.contains("42"));
    }

    // ─── ModuleDef manifest ───────────────────────────────────────────────────

    #[wasm_bindgen_test]
    fn test_module_def_manifest_json() {
        let def = ModuleDef::new(
            "mymod", "1.0.0", "A module",
            &["key_a", "key_b"],
            None,
        );
        let manifest = def.manifest_json();
        assert_eq!(manifest["name"], "mymod");
        assert_eq!(manifest["version"], "1.0.0");
        assert_eq!(manifest["description"], "A module");
        assert_eq!(manifest["state_keys"][0], "key_a");
        assert_eq!(manifest["state_keys"][1], "key_b");
    }

    // ─── dispatch — MODULE_NOT_FOUND ──────────────────────────────────────────

    #[wasm_bindgen_test]
    fn test_dispatch_module_not_found() {
        let defs = vec![make_noop_def("known")];
        let mut state = Map::new();
        let mut events = vec![];
        let result = dispatch(&defs, &mut state, &mut events, "unknown", "action", "{}");
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed["ok"], false);
        assert_eq!(parsed["error"]["code"], "MODULE_NOT_FOUND");
    }

    #[wasm_bindgen_test]
    fn test_dispatch_empty_module_name() {
        let defs = vec![];
        let mut state = Map::new();
        let mut events = vec![];
        let result = dispatch(&defs, &mut state, &mut events, "", "action", "{}");
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed["ok"], false);
    }

    // ─── dispatch — NO_HANDLER ────────────────────────────────────────────────

    #[wasm_bindgen_test]
    fn test_dispatch_no_handler() {
        let defs = vec![make_noop_def("nohandler")];
        let mut state = Map::new();
        let mut events = vec![];
        let result = dispatch(&defs, &mut state, &mut events, "nohandler", "action", "{}");
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed["ok"], false);
        assert_eq!(parsed["error"]["code"], "NO_HANDLER");
    }

    // ─── dispatch — INVALID_PARAMS ────────────────────────────────────────────

    #[wasm_bindgen_test]
    fn test_dispatch_invalid_params_json() {
        let defs = vec![make_echo_def("echo_mod", &["echoed"])];
        let mut state = Map::new();
        let mut events = vec![];
        let result = dispatch(&defs, &mut state, &mut events, "echo_mod", "echo", "NOT_JSON");
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed["ok"], false);
        assert_eq!(parsed["error"]["code"], "INVALID_PARAMS");
    }

    #[wasm_bindgen_test]
    fn test_dispatch_params_not_object() {
        let defs = vec![make_echo_def("echo_mod", &["echoed"])];
        let mut state = Map::new();
        let mut events = vec![];
        // JSON array is not a valid params object
        let result = dispatch(&defs, &mut state, &mut events, "echo_mod", "echo", "[1,2,3]");
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed["ok"], false);
    }

    // ─── dispatch — success ───────────────────────────────────────────────────

    #[wasm_bindgen_test]
    fn test_dispatch_success_merges_state() {
        let defs = vec![make_echo_def("echo_mod", &["echoed"])];
        let mut state = Map::new();
        let mut events = vec![];
        let result = dispatch(&defs, &mut state, &mut events, "echo_mod", "echo", r#"{"value": 99}"#);
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed["ok"], true, "unexpected error: {}", result);
        assert_eq!(state.get("echoed").unwrap(), &Value::Number(99.into()));
    }

    #[wasm_bindgen_test]
    fn test_dispatch_success_accumulates_events() {
        let defs = vec![make_echo_def("echo_mod", &[])];
        let mut state = Map::new();
        let mut events = vec![];
        dispatch(&defs, &mut state, &mut events, "echo_mod", "emit", "{}");
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].name, "test_event");
        assert_eq!(events[0].module, "echo_mod");
    }

    #[wasm_bindgen_test]
    fn test_dispatch_sets_module_name_on_event() {
        let defs = vec![make_echo_def("mymodule", &[])];
        let mut state = Map::new();
        let mut events = vec![];
        dispatch(&defs, &mut state, &mut events, "mymodule", "emit", "{}");
        assert_eq!(events[0].module, "mymodule");
    }

    // ─── dispatch — unknown action (handler returns Err) ──────────────────────

    #[wasm_bindgen_test]
    fn test_dispatch_unknown_action_returns_error() {
        let defs = vec![make_echo_def("echo_mod", &[])];
        let mut state = Map::new();
        let mut events = vec![];
        let result = dispatch(&defs, &mut state, &mut events, "echo_mod", "bogus_action", "{}");
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed["ok"], false);
        assert_eq!(parsed["error"]["code"], "UNKNOWN_ACTION");
    }

    // ─── drain_events_json ────────────────────────────────────────────────────

    #[wasm_bindgen_test]
    fn test_drain_events_json_empties_buffer() {
        let mut events = vec![
            ModuleEvent { module: "m".into(), name: "e".into(), data: json!({}) },
        ];
        let json_str = drain_events_json(&mut events);
        let parsed: Value = serde_json::from_str(&json_str).unwrap();
        assert!(parsed.as_array().unwrap().len() == 1);
        assert!(events.is_empty(), "events buffer should be cleared");
    }

    #[wasm_bindgen_test]
    fn test_drain_events_json_empty_buffer() {
        let mut events: Vec<ModuleEvent> = vec![];
        let json_str = drain_events_json(&mut events);
        assert_eq!(json_str, "[]");
    }

    #[wasm_bindgen_test]
    fn test_drain_events_json_multiple_events() {
        let mut events = vec![
            ModuleEvent { module: "a".into(), name: "ev1".into(), data: json!({"x": 1}) },
            ModuleEvent { module: "b".into(), name: "ev2".into(), data: json!({"y": 2}) },
        ];
        let json_str = drain_events_json(&mut events);
        let parsed: Vec<Value> = serde_json::from_str(&json_str).unwrap();
        assert_eq!(parsed.len(), 2);
        assert!(events.is_empty());
    }

    // ─── serialize_action_result ──────────────────────────────────────────────

    #[wasm_bindgen_test]
    fn test_serialize_action_result_ok() {
        let mut changes = Map::new();
        changes.insert("key".into(), json!("val"));
        let events = vec![ModuleEvent {
            module: "m".into(), name: "e".into(), data: json!({}),
        }];
        let result: ActionResult = Ok((changes, events));
        let json_str = serialize_action_result(&result);
        let parsed: Value = serde_json::from_str(&json_str).unwrap();
        assert_eq!(parsed["ok"], true);
        assert_eq!(parsed["changes"]["key"], "val");
        assert_eq!(parsed["events"].as_array().unwrap().len(), 1);
    }

    #[wasm_bindgen_test]
    fn test_serialize_action_result_err() {
        let result: ActionResult = Err(ModuleError::new("ERR", "bad"));
        let json_str = serialize_action_result(&result);
        let parsed: Value = serde_json::from_str(&json_str).unwrap();
        assert_eq!(parsed["ok"], false);
        assert_eq!(parsed["error"]["code"], "ERR");
        assert_eq!(parsed["error"]["message"], "bad");
    }

    // ─── Multiple dispatches accumulate correctly ─────────────────────────────

    #[wasm_bindgen_test]
    fn test_multiple_dispatches_accumulate_events() {
        let defs = vec![make_echo_def("mod", &[])];
        let mut state = Map::new();
        let mut events = vec![];
        dispatch(&defs, &mut state, &mut events, "mod", "emit", "{}");
        dispatch(&defs, &mut state, &mut events, "mod", "emit", "{}");
        assert_eq!(events.len(), 2);
    }

    #[wasm_bindgen_test]
    fn test_state_isolation_between_modules() {
        fn handler_a(
            _state: &Map<String, Value>,
            _action: &str,
            _params: &Map<String, Value>,
        ) -> ActionResult {
            let mut changes = Map::new();
            changes.insert("key_a".into(), json!("from_a"));
            Ok((changes, vec![]))
        }
        fn handler_b(
            _state: &Map<String, Value>,
            _action: &str,
            _params: &Map<String, Value>,
        ) -> ActionResult {
            let mut changes = Map::new();
            changes.insert("key_b".into(), json!("from_b"));
            Ok((changes, vec![]))
        }
        let defs = vec![
            ModuleDef::new("mod_a", "0.1.0", "", &["key_a"], Some(handler_a)),
            ModuleDef::new("mod_b", "0.1.0", "", &["key_b"], Some(handler_b)),
        ];
        let mut state = Map::new();
        let mut events = vec![];
        dispatch(&defs, &mut state, &mut events, "mod_a", "do", "{}");
        dispatch(&defs, &mut state, &mut events, "mod_b", "do", "{}");
        assert_eq!(state.get("key_a").unwrap(), &json!("from_a"));
        assert_eq!(state.get("key_b").unwrap(), &json!("from_b"));
    }
}
