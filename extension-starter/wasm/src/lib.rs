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
}

#[wasm_bindgen]
pub struct CoreEngine {
    state: ComponentState,
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

    // Renders the main dashboard UI (Popup View)
    pub fn render(&self) -> String {
        let items_html: String = self.state.items.iter().enumerate().map(|(idx, item)| {
            format!(
                r#"
                <li>
                  <span>{}</span>
                  <button class="delete-btn" data-idx="{}">×</button>
                </li>
                "#,
                item, idx
            )
        }).collect();

        let placeholder_html = if self.state.items.is_empty() {
            "<p class='empty-placeholder'>No task items yet. Try typing one!</p>"
        } else {
            ""
        };

        format!(
            r#"
            <style>
              .wasm-wrapper {{
                display: flex;
                flex-direction: column;
                gap: 14px;
                color: #f8fafc;
                font-family: inherit;
              }}
              .card {{
                background: rgba(30, 41, 59, 0.35);
                border: 1px solid rgba(255, 255, 255, 0.05);
                border-radius: 10px;
                padding: 12px;
              }}
              h3 {{
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: #94a3b8;
                margin-top: 0;
                margin-bottom: 8px;
              }}
              .counter-row {{
                display: flex;
                align-items: center;
                justify-content: space-between;
              }}
              .counter-val {{
                font-size: 13px;
              }}
              .counter-val strong {{
                color: #38bdf8;
                font-size: 15px;
                font-family: monospace;
              }}
              .btn-group {{
                display: flex;
                gap: 6px;
              }}
              button {{
                background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
              }}
              button:hover {{
                transform: translateY(-0.5px);
                box-shadow: 0 4px 6px rgba(99, 102, 241, 0.2);
              }}
              .btn-danger {{
                background: linear-gradient(135deg, #ef4444 0%, #f43f5e 100%);
              }}
              .btn-danger:hover {{
                box-shadow: 0 4px 6px rgba(239, 68, 68, 0.2);
              }}
              .input-row {{
                display: flex;
                gap: 6px;
              }}
              input {{
                flex: 1;
                background: rgba(15, 23, 42, 0.5);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 4px;
                padding: 6px 10px;
                color: white;
                font-size: 12px;
              }}
              input:focus {{
                outline: none;
                border-color: #6366f1;
              }}
              ul {{
                margin: 8px 0 0 0;
                padding: 0;
                list-style: none;
                max-height: 80px;
                overflow-y: auto;
              }}
              li {{
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: rgba(30, 41, 59, 0.25);
                padding: 6px 10px;
                border-radius: 4px;
                border: 1px solid rgba(255, 255, 255, 0.02);
                margin-bottom: 4px;
                font-size: 12px;
              }}
              .delete-btn {{
                background: transparent;
                border: none;
                color: #ef4444;
                font-size: 16px;
                padding: 0 4px;
                cursor: pointer;
                box-shadow: none !important;
                transform: none !important;
              }}
              .empty-placeholder {{
                font-size: 11px;
                color: #64748b;
                text-align: center;
                font-style: italic;
                margin: 8px 0 0 0;
              }}
            </style>
            <div class="wasm-wrapper">
              <!-- Counter component -->
              <div class="card">
                <h3>1. Counter State ({})</h3>
                <div class="counter-row">
                  <span class="counter-val">Value: <strong>{}</strong></span>
                  <div class="btn-group">
                    <button id="btn-dec" data-click="decrement">-</button>
                    <button id="btn-inc" data-click="increment">+</button>
                  </div>
                </div>
              </div>

              <!-- List component -->
              <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <h3>2. Task Organizer</h3>
                  <button id="btn-clear" data-click="clear_items" class="btn-danger" style="padding: 2px 6px; font-size: 9px; border-radius: 3px;">Clear</button>
                </div>
                <div class="input-row" style="margin-top: 4px;">
                  <input type="text" id="item-input" placeholder="Type new item...">
                  <button id="btn-add">Add</button>
                </div>
                {}
                <ul>{}</ul>
              </div>
            </div>
            "#,
            self.state.title, self.state.count, placeholder_html, items_html
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
