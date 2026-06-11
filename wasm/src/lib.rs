use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use web_sys::console;
use sha2::{Sha256, Digest};
use getrandom::getrandom;

#[derive(Serialize, Deserialize, Clone)]
pub struct MenuItem {
    pub title: String,
    pub description: String,
    pub tag: String,
    pub tag_class: String,
    pub icon_svg: String,
    pub action_id: String,
}

#[derive(Serialize, Deserialize, Default)]
pub struct ComponentState {
    pub count: i32,
    pub title: String,
    pub items: Vec<String>,
    pub greet_msg: String,
    pub fib_val: u32,
    pub processed_text: String,
    pub search_query: String,
    pub selected_category: String,
    pub password_result: String,
    pub hash_result: String,
    pub filtered_items: Vec<MenuItem>,
}

// Subsequence-based fuzzy matching function
fn fuzzy_match(text: &str, query: &str) -> bool {
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

fn get_all_menu_items() -> Vec<MenuItem> {
    vec![
        MenuItem {
            title: "Color Changer".to_string(),
            description: "Change web page background colors & save local settings.".to_string(),
            tag: "Basic".to_string(),
            tag_class: "tag-basic".to_string(),
            icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6a6 6 0 0 0-6 6c0 1.657.67 3.16 1.757 4.243A5.962 5.962 0 0 0 12 18a6 6 0 0 0 6-6 6 6 0 0 0-6-6z"/></svg>"#.to_string(),
            action_id: "btn-open-options".to_string(),
        },
        MenuItem {
            title: "Sidebar Monitor".to_string(),
            description: "Persistent sidebar logger for background alarm timestamps.".to_string(),
            tag: "Advanced".to_string(),
            tag_class: "tag-advanced".to_string(),
            icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>"#.to_string(),
            action_id: "btn-open-sidepanel".to_string(),
        },
        MenuItem {
            title: "Rust Speed Test".to_string(),
            description: "Run CPU loops to benchmark JS vs optimized Wasm.".to_string(),
            tag: "Wasm".to_string(),
            tag_class: "tag-wasm".to_string(),
            icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>"#.to_string(),
            action_id: "btn-open-benchmarks".to_string(),
        },
        MenuItem {
            title: "Text Ciphers".to_string(),
            description: "Perform reverse, ROT13, and upper-casing entirely in Wasm.".to_string(),
            tag: "Wasm".to_string(),
            tag_class: "tag-wasm".to_string(),
            icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/><path d="M9 22h6"/><path d="M12 10v12"/><path d="M12 10a4 4 0 0 0-4-4H5"/></svg>"#.to_string(),
            action_id: "btn-open-options".to_string(),
        },
        MenuItem {
            title: "Offscreen Clipboard".to_string(),
            description: "Write text to system clipboard via offscreen DOM frames.".to_string(),
            tag: "Advanced".to_string(),
            tag_class: "tag-advanced".to_string(),
            icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>"#.to_string(),
            action_id: "btn-open-sidepanel".to_string(),
        },
        MenuItem {
            title: "Request Blocker".to_string(),
            description: "Filter advertising doubleclick tracker requests dynamically.".to_string(),
            tag: "Network".to_string(),
            tag_class: "tag-network".to_string(),
            icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="9" x2="15" y1="9" y2="15"/><line x1="15" x2="9" y1="9" y2="15"/></svg>"#.to_string(),
            action_id: "btn-open-sidepanel".to_string(),
        },
        MenuItem {
            title: "Security Suite".to_string(),
            description: "Generate secure passwords and compute SHA-256 hashes.".to_string(),
            tag: "Security".to_string(),
            tag_class: "tag-security".to_string(),
            icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>"#.to_string(),
            action_id: "btn-open-security".to_string(),
        },
    ]
}

#[wasm_bindgen]
pub struct CoreEngine {
    state: ComponentState,
}

// This function will run automatically as soon as the WASM module is instantiated
#[wasm_bindgen(start)]
pub fn init_core() {
    // Set panic hook to log Rust stack traces to the browser developer tools console
    console_error_panic_hook::set_once();
    console::log_1(&"[Rust Unified Core] Module initialized and panic hook set!".into());
}

// Async function demonstrating how to use wasm-bindgen-futures to await JS Promises in Rust
#[wasm_bindgen]
pub async fn run_async_task(delay_ms: i32) -> Result<String, JsValue> {
    console::log_1(&format!("[Rust Core] Starting async task with {}ms delay...", delay_ms).into());
    
    // Create a JavaScript Promise that resolves after delay_ms using setTimeout
    let promise = js_sys::Promise::new(&mut |resolve, _| {
        if let Some(window) = web_sys::window() {
            let _ = window.set_timeout_with_callback_and_timeout_and_arguments_0(
                &resolve,
                delay_ms,
            );
        }
    });

    // Await the JS Promise asynchronously in Rust
    let _ = wasm_bindgen_futures::JsFuture::from(promise).await?;
    
    Ok(format!("Async task finished after {}ms! (Completed in Rust)", delay_ms))
}

#[wasm_bindgen]
impl CoreEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(initial_title: &str) -> Self {
        console::log_1(&"[Rust Unified Core] Initializing CoreEngine instance".into());
        let mut engine = Self {
            state: ComponentState {
                count: 0,
                title: initial_title.to_string(),
                items: vec![],
                greet_msg: "Enter your name and greet!".to_string(),
                fib_val: 0,
                processed_text: "Result will appear here...".to_string(),
                search_query: "".to_string(),
                selected_category: "All".to_string(),
                password_result: "".to_string(),
                hash_result: "".to_string(),
                filtered_items: vec![],
            },
        };
        engine.refresh_filtered_items();
        engine
    }

    fn refresh_filtered_items(&mut self) {
        let query = &self.state.search_query;
        let category = &self.state.selected_category;
        
        self.state.filtered_items = get_all_menu_items()
            .into_iter()
            .filter(|item| {
                // Filter by category first if not "All"
                if category != "All" && &item.tag != category {
                    return false;
                }
                
                fuzzy_match(&item.title, query)
                    || fuzzy_match(&item.description, query)
                    || fuzzy_match(&item.tag, query)
            })
            .collect();
    }

    pub fn set_category(&mut self, category: &str) {
        self.state.selected_category = category.to_string();
        self.refresh_filtered_items();
    }

    pub fn set_state(&mut self, state_json: &str) {
        if let Ok(new_state) = serde_json::from_str::<ComponentState>(state_json) {
            self.state = new_state;
            self.refresh_filtered_items();
        }
    }

    pub fn get_state_json(&self) -> String {
        serde_json::to_string(&self.state).unwrap_or_default()
    }

    pub fn set_search_query(&mut self, query: &str) {
        self.state.search_query = query.to_string();
        self.refresh_filtered_items();
    }

    // Security Tools
    pub fn generate_password(&mut self, length: usize) {
        let charset: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ\
                            abcdefghijklmnopqrstuvwxyz\
                            0123456789)(*&^%$#@!~";
        let mut password = vec![0u8; length];
        if getrandom(&mut password).is_ok() {
            self.state.password_result = password
                .iter()
                .map(|&b| charset[b as usize % charset.len()] as char)
                .collect();
        }
    }

    pub fn calculate_hash(&mut self, input: &str) {
        let mut hasher = Sha256::new();
        hasher.update(input.as_bytes());
        let result = hasher.finalize();
        self.state.hash_result = hex::encode(result);
    }

    // State Mutation Methods
    pub fn increment(&mut self) {
        self.state.count += 1;
    }

    pub fn decrement(&mut self) {
        self.state.count -= 1;
    }

    pub fn add_item(&mut self, item: &str) {
        let trimmed = item.trim();
        if !trimmed.is_empty() {
            self.state.items.push(trimmed.to_string());
        }
    }

    pub fn delete_item(&mut self, index: usize) {
        if index < self.state.items.len() {
            self.state.items.remove(index);
        }
    }

    pub fn clear_items(&mut self) {
        self.state.items.clear();
    }

    // Utility 1: Greet
    pub fn run_greet(&mut self, name: &str) {
        let trimmed = name.trim();
        if trimmed.is_empty() {
            self.state.greet_msg = "Please enter a valid name.".to_string();
        } else {
            self.state.greet_msg = format!("Hello, {}! (Gently greeted by Rust)", trimmed);
        }
    }

    // Utility 2: Fibonacci (CPU Benchmarking)
    pub fn run_fibonacci(&mut self, n: u32) {
        if n <= 1 {
            self.state.fib_val = n;
            return;
        }
        let mut a = 0;
        let mut b = 1;
        for _ in 2..=n {
            let temp = a + b;
            a = b;
            b = temp;
        }
        self.state.fib_val = b;
    }

    // Utility 3: Text processing ciphers
    pub fn run_text_process(&mut self, text: &str, action: &str) {
        self.state.processed_text = match action {
            "reverse" => text.chars().rev().collect(),
            "rot13" => text.chars().map(|c| {
                match c {
                    'a'..='m' | 'A'..='M' => ((c as u8) + 13) as char,
                    'n'..='z' | 'N'..='Z' => ((c as u8) - 13) as char,
                    _ => c
                }
            }).collect(),
            "uppercase" => text.to_uppercase(),
            _ => format!("Unknown action: {}", action),
        };
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    #[wasm_bindgen_test]
    fn test_fuzzy_match() {
        assert!(fuzzy_match("Color Changer", "color"));
        assert!(fuzzy_match("Color Changer", "clrc"));
        assert!(fuzzy_match("Sidebar Monitor", "side"));
        assert!(!fuzzy_match("Sidebar Monitor", "xyz"));
    }

    #[wasm_bindgen_test]
    fn test_password_generation() {
        let mut engine = CoreEngine::new("Test");
        engine.generate_password(20);
        assert_eq!(engine.state.password_result.len(), 20);
        
        let first_pass = engine.state.password_result.clone();
        engine.generate_password(20);
        assert_ne!(first_pass, engine.state.password_result);
    }

    #[wasm_bindgen_test]
    fn test_hashing() {
        let mut engine = CoreEngine::new("Test");
        engine.calculate_hash("hello");
        // echo -n "hello" | sha256sum
        assert_eq!(engine.state.hash_result, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
    }

    #[wasm_bindgen_test]
    fn test_text_processing() {
        let mut engine = CoreEngine::new("Test");
        
        engine.run_text_process("hello", "reverse");
        assert_eq!(engine.state.processed_text, "olleh");
        
        engine.run_text_process("hello", "uppercase");
        assert_eq!(engine.state.processed_text, "HELLO");
        
        engine.run_text_process("abc", "rot13");
        assert_eq!(engine.state.processed_text, "nop");
    }
}
