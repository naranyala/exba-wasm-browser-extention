#!/bin/bash
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo -e "${BLUE}=== Building Rust WASM Core ===${NC}"
cd "$ROOT_DIR/wasm"
wasm-pack build --target web
cd "$ROOT_DIR"

echo -e "${CYAN}=== Generating TypeScript types from WASM ===${NC}"
npx tsx "$ROOT_DIR/scripts/gen-wasm-types.ts"

echo -e "${BLUE}=== Building Extension with Rsbuild ===${NC}"
bun run build

echo -e "${BLUE}=== Validating Extension Build ===${NC}"
node "$ROOT_DIR/validate-build.cjs"

echo ""
echo -e "${GREEN}=== Build Successful! ===${NC}"
echo -e "  📦 dist/chrome/   — Chrome extension"
echo -e "  📦 dist/firefox/  — Firefox extension"
echo -e "  🦀 WASM modules: $(grep -c 'pub fn manifest' wasm/src/modules/*.rs 2>/dev/null || echo 0)"
echo -e "${GREEN}Load the 'dist' directory as an unpacked extension.${NC}"
