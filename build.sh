#!/bin/bash
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Building Rust WASM Core for Unified Extension ===${NC}"

# Navigate to wasm directory
cd "$(dirname "$0")/wasm"

# Compile WASM module for target web (ES modules)
wasm-pack build --target web

echo -e "${GREEN}=== Build Successful! ===${NC}"
echo -e "${GREEN}WASM module successfully compiled to wasm/pkg/${NC}"
echo -e "You can now load the root directory as an unpacked extension in Google Chrome."
