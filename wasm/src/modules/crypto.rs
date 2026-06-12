use crate::module_system::{ModuleDef, ModuleEvent, ActionResult};
use getrandom::getrandom;
use sha2::{Digest, Sha256};
use serde_json::{Value, Map};

pub fn module_def() -> ModuleDef {
    ModuleDef::new(
        "crypto",
        "0.1.0",
        "Password generation and SHA-256 hashing",
        &["password_result", "hash_result"],
        Some(handle_action),
    )
}

const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ\
                         abcdefghijklmnopqrstuvwxyz\
                         0123456789)(*&^%$#@!~";

fn handle_action(
    _state: &Map<String, Value>,
    action: &str,
    params: &Map<String, Value>,
) -> ActionResult {
    match action {
        "generate_password" => {
            let length = params
                .get("length")
                .and_then(|v| v.as_u64())
                .unwrap_or(16) as usize;
            let pw = generate_password(length);
            let mut changes = Map::new();
            changes.insert("password_result".into(), Value::String(pw));
            let events = vec![ModuleEvent {
                module: String::new(),
                name: "password_generated".to_string(),
                data: serde_json::json!({ "length": length }),
            }];
            Ok((changes, events))
        }
        "calculate_hash" => {
            let input = params
                .get("input")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let hash = calculate_hash(input);
            let mut changes = Map::new();
            changes.insert("hash_result".into(), Value::String(hash));
            Ok((changes, vec![]))
        }
        _ => Err(crate::module_system::ModuleError::new(
            "UNKNOWN_ACTION",
            &format!("Crypto module: unknown action '{}'", action),
        )),
    }
}

pub fn generate_password(length: usize) -> String {
    let mut buf = vec![0u8; length];
    if getrandom(&mut buf).is_ok() {
        buf.iter()
            .map(|&b| CHARSET[b as usize % CHARSET.len()] as char)
            .collect()
    } else {
        String::new()
    }
}

pub fn calculate_hash(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    let result = hasher.finalize();
    hex::encode(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    #[wasm_bindgen_test]
    fn test_password_length() {
        let pw = generate_password(20);
        assert_eq!(pw.len(), 20);
    }

    #[wasm_bindgen_test]
    fn test_password_randomness() {
        let a = generate_password(20);
        let b = generate_password(20);
        assert_ne!(a, b);
    }

    #[wasm_bindgen_test]
    fn test_sha256() {
        let hash = calculate_hash("hello");
        assert_eq!(
            hash,
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        );
    }

    #[wasm_bindgen_test]
    fn test_dispatch_generate_password() {
        let state = Map::new();
        let params = serde_json::json!({"length": 16});
        let params_map: Map<String, Value> = serde_json::from_value(params).unwrap();
        let result = handle_action(&state, "generate_password", &params_map);
        assert!(result.is_ok());
        let (changes, events) = result.unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].name, "password_generated");
        let pw = changes.get("password_result").and_then(|v| v.as_str());
        assert!(pw.is_some_and(|p| p.len() == 16));
    }
}
