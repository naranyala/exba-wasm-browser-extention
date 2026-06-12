pub mod fuzzy;
pub mod menu;
pub mod crypto;
pub mod text;

use crate::module_system::ModuleDef;
use serde_json::{Value, Map};

/// All registered module definitions.
/// Add new modules here when scaffolding.
pub fn all_defs() -> Vec<ModuleDef> {
    vec![
        fuzzy::module_def(),
        menu::module_def(),
        crypto::module_def(),
        text::module_def(),
    ]
}

/// Collect initial state from all modules.
/// Returns a flat key-value map of all module state.
pub fn collect_initial_state() -> Map<String, Value> {
    let mut state = Map::new();

    // Base state shared across modules
    state.insert("count".into(), Value::Number(0.into()));
    state.insert("title".into(), Value::String("Wasm Component".into()));
    state.insert("items".into(), Value::Array(vec![]));
    state.insert("greet_msg".into(), Value::String("Enter your name and greet!".into()));
    state.insert("fib_val".into(), Value::Number(0.into()));
    state.insert("processed_text".into(), Value::String("Result will appear here...".into()));
    state.insert("search_query".into(), Value::String("".into()));
    state.insert("selected_category".into(), Value::String("All".into()));
    state.insert("password_result".into(), Value::String("".into()));
    state.insert("hash_result".into(), Value::String("".into()));

    // Initialize menu filtered items
    state.insert("filtered_items".into(), Value::Array(
        menu::get_all_items().into_iter().map(|i| serde_json::to_value(i).unwrap()).collect()
    ));

    state
}
