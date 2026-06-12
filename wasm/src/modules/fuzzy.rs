use crate::module_system::{ModuleDef, ActionResult};
use serde_json::{Value, Map};

pub fn module_def() -> ModuleDef {
    ModuleDef::new(
        "fuzzy",
        "0.1.0",
        "Subsequence-based fuzzy string matching",
        &["search_query", "filtered_items"],
        Some(handle_action),
    )
}

fn handle_action(
    _state: &Map<String, Value>,
    action: &str,
    params: &Map<String, Value>,
) -> ActionResult {
    match action {
        "match" => {
            let text = params.get("text").and_then(|v| v.as_str()).unwrap_or("");
            let query = params.get("query").and_then(|v| v.as_str()).unwrap_or("");
            let result = fuzzy_match(text, query);
            let mut changes = Map::new();
            changes.insert("fuzzy_match_result".into(), Value::Bool(result));
            Ok((changes, vec![]))
        }
        _ => Err(crate::module_system::ModuleError::new(
            "UNKNOWN_ACTION",
            &format!("Fuzzy module: unknown action '{}'", action),
        )),
    }
}

/// Returns true if `query` is a subsequence of `text` (case-insensitive).
pub fn fuzzy_match(text: &str, query: &str) -> bool {
    let query_lower = query.to_lowercase();
    let text_lower = text.to_lowercase();
    let mut query_chars = query_lower.chars();
    let mut next_char = query_chars.next();

    if next_char.is_none() {
        return true;
    }

    for c in text_lower.chars() {
        if let Some(qc) = next_char {
            if c == qc {
                next_char = query_chars.next();
                if next_char.is_none() {
                    return true;
                }
            }
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    #[wasm_bindgen_test]
    fn test_fuzzy_match_basic() {
        assert!(fuzzy_match("Color Changer", "color"));
        assert!(fuzzy_match("Color Changer", "clrc"));
        assert!(fuzzy_match("Sidebar Monitor", "side"));
        assert!(!fuzzy_match("Sidebar Monitor", "xyz"));
        assert!(fuzzy_match("anything", ""));
    }

    #[wasm_bindgen_test]
    fn test_fuzzy_dispatch() {
        let state = Map::new();
        let params = serde_json::json!({"text": "Color Changer", "query": "color"});
        let params_map: Map<String, Value> = serde_json::from_value(params).unwrap();
        let result = handle_action(&state, "match", &params_map);
        assert!(result.is_ok());
        let (changes, _) = result.unwrap();
        assert_eq!(changes.get("fuzzy_match_result").and_then(|v| v.as_bool()), Some(true));
    }
}
