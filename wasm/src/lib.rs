use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use web_sys::console;

#[derive(Serialize, Deserialize, Default)]
pub struct ComponentState {
    pub count: i32,
    pub title: String,
    pub items: Vec<String>,
    pub greet_msg: String,
    pub fib_val: u32,
    pub processed_text: String,
    pub search_query: String,
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

#[wasm_bindgen]
pub struct CoreEngine {
    state: ComponentState,
}

// This function will run automatically as soon as the WASM module is instantiated
#[wasm_bindgen(start)]
pub fn main() {
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
        Self {
            state: ComponentState {
                count: 0,
                title: initial_title.to_string(),
                items: vec![],
                greet_msg: "Enter your name and greet!".to_string(),
                fib_val: 0,
                processed_text: "Result will appear here...".to_string(),
                search_query: "".to_string(),
            },
        }
    }

    pub fn set_state(&mut self, state_json: &str) {
        if let Ok(new_state) = serde_json::from_str::<ComponentState>(state_json) {
            self.state = new_state;
        }
    }

    pub fn get_state_json(&self) -> String {
        serde_json::to_string(&self.state).unwrap_or_default()
    }

    pub fn set_search_query(&mut self, query: &str) {
        self.state.search_query = query.to_string();
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

    // Renders the main dashboard UI (Popup View - Grid menu with fuzzy search)
    pub fn render(&self) -> String {
        struct MenuItem {
            title: &'static str,
            description: &'static str,
            tag: &'static str,
            tag_class: &'static str,
            icon_svg: &'static str,
            action_id: &'static str,
        }

        let menu_items = vec![
            MenuItem {
                title: "Color Changer",
                description: "Change web page background colors & save local settings.",
                tag: "Basic",
                tag_class: "tag-basic",
                icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6a6 6 0 0 0-6 6c0 1.657.67 3.16 1.757 4.243A5.962 5.962 0 0 0 12 18a6 6 0 0 0 6-6 6 6 0 0 0-6-6z"/></svg>"#,
                action_id: "btn-open-options",
            },
            MenuItem {
                title: "Sidebar Monitor",
                description: "Persistent sidebar logger for background alarm timestamps.",
                tag: "Advanced",
                tag_class: "tag-advanced",
                icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>"#,
                action_id: "btn-open-sidepanel",
            },
            MenuItem {
                title: "Rust Speed Test",
                description: "Run CPU loops to benchmark JS vs optimized Wasm.",
                tag: "Wasm",
                tag_class: "tag-wasm",
                icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>"#,
                action_id: "btn-open-benchmarks",
            },
            MenuItem {
                title: "Text Ciphers",
                description: "Perform reverse, ROT13, and upper-casing entirely in Wasm.",
                tag: "Wasm",
                tag_class: "tag-wasm",
                icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/><path d="M9 22h6"/><path d="M12 10v12"/><path d="M12 10a4 4 0 0 0-4-4H5"/></svg>"#,
                action_id: "btn-open-options",
            },
            MenuItem {
                title: "Offscreen Clipboard",
                description: "Write text to system clipboard via offscreen DOM frames.",
                tag: "Advanced",
                tag_class: "tag-advanced",
                icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>"#,
                action_id: "btn-open-sidepanel",
            },
            MenuItem {
                title: "Request Blocker",
                description: "Filter advertising doubleclick tracker requests dynamically.",
                tag: "Network",
                tag_class: "tag-network",
                icon_svg: r#"<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="9" x2="15" y1="9" y2="15"/><line x1="15" x2="9" y1="9" y2="15"/></svg>"#,
                action_id: "btn-open-sidepanel",
            },
        ];

        let filtered_items_html: String = menu_items
            .iter()
            .filter(|item| {
                fuzzy_match(item.title, &self.state.search_query)
                    || fuzzy_match(item.description, &self.state.search_query)
                    || fuzzy_match(item.tag, &self.state.search_query)
            })
            .map(|item| {
                format!(
                    r#"
                    <div class="grid-card" id="{}">
                      <div class="card-top">
                        <div style="display: flex; align-items: center; gap: 6px;">
                          <span style="color: #a5b4fc; display: flex; align-items: center;">{}</span>
                          <span class="card-title">{}</span>
                        </div>
                        <p class="card-desc">{}</p>
                      </div>
                      <span class="card-badge {}">{}</span>
                    </div>
                    "#,
                    item.action_id, item.icon_svg, item.title, item.description, item.tag_class, item.tag
                )
            })
            .collect();

        let empty_placeholder = if filtered_items_html.is_empty() {
            format!(
                r#"
                <div class="no-results">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #64748b; margin-bottom: 8px;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  <p>No tools matched "{}"</p>
                </div>
                "#,
                self.state.search_query
            )
        } else {
            "".to_string()
        };

        format!(
            r#"
            <style>
              .search-wrapper {{
                position: relative;
                margin-bottom: 14px;
              }}
              .search-input {{
                width: 100%;
                background: rgba(15, 23, 42, 0.5);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 8px;
                padding: 10px 14px 10px 36px;
                color: #f8fafc;
                font-family: inherit;
                font-size: 13px;
                transition: all 0.25s ease;
                box-sizing: border-box;
              }}
              .search-input:focus {{
                outline: none;
                border-color: #6366f1;
                box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
              }}
              .search-icon {{
                position: absolute;
                left: 12px;
                top: 50%;
                transform: translateY(-50%);
                color: #64748b;
                pointer-events: none;
                display: flex;
                align-items: center;
              }}
              .grid-menu {{
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
                max-height: 300px;
                overflow-y: auto;
                padding-right: 4px;
              }}
              .grid-menu::-webkit-scrollbar {{
                width: 4px;
              }}
              .grid-menu::-webkit-scrollbar-thumb {{
                background: rgba(255, 255, 255, 0.08);
                border-radius: 2px;
              }}
              .grid-card {{
                background: rgba(30, 41, 59, 0.35);
                border: 1px solid rgba(255, 255, 255, 0.04);
                border-radius: 10px;
                padding: 12px;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                min-height: 105px;
              }}
              .grid-card:hover {{
                transform: translateY(-2px);
                border-color: #6366f1;
                background: rgba(99, 102, 241, 0.08);
                box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
              }}
              .card-top {{
                display: flex;
                flex-direction: column;
                gap: 4px;
              }}
              .card-title {{
                font-size: 12px;
                font-weight: 700;
                color: #f8fafc;
              }}
              .card-desc {{
                font-size: 10.5px;
                color: #94a3b8;
                line-height: 1.35;
                margin: 0;
              }}
              .card-badge {{
                align-self: flex-start;
                font-size: 8px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                background: rgba(99, 102, 241, 0.15);
                color: #a5b4fc;
                padding: 2px 6px;
                border-radius: 4px;
                margin-top: 8px;
              }}
              .card-badge.tag-basic {{ background: rgba(16, 185, 129, 0.15); color: #34d399; }}
              .card-badge.tag-advanced {{ background: rgba(239, 68, 68, 0.15); color: #f87171; }}
              .card-badge.tag-network {{ background: rgba(245, 158, 11, 0.15); color: #fbbf24; }}
              .card-badge.tag-wasm {{ background: rgba(168, 85, 247, 0.15); color: #d8b4fe; }}
              .no-results {{
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 40px 20px;
                text-align: center;
                color: #64748b;
                font-size: 12px;
              }}
              .no-results p {{
                margin: 0;
              }}
            </style>
            <div>
              <!-- Search bar -->
              <div class="search-wrapper">
                <div class="search-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </div>
                <input type="text" id="search-input" class="search-input" placeholder="Search tools (e.g. Wasm, Block)..." value="{}">
              </div>

              <!-- Grid Menu -->
              <div class="grid-menu">
                {}
                {}
              </div>
            </div>
            "#,
            self.state.search_query, filtered_items_html, empty_placeholder
        )
    }

    // Renders the Options Page Benchmark UI
    pub fn render_benchmark(&self) -> String {
        format!(
            r#"
            <style>
              .bench-box {{
                background: rgba(15, 23, 42, 0.4);
                border: 1px dashed rgba(255, 255, 255, 0.08);
                border-radius: 6px;
                padding: 10px;
                font-family: monospace;
                font-size: 12px;
                color: #10b981;
                margin-top: 6px;
              }}
              strong {{
                color: #38bdf8;
              }}
            </style>
            <div>
              <div class="bench-box">
                Last calculated: fib(<strong>{}</strong>) = <strong>{}</strong>
              </div>
            </div>
            "#,
            self.state.count, self.state.fib_val
        )
    }
}
