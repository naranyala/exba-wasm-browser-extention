//! Comprehensive tests for all individual WASM modules:
//! fuzzy, crypto, text, menu

#[cfg(test)]
mod fuzzy_tests {
    use crate::modules::fuzzy::fuzzy_match;
    use wasm_bindgen_test::*;

    // ─── Basic matching ───────────────────────────────────────────────────────

    #[wasm_bindgen_test]
    fn test_empty_query_always_matches() {
        assert!(fuzzy_match("anything", ""));
        assert!(fuzzy_match("", ""));
        assert!(fuzzy_match("HELLO WORLD", ""));
    }

    #[wasm_bindgen_test]
    fn test_exact_match() {
        assert!(fuzzy_match("hello", "hello"));
    }

    #[wasm_bindgen_test]
    fn test_case_insensitive_matching() {
        assert!(fuzzy_match("Color Changer", "color"));
        assert!(fuzzy_match("Color Changer", "COLOR"));
        assert!(fuzzy_match("Color Changer", "CoLoR"));
    }

    #[wasm_bindgen_test]
    fn test_subsequence_matching() {
        assert!(fuzzy_match("Color Changer", "clrc"));
        assert!(fuzzy_match("Sidebar Monitor", "side"));
        assert!(fuzzy_match("Tab Manager", "tbmgr"));
    }

    #[wasm_bindgen_test]
    fn test_non_matching_query() {
        assert!(!fuzzy_match("Sidebar Monitor", "xyz"));
        assert!(!fuzzy_match("hello", "z"));
        assert!(!fuzzy_match("abc", "abcd")); // query longer than text
    }

    #[wasm_bindgen_test]
    fn test_empty_text_non_empty_query_no_match() {
        assert!(!fuzzy_match("", "a"));
    }

    #[wasm_bindgen_test]
    fn test_single_char_match() {
        assert!(fuzzy_match("apple", "a"));
        assert!(fuzzy_match("apple", "e"));
        assert!(!fuzzy_match("apple", "z"));
    }

    #[wasm_bindgen_test]
    fn test_unicode_text() {
        // Emoji and non-ASCII characters
        assert!(fuzzy_match("héllo", "héllo"));
        assert!(fuzzy_match("café", "caf"));
    }

    #[wasm_bindgen_test]
    fn test_query_matches_in_order_not_reversed() {
        assert!(fuzzy_match("abcdef", "ace"));
        assert!(!fuzzy_match("abcdef", "eca")); // out of order → no match
    }

    #[wasm_bindgen_test]
    fn test_query_spanning_spaces() {
        assert!(fuzzy_match("Tab Manager", "tm")); // t from Tab, m from Manager
        assert!(fuzzy_match("Storage Explorer", "se"));
    }

    // ─── Dispatch via action handler ─────────────────────────────────────────

