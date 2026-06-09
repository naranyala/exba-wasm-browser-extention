# Chrome Extensions Development Workspace

Welcome to your clean Chrome Extension development environment! This repository has been slimmed down and consolidated into just **4 premium, high-quality boilerplate templates** covering basic extension mechanics, advanced browser APIs, and custom Rust + WebAssembly integrations.

---

## 1. Project Directory Structure

```text
exba-browser-extention/
├── package.json              # Workspace configuration & script tooling (Bun)
├── bun.lock                  # Bun lockfile (dependencies)
├── eslint.config.js          # Shared ESLint configuration
├── architecture_suggestions.md # Architecture recommendations (monorepo & abstractions)
│
├── classic-extension-demo/    # 1. Standard extension boilerplate (Vanilla JS)
│   ├── manifest.json         # Extension configs (Storage & Scripting permissions)
│   ├── popup.html / js       # Popup UI and page color-changer trigger
│   ├── options.html / js     # Options page config panel
│   ├── content.js            # Auto-applies custom colors to loaded pages
│   └── background.js         # Service Worker logging installer
│
├── advanced-apis-demo/       # 2. Sidepanel, Alarms, Offscreen, and DNR filters
│   ├── manifest.json         # Extension configs (DNR rules & Sidepanel)
│   ├── sidepanel.html / js   # Persistent side panel showing logs & test links
│   ├── offscreen.html / js   # Invisible DOM context used for Clipboard writes
│   ├── background.js         # Manages Alarms and Offscreen Document creation
│   └── rules.json            # Declarative Net Request rules (blocks doubleclick.net)
│
├── rust-wasm-starter/        # 3. Rust-WASM Extension starter (target: web)
│   ├── manifest.json         # Configured for module worker & 'wasm-unsafe-eval' CSP
│   ├── popup.html / js       # Popup UI interacting with Rust logic
│   ├── options.html / js     # Options page with JS vs WASM speed benchmark
│   ├── build.sh              # One-click shell script to compile Rust to WASM
│   └── wasm/                 # Rust package (Greeting, Fibonacci, Text processor)
│
└── wasm-web-component-framework/ # 4. WASM-Backed Web Components framework
    ├── index.html            # Hosts multiple isolated Custom Element instances
    ├── framework.js          # WasmElement base class bridging JS & Rust
    ├── components/           # Custom elements inheriting WasmElement
    ├── build.sh              # Script compiling the framework WASM core
    └── wasm/                 # Rust core state engine and HTML layout generator
```

---

## 2. Local Development Setup

To build and run extensions in this repository, set up the prerequisites below.

### Prerequisites
- **Bun**: Install the lightweight JS runtime (e.g., `curl -fsSL https://bun.sh/install | bash`).
- **Rust & Cargo**: Install Rust (e.g., `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`).
- **wasm-pack**: Install the compiler for compiling Rust to WebAssembly:
  ```bash
  cargo install wasm-pack
  ```

### Install Tooling Dependencies
Install the ESLint and Prettier dependencies configured at the workspace root:
```bash
bun install
```

### Formatting & Linting
Verify code quality and automatically apply formatting:
```bash
bun run lint      # Run ESLint validation
bun run lint:fix  # Fix spacing, semicolons, and styling issues
bun run prettier  # Format markdown, html, and json files
```

---

## 3. Developing and Testing Locally

### How to Load an Extension in Chrome
1. Open Google Chrome and go to `chrome://extensions/`.
2. Toggle on **Developer mode** (top-right corner).
3. Click **Load unpacked** (top-left corner).
4. Select one of the extension directories (e.g. `classic-extension-demo`, `advanced-apis-demo`, or `rust-wasm-starter`).

### Building WASM Modules
For the WASM-based projects, run the local build script to compile Rust to WebAssembly bindings:
- **Rust-WASM Starter**:
  ```bash
  cd rust-wasm-starter && ./build.sh
  ```
- **WASM Web Component Framework**:
  ```bash
  cd wasm-web-component-framework && ./build.sh
  ```
  *Note: Because Web Components load WASM as ES modules, you must run `index.html` via a local web server due to CORS constraints (e.g. run `bunx serve .` inside `wasm-web-component-framework`)*.

---

## 4. Production Build & Publishing Process

When you are ready to publish your extension to the Chrome Web Store:

### Step 1: Compile Production WASM
Run the compilation scripts. By default, `wasm-pack` compiles optimized release builds using `--release` and automatically runs `wasm-opt` to compress the final binary size.

### Step 2: Bundle the Extension (Zipping)
Do not package development source files (like raw Rust code, Cargo files, or `.git` files) into your store upload. You only need the distribution assets.
Create a production ZIP containing only:
- `manifest.json`
- `*.html`, `*.css`, `*.js`
- `wasm/pkg/*.js`
- `wasm/pkg/*_bg.wasm`
- Any extension icons/images (e.g., `images/`)

You can create this bundle using a command like:
```bash
zip -r extension.zip manifest.json *.html *.css *.js wasm/pkg/*.js wasm/pkg/*_bg.wasm
```

### Step 3: Chrome Web Store Submission
1. Go to the [Chrome Web Store Developer Console](https://chrome.google.com/webstore/devconsole).
2. Click **New Item** and upload your `extension.zip` file.
3. Fill in store listing metadata (Description, Category, Screenshots, Promo tile, etc.).
4. Under **Privacy Practices**, justify all requested permissions.

### Step 4: WebAssembly Security & Review Policy Compliance
Google Chrome's Manifest V3 security model strictly regulates code execution:
- **No Remote WASM**: The WASM file **must be local** and bundled inside your uploaded `.zip`. Loading WASM from external URLs or compile-on-the-fly is completely prohibited in MV3.
- **CSP Permissions**: The `'wasm-unsafe-eval'` CSP is explicitly allowed for local files.
- **Reviewer Justification**: When submitting an extension containing WASM, the Chrome review team may subject it to a more rigorous, manual review to ensure the binary code is safe (since WASM can obfuscate functionality).
  - *Best Practice*: In the **Single Purpose and Permission Justification** section of your submission, note that the extension uses a local WebAssembly module compiled from Rust to perform safe client-side compute tasks (like cryptography, encryption, or math).
  - *Note*: Be prepared to provide access to the original Rust source code repository if the reviewer requests it to audit the compiled binary.
