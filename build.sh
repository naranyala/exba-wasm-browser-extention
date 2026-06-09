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

echo -e "${BLUE}=== Cleaning dist directory ===${NC}"
rm -rf dist
mkdir -p dist

echo -e "${BLUE}=== Building TypeScript files with esbuild ===${NC}"
# Build each entry point separately to maintain extension structure
npx esbuild src/background.ts --bundle --outfile=dist/background.js --format=esm --platform=browser
npx esbuild src/content.ts --bundle --outfile=dist/content.js --format=esm --platform=browser
npx esbuild src/offscreen.ts --bundle --outfile=dist/offscreen.js --format=esm --platform=browser
npx esbuild src/options.ts --bundle --outfile=dist/options.js --format=esm --platform=browser
npx esbuild src/sidepanel.ts --bundle --outfile=dist/sidepanel.js --format=esm --platform=browser
npx esbuild src/components/wasm-dashboard.ts --bundle --outfile=dist/components/wasm-dashboard.js --format=esm --platform=browser
npx esbuild src/components/wasm-benchmark.ts --bundle --outfile=dist/components/wasm-benchmark.js --format=esm --platform=browser

echo -e "${BLUE}=== Copying static assets from public ===${NC}"
cp -r public/* dist/

echo -e "${BLUE}=== Copying WASM pkg to dist ===${NC}"
mkdir -p dist/wasm/pkg
cp wasm/pkg/* dist/wasm/pkg/

echo -e "${GREEN}=== Build Successful! ===${NC}"
echo -e "${GREEN}You can now load the 'dist' directory as an unpacked extension in Google Chrome.${NC}"
