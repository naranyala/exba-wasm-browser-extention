//! # wasm_unified_core
//!
//! Modular Rust-WASM core engine for the EXBA browser extension.
//!
//! ## Module system
//!
//! Each feature is implemented as a `ModuleDef` in `modules/`.
//! To add a new feature:
//!   1. Run: `npm run wasm:module my-module-name`
//!   2. Implement logic in `wasm/src/modules/my_module_name.rs`
//!   3. The module_def() action handler receives state and returns changes
//!   4. Call from JS via `engine.dispatch_action("my-module-name", "action", params)`
//!
//! ## API
//!
//! - `dispatch_action(module, action, params)` — universal module API
//! - `drain_events()` — collect WASM→JS events
//! - `get_state_json()` / `set_state()` — full state sync
//! - `get_module_manifests_json()` — module introspection
//! - Backward-compatible convenience methods preserved.

pub mod types;
pub mod module_system;
pub mod engine;
pub mod modules;

#[cfg(test)]
pub mod tests;

use wasm_bindgen::prelude::*;
use web_sys::console;

pub use engine::CoreEngine;
pub use engine::get_module_manifests_json;

/// Called automatically when the WASM module is instantiated.
#[wasm_bindgen(start)]
pub fn init_core() {
    console_error_panic_hook::set_once();
    let module_count = modules::all_defs().len();
    console::log_1(&format!(
        "[Rust Core] Initialized with {} registered modules",
        module_count
    ).into());
}

/// Async task demonstrating JS Promise integration from Rust.
#[wasm_bindgen]
pub async fn run_async_task(delay_ms: i32) -> Result<String, JsValue> {
    console::log_1(&format!("[Rust Core] Starting async task with {}ms delay...", delay_ms).into());

    let promise = js_sys::Promise::new(&mut |resolve, _| {
        if let Some(window) = web_sys::window() {
            let _ = window.set_timeout_with_callback_and_timeout_and_arguments_0(
                &resolve,
                delay_ms,
            );
        }
    });

    let _ = wasm_bindgen_futures::JsFuture::from(promise).await?;

    Ok(format!("Async task finished after {}ms! (Completed in Rust)", delay_ms))
}
