# Unified Rust-WASM Chrome Extension Starter

This is a premium, consolidated Manifest V3 boilerplate project integrating browser-native Web Components, Rust + WebAssembly state engines, Sidepanels, Alarms, Offscreen DOM contexts, and Declarative Net Request rules.

## Features

- **Consolidated Architecture**: Avoids managing multiple extensions by packing standard and advanced APIs into one project.
- **WASM-Backed Web Components (`WasmElement`)**: Implements a native, framework-less Web Component engine. The popup (`<wasm-dashboard>`) and options page (`<wasm-benchmark>`) are Custom Elements that delegate state management and HTML layout rendering to Rust.
- **Manifest V3 Compliant Background Worker**: Sets up the service worker as an ES module, importing and running the Rust WASM library.
- **Advanced API integrations**:
  - **Sidepanel**: Shows persistent logging and action triggers in the browser sidebar.
  - **Offscreen Document**: Manages copying text to the user's clipboard from the service worker via DOM selection.
  - **Alarms**: Triggers periodic background alarms (every 1 minute).
  - **Declarative Net Request**: Blocks advertisements/trackers (`doubleclick.net`) and injects headers (`X-Extension-Header`) on specific URLs.

---

## File Structure

```text
extension-starter/
├── manifest.json         # Extension Manifest V3 configuration
├── rules.json            # Declarative Net Request filtering rules
├── styles.css            # Shared glassmorphic UI stylesheet
├── framework.js          # Base WasmElement class mapping Custom Elements to Rust
├── build.sh              # Bash script to compile Rust core to WASM
│
├── popup.html            # Default popup entry point
├── options.html          # Extension options page
├── options.js            # Initializer for options and loop speed benchmark
├── sidepanel.html / js   # Persistent sidebar UI and listener
├── content.js            # Page script auto-applying storage styling
├── background.js         # Service worker handling alarms & Offscreen Document
├── offscreen.html / js   # Offscreen helper page for Clipboard copy tasks
│
├── components/           # JavaScript Web Component wrappers
│   ├── wasm-dashboard.js # Wraps `<wasm-dashboard>`
│   └── wasm-benchmark.js # Wraps `<wasm-benchmark>`
│
└── wasm/                 # Rust Core Crate
    ├── Cargo.toml        # Rust dependencies (serde, serde_json, web-sys)
    └── src/
        └── lib.rs        # Core state, mutators, and layout render templates
```

---

## Setup & Development

### 1. Compile the WASM Core
Compile the Rust project to WASM modules using the compile script:
```bash
chmod +x build.sh
./build.sh
```
This runs `wasm-pack build --target web` inside the `wasm` directory, generating JavaScript ES wrappers and WASM binaries under `wasm/pkg/`.

### 2. Load the Extension in Chrome
1. Open Google Chrome.
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the `extension-starter` directory from your file system.

### 3. Verification & Debugging
- **Popup**: Click the extension icon. You'll see the `<wasm-dashboard>` component in action, maintaining count values and an interactive task list powered by Rust.
- **Side Panel**: Right-click the extension icon and select **Open side panel** (or click the icon if configured to open sidepanel directly). Type a string and click **Copy** to test clipboard writes via the Offscreen Document.
- **Alarms**: Keep the sidepanel open. Once a minute, the background alarm fires and pushes the timestamp event directly to the sidepanel list.
- **Network rules**: Click the links in the sidepanel. Notice that `doubleclick.net` blocks successfully, and requests to `https://httpbin.org/headers` include the custom header `X-Extension-Header: WasmUnifiedDemo`.
- **Options Benchmark**: Right-click the extension icon and choose **Options**. Set your favorite colors, and click **Run Speed Test** to run 500,000 Fibonacci calculations comparing JS to Rust WASM execution speeds.

---

## Production Build & Web Store Submission

### 1. Compile Optimized Binary
Run the compilation script. `wasm-pack` compiles optimized release files using `--release` and compresses the final binary size using `wasm-opt`.
```bash
./build.sh
```

### 2. Package for Store Submission
Exclude raw Rust code, cargo configurations, and git files. Create a deployment ZIP containing only:
```bash
zip -r extension.zip manifest.json rules.json *.html *.css *.js wasm/pkg/*.js wasm/pkg/*_bg.wasm components/
```

### 3. Submission Notes
- **Remote WASM Forbidden**: In Manifest V3, WebAssembly binaries must be bundled locally inside your extension package.
- **Permission Justification**: Under the Developer Console, explain why the extension requires `sidePanel`, `alarms`, `offscreen`, and `declarativeNetRequest`.
- **Rust Source Code Audit**: Because WASM compiles down to binary bytecode, the Chrome Web Store review team may perform a manual security audit. State in your submission description that the WASM module is compiled from a Rust source code repository to run local math/list manipulation logic. Keep your Rust source code repository accessible in case reviewers ask for access to complete the security review.