    #[wasm_bindgen_test]
    fn test_dispatch_match_action_true() {
        use serde_json::{Map, Value};
        use crate::modules::fuzzy;

        let def = fuzzy::module_def();
        let handler = def.handle_action.expect("fuzzy must have a handler");
        let state = Map::new();
        let params: Map<String, Value> = serde_json::from_str(r#"{"text": "Tab Manager", "query": "tab"}"#).unwrap();
        let result = handler(&state, "match", &params);
        let (changes, _) = result.unwrap();
        assert_eq!(changes.get("fuzzy_match_result").and_then(|v| v.as_bool()), Some(true));
    }

    #[wasm_bindgen_test]
    fn test_dispatch_match_action_false() {
        use serde_json::{Map, Value};
        use crate::modules::fuzzy;

        let def = fuzzy::module_def();
        let handler = def.handle_action.unwrap();
        let state = Map::new();
        let params: Map<String, Value> = serde_json::from_str(r#"{"text": "hello", "query": "xyz"}"#).unwrap();
        let result = handler(&state, "match", &params);
        let (changes, _) = result.unwrap();
        assert_eq!(changes.get("fuzzy_match_result").and_then(|v| v.as_bool()), Some(false));
    }

    #[wasm_bindgen_test]
    fn test_dispatch_unknown_action() {
        use serde_json::{Map, Value};
        use crate::modules::fuzzy;

        let handler = fuzzy::module_def().handle_action.unwrap();
        let state = Map::new();
        let params: Map<String, Value> = serde_json::from_value(serde_json::json!({})).unwrap();
        let result = handler(&state, "bogus", &params);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err().code, "UNKNOWN_ACTION");
    }

    #[wasm_bindgen_test]
    fn test_dispatch_match_missing_params_defaults_to_empty() {
        use serde_json::{Map, Value};
        use crate::modules::fuzzy;

        let handler = fuzzy::module_def().handle_action.unwrap();
        let state = Map::new();
        // No "text" or "query" keys → defaults to "" → empty query matches anything
        let params: Map<String, Value> = Map::new();
        let result = handler(&state, "match", &params).unwrap();
        assert_eq!(result.0.get("fuzzy_match_result").and_then(|v| v.as_bool()), Some(true));
    }

    // ─── Manifest ─────────────────────────────────────────────────────────────

    #[wasm_bindgen_test]
    fn test_fuzzy_module_manifest() {
        use crate::modules::fuzzy;
        let def = fuzzy::module_def();
        assert_eq!(def.name, "fuzzy");
        assert!(def.state_keys.contains(&"search_query"));
        assert!(def.state_keys.contains(&"filtered_items"));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod crypto_tests {
    use crate::modules::crypto::{generate_password, calculate_hash};
    use wasm_bindgen_test::*;

    // ─── generate_password ────────────────────────────────────────────────────

    #[wasm_bindgen_test]
    fn test_password_length_exact() {
        for len in [1, 8, 16, 32, 64, 128] {
            let pw = generate_password(len);
            assert_eq!(pw.len(), len, "password length mismatch for len={}", len);
        }
    }

    #[wasm_bindgen_test]
    fn test_password_zero_length() {
        let pw = generate_password(0);
        assert_eq!(pw.len(), 0);
    }

    #[wasm_bindgen_test]
    fn test_password_chars_are_from_charset() {
        let charset = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789)(*&^%$#@!~";
        let pw = generate_password(100);
        for c in pw.chars() {
            assert!(charset.contains(&(c as u8)), "unexpected char '{}' in password", c);
        }
    }

    #[wasm_bindgen_test]
    fn test_passwords_are_different() {
        // Generate several passwords and confirm they're not all identical
        let passwords: Vec<String> = (0..10).map(|_| generate_password(20)).collect();
        let unique: std::collections::HashSet<&str> = passwords.iter().map(|s| s.as_str()).collect();
        assert!(unique.len() > 1, "all generated passwords are identical (extremely unlikely if RNG works)");
    }

    // ─── calculate_hash ───────────────────────────────────────────────────────

    #[wasm_bindgen_test]
    fn test_sha256_known_values() {
        // Known SHA-256 hashes
        assert_eq!(
            calculate_hash("hello"),
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        );
        assert_eq!(
            calculate_hash(""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert_eq!(
            calculate_hash("The quick brown fox jumps over the lazy dog"),
            "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592"
        );
    }

    #[wasm_bindgen_test]
    fn test_sha256_output_is_64_hex_chars() {
        let hash = calculate_hash("test");
        assert_eq!(hash.len(), 64);
        assert!(hash.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[wasm_bindgen_test]
    fn test_sha256_deterministic() {
        let h1 = calculate_hash("same input");
        let h2 = calculate_hash("same input");
        assert_eq!(h1, h2);
    }

    #[wasm_bindgen_test]
    fn test_sha256_different_inputs_different_hash() {
        let h1 = calculate_hash("input_a");
        let h2 = calculate_hash("input_b");
        assert_ne!(h1, h2);
    }

    #[wasm_bindgen_test]
    fn test_sha256_unicode_input() {
        let hash = calculate_hash("héllo wörld");
        assert_eq!(hash.len(), 64);
    }

    // ─── Action handler ───────────────────────────────────────────────────────

    #[wasm_bindgen_test]
    fn test_action_generate_password_success() {
        use serde_json::{Map, Value};
        use crate::modules::crypto;

        let handler = crypto::module_def().handle_action.unwrap();
        let state = Map::new();
        let params: Map<String, Value> = serde_json::from_str(r#"{"length": 24}"#).unwrap();
        let (changes, events) = handler(&state, "generate_password", &params).unwrap();
        let pw = changes.get("password_result").and_then(|v| v.as_str()).unwrap();
        assert_eq!(pw.len(), 24);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].name, "password_generated");
        assert_eq!(events[0].data["length"], 24);
    }

    #[wasm_bindgen_test]
    fn test_action_generate_password_default_length() {
        use serde_json::{Map, Value};
        use crate::modules::crypto;

        let handler = crypto::module_def().handle_action.unwrap();
        let state = Map::new();
        let params: Map<String, Value> = Map::new(); // no length provided
        let (changes, _) = handler(&state, "generate_password", &params).unwrap();
        let pw = changes.get("password_result").and_then(|v| v.as_str()).unwrap();
        assert_eq!(pw.len(), 16, "default length should be 16");
    }

    #[wasm_bindgen_test]
    fn test_action_calculate_hash_success() {
        use serde_json::{Map, Value};
        use crate::modules::crypto;

        let handler = crypto::module_def().handle_action.unwrap();
        let state = Map::new();
        let params: Map<String, Value> = serde_json::from_str(r#"{"input": "hello"}"#).unwrap();
        let (changes, events) = handler(&state, "calculate_hash", &params).unwrap();
        let hash = changes.get("hash_result").and_then(|v| v.as_str()).unwrap();
        assert_eq!(hash, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
        assert!(events.is_empty());
    }

    #[wasm_bindgen_test]
    fn test_action_calculate_hash_missing_input_defaults_to_empty() {
        use serde_json::{Map, Value};
        use crate::modules::crypto;

        let handler = crypto::module_def().handle_action.unwrap();
        let state = Map::new();
        let params: Map<String, Value> = Map::new();
        let (changes, _) = handler(&state, "calculate_hash", &params).unwrap();
        let hash = changes.get("hash_result").and_then(|v| v.as_str()).unwrap();
        assert_eq!(hash, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"); // SHA256("")
    }

    #[wasm_bindgen_test]
    fn test_action_unknown_action_error() {
        use serde_json::{Map, Value};
        use crate::modules::crypto;

        let handler = crypto::module_def().handle_action.unwrap();
        let state = Map::new();
        let params: Map<String, Value> = Map::new();
        let err = handler(&state, "not_a_thing", &params).unwrap_err();
        assert_eq!(err.code, "UNKNOWN_ACTION");
    }

    // ─── Manifest ─────────────────────────────────────────────────────────────

    #[wasm_bindgen_test]
    fn test_crypto_module_manifest() {
        use crate::modules::crypto;
        let def = crypto::module_def();
        assert_eq!(def.name, "crypto");
        assert!(def.state_keys.contains(&"password_result"));
        assert!(def.state_keys.contains(&"hash_result"));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod text_tests {
    use crate::modules::text::process_text;
    use wasm_bindgen_test::*;

    // ─── process_text ─────────────────────────────────────────────────────────

    #[wasm_bindgen_test]
    fn test_reverse_basic() {
        assert_eq!(process_text("hello", "reverse"), "olleh");
    }

    #[wasm_bindgen_test]
    fn test_reverse_empty_string() {
        assert_eq!(process_text("", "reverse"), "");
    }

    #[wasm_bindgen_test]
    fn test_reverse_palindrome() {
        assert_eq!(process_text("racecar", "reverse"), "racecar");
    }

    #[wasm_bindgen_test]
    fn test_reverse_unicode() {
        // Note: reversing by chars, not bytes
        let result = process_text("héllo", "reverse");
        assert_eq!(result, "olléh");
    }

    #[wasm_bindgen_test]
    fn test_rot13_basic() {
        assert_eq!(process_text("abc", "rot13"), "nop");
        assert_eq!(process_text("xyz", "rot13"), "klm");
        assert_eq!(process_text("ABC", "rot13"), "NOP");
        assert_eq!(process_text("XYZ", "rot13"), "KLM");
    }

    #[wasm_bindgen_test]
    fn test_rot13_double_application_identity() {
        let text = "Hello, World!";
        let once  = process_text(text, "rot13");
        let twice = process_text(&once, "rot13");
        assert_eq!(twice, text, "ROT13 applied twice should be identity");
    }

    #[wasm_bindgen_test]
    fn test_rot13_preserves_non_alpha() {
        assert_eq!(process_text("123 !@#", "rot13"), "123 !@#");
    }

    #[wasm_bindgen_test]
    fn test_uppercase_basic() {
        assert_eq!(process_text("hello", "uppercase"), "HELLO");
        assert_eq!(process_text("Hello World", "uppercase"), "HELLO WORLD");
    }

    #[wasm_bindgen_test]
    fn test_uppercase_already_upper() {
        assert_eq!(process_text("HELLO", "uppercase"), "HELLO");
    }

    #[wasm_bindgen_test]
    fn test_uppercase_empty() {
        assert_eq!(process_text("", "uppercase"), "");
    }

    #[wasm_bindgen_test]
    fn test_lowercase_basic() {
        assert_eq!(process_text("HELLO", "lowercase"), "hello");
        assert_eq!(process_text("Hello World", "lowercase"), "hello world");
    }

    #[wasm_bindgen_test]
    fn test_lowercase_already_lower() {
        assert_eq!(process_text("hello", "lowercase"), "hello");
    }

    #[wasm_bindgen_test]
    fn test_word_count_basic() {
        assert_eq!(process_text("hello world rust wasm", "word_count"), "Word count: 4");
    }

    #[wasm_bindgen_test]
    fn test_word_count_single_word() {
        assert_eq!(process_text("hello", "word_count"), "Word count: 1");
    }

    #[wasm_bindgen_test]
    fn test_word_count_empty_string() {
        assert_eq!(process_text("", "word_count"), "Word count: 0");
    }

    #[wasm_bindgen_test]
    fn test_word_count_multiple_spaces() {
        // split_whitespace handles multiple spaces
        assert_eq!(process_text("a   b   c", "word_count"), "Word count: 3");
    }

    #[wasm_bindgen_test]
    fn test_char_count_basic() {
        assert_eq!(process_text("hello", "char_count"), "Character count: 5");
    }

    #[wasm_bindgen_test]
    fn test_char_count_empty() {
        assert_eq!(process_text("", "char_count"), "Character count: 0");
    }

    #[wasm_bindgen_test]
    fn test_char_count_unicode() {
        // "héllo" is 5 chars (h, é, l, l, o)
        assert_eq!(process_text("héllo", "char_count"), "Character count: 5");
    }

    #[wasm_bindgen_test]
    fn test_unknown_action_returns_message() {
        let result = process_text("hello", "bogus_action");
        assert!(result.contains("Unknown"));
        assert!(result.contains("bogus_action"));
    }

    // ─── Action handler ───────────────────────────────────────────────────────

    #[wasm_bindgen_test]
    fn test_text_action_process_success() {
        use serde_json::{Map, Value};
        use crate::modules::text;

        let handler = text::module_def().handle_action.unwrap();
        let state = Map::new();
        let params: Map<String, Value> = serde_json::from_str(r#"{"text": "hello", "action": "reverse"}"#).unwrap();
        let (changes, events) = handler(&state, "process", &params).unwrap();
        assert_eq!(changes.get("processed_text").and_then(|v| v.as_str()), Some("olleh"));
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].name, "text_processed");
        assert_eq!(events[0].data["action"], "reverse");
        assert_eq!(events[0].data["result_length"], 5u64);
    }

    #[wasm_bindgen_test]
    fn test_text_action_default_action_is_reverse() {
        use serde_json::{Map, Value};
        use crate::modules::text;

        let handler = text::module_def().handle_action.unwrap();
        let state = Map::new();
        let params: Map<String, Value> = serde_json::from_str(r#"{"text": "abc"}"#).unwrap();
        let (changes, _) = handler(&state, "process", &params).unwrap();
        assert_eq!(changes.get("processed_text").and_then(|v| v.as_str()), Some("cba"));
    }

    #[wasm_bindgen_test]
    fn test_text_action_missing_text_defaults_to_empty() {
        use serde_json::{Map, Value};
        use crate::modules::text;

        let handler = text::module_def().handle_action.unwrap();
        let state = Map::new();
        let params: Map<String, Value> = serde_json::from_str(r#"{"action": "uppercase"}"#).unwrap();
        let (changes, _) = handler(&state, "process", &params).unwrap();
        assert_eq!(changes.get("processed_text").and_then(|v| v.as_str()), Some(""));
    }

    #[wasm_bindgen_test]
    fn test_text_action_unknown_action_returns_error() {
        use serde_json::{Map, Value};
        use crate::modules::text;

        let handler = text::module_def().handle_action.unwrap();
        let state = Map::new();
        let params: Map<String, Value> = Map::new();
        let err = handler(&state, "unknown_action", &params).unwrap_err();
        assert_eq!(err.code, "UNKNOWN_ACTION");
    }

    // ─── Manifest ─────────────────────────────────────────────────────────────

    #[wasm_bindgen_test]
    fn test_text_module_manifest() {
        use crate::modules::text;
        let def = text::module_def();
        assert_eq!(def.name, "text");
        assert!(def.state_keys.contains(&"processed_text"));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod menu_tests {
    use crate::modules::menu::{get_all_items, module_def};
    use wasm_bindgen_test::*;
    use serde_json::{Map, Value};

    // ─── get_all_items ────────────────────────────────────────────────────────

    #[wasm_bindgen_test]
    fn test_get_all_items_count() {
        let items = get_all_items();
        assert_eq!(items.len(), 12, "expected exactly 12 menu items");
    }

    #[wasm_bindgen_test]
    fn test_all_items_have_non_empty_fields() {
        let items = get_all_items();
        for item in items {
            assert!(!item.title.is_empty(), "item has empty title");
            assert!(!item.description.is_empty(), "item has empty description");
            assert!(!item.tag.is_empty(), "item has empty tag");
            assert!(!item.action_id.is_empty(), "item has empty action_id");
            assert!(!item.icon_svg.is_empty(), "item has empty icon_svg");
        }
    }

    #[wasm_bindgen_test]
    fn test_items_have_valid_tags() {
        let valid_tags = ["Browser API", "Component Examples", "Component Integration"];
        let items = get_all_items();
        for item in items {
            assert!(
                valid_tags.contains(&item.tag.as_str()),
                "unexpected tag '{}' on item '{}'", item.tag, item.title
            );
        }
    }

    #[wasm_bindgen_test]
    fn test_action_ids_are_unique() {
        let items = get_all_items();
        let mut ids = std::collections::HashSet::new();
        for item in items {
            assert!(ids.insert(item.action_id.clone()), "duplicate action_id: {}", item.action_id);
        }
    }

    #[wasm_bindgen_test]
    fn test_specific_items_exist() {
        let items = get_all_items();
        let titles: Vec<&str> = items.iter().map(|i| i.title.as_str()).collect();
        assert!(titles.contains(&"Tab Manager"));
        assert!(titles.contains(&"Storage Explorer"));
        assert!(titles.contains(&"Accordion"));
        assert!(titles.contains(&"Leaflet Map"));
    }

    // ─── search action ────────────────────────────────────────────────────────

    fn make_menu_state() -> Map<String, Value> {
        let mut state = Map::new();
        state.insert("search_query".into(), Value::String("".into()));
        state.insert("selected_category".into(), Value::String("All".into()));
        state
    }

    fn call_handler(action: &str, params: &str) -> (Map<String, Value>, Vec<crate::module_system::ModuleEvent>) {
        let def = module_def();
        let handler = def.handle_action.unwrap();
        let state = make_menu_state();
        let params_map: Map<String, Value> = serde_json::from_str(params).unwrap();
        handler(&state, action, &params_map).unwrap()
    }

    #[wasm_bindgen_test]
    fn test_search_empty_query_returns_all_items() {
        let (changes, events) = call_handler("search", r#"{"query": ""}"#);
        let items = changes.get("filtered_items").and_then(|v| v.as_array()).unwrap();
        assert_eq!(items.len(), 12);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].name, "filtered");
        assert_eq!(events[0].data["count"], 12u64);
    }

    #[wasm_bindgen_test]
    fn test_search_by_title_fuzzy() {
        let (changes, _) = call_handler("search", r#"{"query": "tab"}"#);
        let items = changes.get("filtered_items").and_then(|v| v.as_array()).unwrap();
        assert!(items.len() > 0, "should find items matching 'tab'");
        // Verify "Tab Manager" is among results
        let has_tab = items.iter().any(|v| v["title"].as_str() == Some("Tab Manager"));
        assert!(has_tab, "Tab Manager should match 'tab' query");
    }

    #[wasm_bindgen_test]
    fn test_search_by_description_fuzzy() {
        let (changes, _) = call_handler("search", r#"{"query": "bookmark"}"#);
        let items = changes.get("filtered_items").and_then(|v| v.as_array()).unwrap();
        let has_bookmarks = items.iter().any(|v| v["title"].as_str() == Some("Bookmarks Explorer"));
        assert!(has_bookmarks);
    }

    #[wasm_bindgen_test]
    fn test_search_query_no_match_returns_empty() {
        let (changes, events) = call_handler("search", r#"{"query": "zzzzzzz_no_match"}"#);
        let items = changes.get("filtered_items").and_then(|v| v.as_array()).unwrap();
        assert_eq!(items.len(), 0, "should return 0 items for non-matching query");
        assert_eq!(events[0].data["count"], 0u64);
    }

    #[wasm_bindgen_test]
    fn test_filter_by_category_browser_api() {
        let (changes, _) = call_handler("search", r#"{"query": "", "category": "Browser API"}"#);
        let items = changes.get("filtered_items").and_then(|v| v.as_array()).unwrap();
        for item in items {
            assert_eq!(item["tag"].as_str(), Some("Browser API"),
                "item '{}' should be Browser API", item["title"].as_str().unwrap_or("?"));
        }
        assert!(items.len() > 0);
    }

    #[wasm_bindgen_test]
    fn test_filter_by_category_component_examples() {
        let (changes, _) = call_handler("filter", r#"{"query": "", "category": "Component Examples"}"#);
        let items = changes.get("filtered_items").and_then(|v| v.as_array()).unwrap();
        for item in items {
            assert_eq!(item["tag"].as_str(), Some("Component Examples"));
        }
        assert!(items.len() > 0);
    }

    #[wasm_bindgen_test]
    fn test_filter_action_alias_works() {
        // "filter" action should be identical to "search"
        let (changes_search, _) = call_handler("search", r#"{"query": "tab"}"#);
        let (changes_filter, _) = call_handler("filter", r#"{"query": "tab"}"#);
        let items_s = changes_search.get("filtered_items").and_then(|v| v.as_array()).unwrap();
        let items_f = changes_filter.get("filtered_items").and_then(|v| v.as_array()).unwrap();
        assert_eq!(items_s.len(), items_f.len());
    }

    #[wasm_bindgen_test]
    fn test_search_combines_query_and_category() {
        // category=Browser API + query=tab → should narrow down
        let (changes_all, _)  = call_handler("search", r#"{"query": "", "category": "Browser API"}"#);
        let (changes_tab, _)  = call_handler("search", r#"{"query": "tab", "category": "Browser API"}"#);
        let n_all = changes_all.get("filtered_items").and_then(|v| v.as_array()).unwrap().len();
        let n_tab = changes_tab.get("filtered_items").and_then(|v| v.as_array()).unwrap().len();
        assert!(n_tab <= n_all, "filtered by query should have <= items than no query");
    }

    #[wasm_bindgen_test]
    fn test_search_updates_search_query_in_changes() {
        let (changes, _) = call_handler("search", r#"{"query": "myquery"}"#);
        assert_eq!(changes.get("search_query").and_then(|v| v.as_str()), Some("myquery"));
    }

    #[wasm_bindgen_test]
    fn test_search_updates_selected_category_in_changes() {
        let (changes, _) = call_handler("search", r#"{"query": "", "category": "Browser API"}"#);
        assert_eq!(changes.get("selected_category").and_then(|v| v.as_str()), Some("Browser API"));
    }

    #[wasm_bindgen_test]
    fn test_search_falls_back_to_state_query() {
        let def = module_def();
        let handler = def.handle_action.unwrap();
        let mut state = Map::new();
        state.insert("search_query".into(), Value::String("tab".into()));
        state.insert("selected_category".into(), Value::String("All".into()));
        let params: Map<String, Value> = Map::new(); // no query in params → use state
        let (changes, _) = handler(&state, "search", &params).unwrap();
        let items = changes.get("filtered_items").and_then(|v| v.as_array()).unwrap();
        assert!(items.len() > 0, "should use state.search_query as fallback");
    }

    #[wasm_bindgen_test]
    fn test_unknown_action_returns_error() {
        let def = module_def();
        let handler = def.handle_action.unwrap();
        let state = make_menu_state();
        let params: Map<String, Value> = Map::new();
        let err = handler(&state, "delete_item", &params).unwrap_err();
        assert_eq!(err.code, "UNKNOWN_ACTION");
    }

    // ─── Manifest ─────────────────────────────────────────────────────────────

    #[wasm_bindgen_test]
    fn test_menu_module_manifest() {
        let def = module_def();
        assert_eq!(def.name, "menu");
        assert!(def.state_keys.contains(&"selected_category"));
        assert!(def.state_keys.contains(&"search_query"));
        assert!(def.state_keys.contains(&"filtered_items"));
    }
}
