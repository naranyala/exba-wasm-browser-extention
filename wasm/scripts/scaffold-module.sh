#!/bin/bash
# =============================================================================
# Scaffold a full-stack WASM module (Rust + Web Component)
# =============================================================================
# Usage: ./wasm/scripts/scaffold-module.sh <module-name>
#
# Creates:
#   wasm/src/modules/<name>.rs           — ModuleDef with action handler + tests
#   src/components/wasm-<name>.ts        — Web Component backed by dispatch_action
#   Updates wasm/src/modules/mod.rs       — Registers the module
#   Updates src/components/index.ts       — Exports the new component
#
# After scaffolding:
#   1. Implement handler in wasm/src/modules/<name>.rs
#   2. Wire up UI in src/components/wasm-<name>.ts
#   3. Run: ./build.sh
# =============================================================================

set -e

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

# Normalize name
MODULE_NAME="${1,,}"                                 # lowercase
MODULE_NAME_SNAKE="$(echo "$MODULE_NAME" | tr '-' '_')"
MODULE_NAME_PASCAL="$(echo "$MODULE_NAME" | sed 's/[^a-z0-9]//g' | sed 's/^\(.\)/\U\1/')"
COMPONENT_TAG="wasm-${MODULE_NAME}"

if [ -z "$MODULE_NAME" ]; then
  echo "Usage: $0 <module-name>"
  echo "Example: $0 image-processor"
  echo "Creates: wasm/src/modules/image_processor.rs, src/components/wasm-image-processor.ts"
  exit 1
fi

MODULE_FILE="$ROOT_DIR/wasm/src/modules/$MODULE_NAME_SNAKE.rs"
COMPONENT_FILE="$ROOT_DIR/src/components/wasm-$MODULE_NAME.ts"

if [ -f "$MODULE_FILE" ]; then
  echo "Error: Module already exists at $MODULE_FILE"
  exit 1
fi

echo "==> Scaffolding module: $MODULE_NAME"
echo "    Rust:    $MODULE_FILE"
echo "    TS:      $COMPONENT_FILE"

# ═════════════════════════════════════════════════════════════════════
# 1. Create Rust module with ModuleDef + action handler + tests
# ═════════════════════════════════════════════════════════════════════

cat > "$MODULE_FILE" << RUSTEOF
use crate::module_system::{ModuleDef, ModuleEvent, ActionResult};
use serde_json::{Value, Map};

/// Module definition — registers with the engine and provides action handling.
pub fn module_def() -> ModuleDef {
    ModuleDef::new(
        "$MODULE_NAME",
        "0.1.0",
        "TODO: describe $MODULE_NAME",
        &["${MODULE_NAME_SNAKE}_result"],
        Some(handle_action),
    )
}

/// Action handler — receives module state + action + params, returns state changes + events.
fn handle_action(
    _state: &Map<String, Value>,
    action: &str,
    params: &Map<String, Value>,
) -> ActionResult {
    match action {
        "process" => {
            let input = params
                .get("input")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            // TODO: implement your module logic here
            let result = format!("{} processed by {} module", input, "$MODULE_NAME");

            let mut changes = Map::new();
            changes.insert("${MODULE_NAME_SNAKE}_result".into(), Value::String(result));

            let events = vec![ModuleEvent {
                module: String::new(),  // filled by dispatch()
                name: "${MODULE_NAME_SNAKE}_processed".to_string(),
                data: serde_json::json!({ "input": input }),
            }];

            Ok((changes, events))
        }
        _ => Err(crate::module_system::ModuleError::new(
            "UNKNOWN_ACTION",
            &format!("{} module: unknown action '{}'", "$MODULE_NAME", action),
        )),
    }
}

// ── Pure functions (testable without WASM) ──

/// TODO: implement your module's core logic here
// pub fn do_something(input: &str) -> String {
//     format!("processed: {}", input)
// }

#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    #[wasm_bindgen_test]
    fn test_dispatch_process() {
        let state = Map::new();
        let params = serde_json::json!({"input": "test"});
        let params_map: Map<String, Value> = serde_json::from_value(params).unwrap();
        let result = handle_action(&state, "process", &params_map);
        assert!(result.is_ok());
        let (changes, events) = result.unwrap();
        assert!(changes.contains_key("${MODULE_NAME_SNAKE}_result"));
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].name, "${MODULE_NAME_SNAKE}_processed");
    }
}
RUSTEOF
echo "  ✅ Created $MODULE_FILE"

