use crate::module_system::{ModuleDef, ModuleEvent, ActionResult};
use serde_json::{Value, Map};

pub fn module_def() -> ModuleDef {
    ModuleDef::new(
        "text",
        "0.1.0",
        "Text transformation: reverse, ROT13, uppercase, and more",
        &["processed_text"],
        Some(handle_action),
    )
}

fn handle_action(
    _state: &Map<String, Value>,
    action: &str,
    params: &Map<String, Value>,
) -> ActionResult {
    match action {
        "process" => {
            let text = params.get("text").and_then(|v| v.as_str()).unwrap_or("");
            let action_type = params.get("action").and_then(|v| v.as_str()).unwrap_or("reverse");
            let result = process_text(text, action_type);
            let mut changes = Map::new();
            changes.insert("processed_text".into(), Value::String(result.clone()));
            let events = vec![ModuleEvent {
                module: String::new(),
                name: "text_processed".to_string(),
                data: serde_json::json!({
                    "action": action_type,
                    "result_length": result.len(),
                }),
            }];
            Ok((changes, events))
        }
        _ => Err(crate::module_system::ModuleError::new(
            "UNKNOWN_ACTION",
            &format!("Text module: unknown action '{}'", action),
        )),
    }
}

pub fn process_text(text: &str, action: &str) -> String {
    match action {
        "reverse" => text.chars().rev().collect(),
        "rot13" => text.chars().map(|c| match c {
            'a'..='m' | 'A'..='M' => ((c as u8) + 13) as char,
            'n'..='z' | 'N'..='Z' => ((c as u8) - 13) as char,
            _ => c,
        }).collect(),
        "uppercase" => text.to_uppercase(),
        "lowercase" => text.to_lowercase(),
        "word_count" => {
            let count = text.split_whitespace().count();
            format!("Word count: {}", count)
        }
        "char_count" => {
            format!("Character count: {}", text.chars().count())
        }
        _ => format!("Unknown action: {}", action),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    #[wasm_bindgen_test]
    fn test_reverse() {
        assert_eq!(process_text("hello", "reverse"), "olleh");
    }

    #[wasm_bindgen_test]
    fn test_uppercase() {
        assert_eq!(process_text("hello", "uppercase"), "HELLO");
    }

    #[wasm_bindgen_test]
    fn test_rot13() {
        assert_eq!(process_text("abc", "rot13"), "nop");
        assert_eq!(process_text("xyz", "rot13"), "klm");
    }

    #[wasm_bindgen_test]
    fn test_word_count() {
        let result = process_text("hello world rust wasm", "word_count");
        assert_eq!(result, "Word count: 4");
    }

    #[wasm_bindgen_test]
    fn test_char_count() {
        let result = process_text("hello", "char_count");
        assert_eq!(result, "Character count: 5");
    }

    #[wasm_bindgen_test]
    fn test_unknown_action() {
        assert!(process_text("hello", "bogus").contains("Unknown"));
    }

    #[wasm_bindgen_test]
    fn test_dispatch_process() {
        let state = Map::new();
        let params = serde_json::json!({"text": "hello", "action": "reverse"});
        let params_map: Map<String, Value> = serde_json::from_value(params).unwrap();
        let result = handle_action(&state, "process", &params_map);
        assert!(result.is_ok());
        let (changes, events) = result.unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(changes.get("processed_text").and_then(|v| v.as_str()), Some("olleh"));
    }
}
