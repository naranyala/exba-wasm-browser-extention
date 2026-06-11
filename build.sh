#!/bin/bash
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Building Rust WASM Core ===${NC}"
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR/wasm"
wasm-pack build --target web
cd "$ROOT_DIR"

echo -e "${BLUE}=== Building Extension with Rsbuild ===${NC}"
npm run build

echo -e "${GREEN}=== Build Successful! ===${NC}"
echo -e "${GREEN}You can now load the 'dist' directory as an unpacked extension in Google Chrome.${NC}"
