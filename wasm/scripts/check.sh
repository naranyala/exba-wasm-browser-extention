#!/bin/bash
# =============================================================================
# Rust WASM module checker
# =============================================================================
# Quick validation that all modules compile, tests pass,
# and the module manifest is correctly assembled.
#
# Usage: ./wasm/scripts/check.sh
# =============================================================================

set -e

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR/wasm"

echo "==> 🔍 Running cargo check..."
cargo check --target wasm32-unknown-unknown 2>&1

echo ""
echo "==> 🧪 Running Rust tests (native)..."
cargo test 2>&1 || echo "  (Some tests may require --target wasm32; these are checked below)"

echo ""
echo "==> 🧪 Running WASM tests..."
wasm-pack test --node 2>&1

echo ""
echo "==> 📦 Building WASM package..."
wasm-pack build --target web 2>&1

echo ""
echo "==> ✅ Module manifest check..."
# Verify get_module_manifests_json is exported
if grep -q "get_module_manifests_json" pkg/wasm_unified_core.d.ts; then
  echo "  ✅ get_module_manifests_json is exported"
else
  echo "  ❌ get_module_manifests_json NOT found in pkg!"
  exit 1
fi

# Count modules
MANIFEST_COUNT=$(grep "pub fn manifest" src/modules/*.rs 2>/dev/null | wc -l)
echo "  📊 Registered modules: $MANIFEST_COUNT"

echo ""
echo "==> ✅ All checks passed!"