# ═════════════════════════════════════════════════════════════════════
# 2. Create Web Component using createWasmComponent factory
# ═════════════════════════════════════════════════════════════════════

cat > "$COMPONENT_FILE" << TSEOF
import { createWasmComponent } from '../lib/register-component';
import init, { CoreEngine } from '../../wasm/pkg/wasm_unified_core';

/**
 * ${MODULE_NAME_PASCAL} — Web Component backed by the \`${MODULE_NAME}\` WASM module.
 *
 * Uses the dynamic \`dispatch_action\` API for all WASM communication.
 *
 * ## Usage
 * \`\`\`html
 * <wasm-${MODULE_NAME} title="My ${MODULE_NAME_PASCAL}"></wasm-${MODULE_NAME}>
 * \`\`\`
 */
createWasmComponent({
  tag: '${COMPONENT_TAG}',
  initWasm: init as any,
  Engine: CoreEngine as any,

  render: (ctx) => \`
    <style>
      :host { display: block; font-family: system-ui, sans-serif; }
      .card {
        background: rgba(30, 41, 59, 0.25);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        padding: 16px;
      }
      .result {
        font-family: monospace;
        font-size: 12px;
        color: #34d399;
        background: rgba(16, 185, 129, 0.06);
        padding: 8px 10px;
        border-radius: 6px;
        border: 1px solid rgba(16, 185, 129, 0.1);
        margin-top: 8px;
      }
      input, button {
        font-family: inherit;
        padding: 6px 12px;
        border-radius: 6px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(15, 23, 42, 0.4);
        color: #f8fafc;
        font-size: 13px;
      }
      button {
        background: #6366f1;
        color: white;
        border: none;
        cursor: pointer;
        font-weight: 600;
      }
      button:hover { opacity: 0.9; }
    </style>
    <div class="card">
      <div style="font-size: 14px; font-weight: 600; margin-bottom: 10px; color: #f8fafc;">
        \${ctx.state.value?.title || '${MODULE_NAME_PASCAL}'}
      </div>
      <div style="display: flex; gap: 8px; margin-bottom: 8px;">
        <input id="input" type="text" placeholder="Enter input..." style="flex: 1;" />
        <button id="process-btn">Process</button>
      </div>
      <div id="result" class="result">Result will appear here...</div>
    </div>
  \`,

  effects: [
    (ctx) => ctx.bindText('#result', (s) =>
      (s as any).${MODULE_NAME_SNAKE}_result || 'Result will appear here...'
    ),
  ],

  onMount: (ctx) => {
    ctx.on('#process-btn', 'click', () => {
      const input = ctx.query('#input') as HTMLInputElement | null;
      if (!input || !input.value.trim()) return;

      // Use the universal dispatch API
      ctx.dispatch('${MODULE_NAME}', 'process', { input: input.value });
    });
  },

  onEvent: (ctx, event) => {
    if (event.name === '${MODULE_NAME_SNAKE}_processed') {
      console.log('[${MODULE_NAME_PASCAL}] Processed:', event.data);
    }
  },
});
TSEOF
echo "  ✅ Created $COMPONENT_FILE"

# ═════════════════════════════════════════════════════════════════════
# 3. Register in modules/mod.rs
# ═════════════════════════════════════════════════════════════════════

MOD_MOD="$ROOT_DIR/wasm/src/modules/mod.rs"
if grep -q "pub mod $MODULE_NAME_SNAKE;" "$MOD_MOD"; then
  echo "  ⏭️  Already registered in modules/mod.rs"
else
  sed -i "s/pub mod text;/pub mod text;\npub mod ${MODULE_NAME_SNAKE};/" "$MOD_MOD"
  sed -i "s/        text::module_def(),/        text::module_def(),\n        ${MODULE_NAME_SNAKE}::module_def(),/" "$MOD_MOD"
  echo "  ✅ Updated modules/mod.rs"
fi

echo ""
echo "==> ✅ Full-stack scaffold complete!"
echo ""
echo "Next steps:"
echo "  1. Implement logic in wasm/src/modules/${MODULE_NAME_SNAKE}.rs"
echo "  2. Add state initialization to modules/mod.rs::collect_initial_state()"
echo "  3. Run: ./build.sh"
echo "  4. Import the component:"
echo "     import './components/wasm-${MODULE_NAME}';"
echo "  5. Use in HTML:"
echo "     <wasm-${MODULE_NAME} title=\"My ${MODULE_NAME_PASCAL}\"></wasm-${MODULE_NAME}>"
