# Unified Rust-WASM Chrome Extension Starter

Welcome to your Chrome Extension development workspace! This entire repository serves as a **single flat Chrome Extension starter project** powered by the **Bun JavaScript runtime** and a **Rust + WebAssembly** core engine. It integrates standard and advanced Chrome Extension APIs into a single project, using modern browser-native Web Components backed by Rust.

---

## 1. Directory Structure

```text
exba-browser-extention/   # The root directory is the unpacked extension itself!
├── manifest.json         # Extension Manifest V3 configuration (CSP & permissions)
├── rules.json            # Declarative Net Request filtering rules
├── styles.css            # Shared glassmorphic UI stylesheet (Popup, Options, Sidepanel)
├── framework.js          # Base WasmElement class mapping Custom Elements to Rust (with skeleton loaders)
├── build.sh              # Bash script to compile Rust core to WASM
│
├── popup.html            # Default popup entry point
├── options.html          # Extension options page
├── options.js            # Initializer for options and loop speed benchmark
├── sidepanel.html        # Persistent sidebar UI
├── sidepanel.js          # Sidebar interaction script
├── content.js            # Page script auto-applying storage styling
├── background.js         # Service worker handling alarms & Offscreen Document
├── offscreen.html / js   # Offscreen helper page for Clipboard copy tasks
│
├── components/           # JavaScript Web Component wrappers
│   ├── wasm-dashboard.js # Custom Element for <wasm-dashboard> (Fuzzy Search Grid)
│   └── wasm-benchmark.js # Custom Element for <wasm-benchmark> (Options benchmark)
│
├── wasm/                 # Rust Core Crate
│   ├── Cargo.toml        # Rust dependencies (wasm-bindgen-futures, js-sys, serde)
│   └── src/
│       └── lib.rs        # Core state, mutators, fuzzy search, and HTML templates
│
├── TODOS.md              # Project roadmap, bundling, and upload tasks
├── package.json          # Workspace configuration & script tooling (Bun)
├── bun.lock              # Bun lockfile (dependencies)
├── eslint.config.js      # Shared ESLint configuration
└── .gitignore            # Clean gitignore (ignores IDE, target/ builds)
```

---

## 2. Integrated Features & Demos

This boilerplate features a fully functional showcase of Chrome Extension capabilities:

1. **Native Web Components (`WasmElement`)**: The popup and options UIs are native Web Components (Shadow DOM) that delegate state and layout templates to Rust.
2. **Fuzzy Search Card Grid**: The popup renders a 2-column grid selector of extension features. Typing in the search input triggers a subsequence-matching fuzzy search in Rust that filters cards in real-time, utilizing partial DOM updates to preserve keyboard focus.
3. **Asynchronous Rust Futures**: Exposes an async Rust function (`run_async_task`) that instantiates a JavaScript timer Promise and awaits it asynchronously inside Rust using `wasm-bindgen-futures`.
4. **Chrome Storage Sync**: Popup and Options synchronize user settings (favorite color themes) using `chrome.storage.local`.
5. **Background Alarms**: The service worker creates a recurring background timer that fires once per minute and pushes timestamps directly to the Side Panel.
6. **Offscreen Document (Clipboard API)**: Creates a temporary offscreen document to write text to the user's system clipboard (bypassing service worker DOM limitations).
7. **Declarative Net Request**: Blocks specific tracking domains (like `doubleclick.net`) and appends custom headers (`X-Extension-Header`) to HTTP requests going to `httpbin.org`.

---

## 3. Local Development Setup

To build and run the extension locally:

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

## 4. Developing and Testing Locally

### 1. Compile the WASM Core

Whenever you modify Rust code in `wasm/src/lib.rs`, run the compile script from the root:

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
5. Select the **root directory** of this repository (`exba-browser-extention`).

---

## 5. Production Build & Publishing Process

When you are ready to publish your extension to the Chrome Web Store:

### Step 1: Compile Optimized Release WASM

Run the compilation script. By default, `wasm-pack` compiles optimized release builds using `--release` and automatically runs `wasm-opt` to compress the final binary size.

```bash
./build.sh
```

### Step 2: Bundle the Extension (Zipping)

Do not package development source files (like raw Rust code, Cargo files, or `.git` files) into your store upload. You only need the distribution assets.
Create a production ZIP containing only:

- `manifest.json`
- `rules.json`
- `*.html`, `*.css`, `*.js`
- `wasm/pkg/*.js`
- `wasm/pkg/*_bg.wasm`
- `components/`
- Any extension icons/images (e.g., `images/`)

You can create this bundle using a command like:

```bash
zip -r extension.zip manifest.json rules.json *.html *.css *.js wasm/pkg/*.js wasm/pkg/*_bg.wasm components/
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
  - _Best Practice_: In the **Single Purpose and Permission Justification** section of your submission, note that the extension uses a local WebAssembly module compiled from Rust to perform safe client-side compute tasks (like cryptography, encryption, or math).
  - _Note_: Be prepared to provide access to the original Rust source code repository if the reviewer requests it to audit the compiled binary.

---

## 6. Next Steps & Todos

For upcoming task lists, bundling scripts, options forms synchronization, and automated publishing integration, see [TODOS.md](file:///media/naranyala/Data/projects-remote/exba-browser-extention/TODOS.md).
