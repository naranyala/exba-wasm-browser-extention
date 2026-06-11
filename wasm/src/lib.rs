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
        // ── Component Examples ──
        MenuItem {
            title: "Accordion".to_string(),
            description: "Collapsible content sections with smooth animations.".to_string(),
            tag: "Component Examples".to_string(),
            tag_class: "tag-wasm".to_string(),
            icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3"/><path d="M21 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3"/><path d="m9 12 3-3 3 3"/><path d="m9 12 3 3 3-3"/></svg>"#.to_string(),
            action_id: "demo-accordion".to_string(),
        },
        MenuItem {
            title: "Treeview".to_string(),
            description: "Interactive hierarchical tree with expand and collapse.".to_string(),
            tag: "Component Examples".to_string(),
            tag_class: "tag-wasm".to_string(),
            icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12h-4l-3 9L9 3l-3 9H2"/></svg>"#.to_string(),
            action_id: "demo-treeview".to_string(),
        },
        // ── Browser API Exploration ──
        MenuItem {
            title: "Tab Manager".to_string(),
            description: "Query, create, and close browser tabs in real time.".to_string(),
            tag: "Browser API".to_string(),
            tag_class: "tag-basic".to_string(),
            icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 3v6"/></svg>"#.to_string(),
            action_id: "demo-tabs".to_string(),
        },
        MenuItem {
            title: "Storage Explorer".to_string(),
            description: "Read, write, and clear extension local storage keys.".to_string(),
            tag: "Browser API".to_string(),
            tag_class: "tag-basic".to_string(),
            icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>"#.to_string(),
            action_id: "demo-storage".to_string(),
        },
        MenuItem {
            title: "Notifications".to_string(),
            description: "Fire desktop notifications via the chrome.notifications API.".to_string(),
            tag: "Browser API".to_string(),
            tag_class: "tag-basic".to_string(),
            icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>"#.to_string(),
            action_id: "demo-notifications".to_string(),
        },
        MenuItem {
            title: "Alarms".to_string(),
            description: "Schedule and list periodic alarms with chrome.alarms API.".to_string(),
            tag: "Browser API".to_string(),
            tag_class: "tag-basic".to_string(),
            icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/></svg>"#.to_string(),
            action_id: "demo-alarms".to_string(),
        },
        MenuItem {
            title: "Bookmarks Explorer".to_string(),
            description: "Browse and manage your browser's bookmark hierarchy.".to_string(),
            tag: "Browser API".to_string(),
            tag_class: "tag-basic".to_string(),
            icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>"#.to_string(),
            action_id: "demo-bookmarks".to_string(),
        },
        MenuItem {
            title: "History Explorer".to_string(),
            description: "Inspect and search your browsing history.".to_string(),
            tag: "Browser API".to_string(),
            tag_class: "tag-basic".to_string(),
            icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4-2"/></svg>"#.to_string(),
            action_id: "demo-history".to_string(),
        },
        MenuItem {
            title: "Cookies Explorer".to_string(),
            description: "View and manage cookies for the current session.".to_string(),
            tag: "Browser API".to_string(),
            tag_class: "tag-basic".to_string(),
            icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01"/><path d="M12 12v.01"/><path d="M15.5 8.5v.01"/><path d="M12 15.5v.01"/><path d="M8.5 15.5v.01"/><path d="M15.5 15.5v.01"/></svg>"#.to_string(),
            action_id: "demo-cookies".to_string(),
        },
        // ── Component Integration ──
        MenuItem {
            title: "Audio Visualizer".to_string(),
            description: "Audio player with real-time Web Audio waveform visualization.".to_string(),
            tag: "Component Integration".to_string(),
            tag_class: "tag-int".to_string(),
            icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>"#.to_string(),
            action_id: "demo-audio-player".to_string(),
        },
        MenuItem {
            title: "Leaflet Map".to_string(),
            description: "Interactive map integration using Leaflet.js.".to_string(),
            tag: "Component Integration".to_string(),
            tag_class: "tag-int".to_string(),
            icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>"#.to_string(),
            action_id: "demo-leaflet".to_string(),
        },
        MenuItem {
            title: "Mindmap Network".to_string(),
            description: "Dynamic graph visualization using vis-network.".to_string(),
            tag: "Component Integration".to_string(),
            tag_class: "tag-int".to_string(),
            icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M6 18l12-12"/></svg>"#.to_string(),
            action_id: "demo-vis-network".to_string(),
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
