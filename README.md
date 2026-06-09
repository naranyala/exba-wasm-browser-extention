# Unified Rust-WASM Chrome Extension Starter

Welcome to your clean Chrome Extension development environment! This entire repository serves as a **single flat Chrome Extension starter project** powered by the **Bun JavaScript runtime** and a **Rust + WebAssembly** core engine.

---

## 1. Project Directory Structure

```text
exba-browser-extention/   # The root directory is the unpacked extension itself!
├── manifest.json         # Extension Manifest V3 configuration
├── rules.json            # Declarative Net Request filtering rules
├── styles.css            # Shared glassmorphic UI stylesheet
├── framework.js          # Base WasmElement class mapping Custom Elements to Rust
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
│   ├── wasm-dashboard.js # Wraps `<wasm-dashboard>` (Popup dashboard UI)
│   └── wasm-benchmark.js # Wraps `<wasm-benchmark>` (Options benchmark UI)
│
├── wasm/                 # Rust Core Crate
│   ├── Cargo.toml        # Rust dependencies (serde, serde_json, web-sys)
│   └── src/
│       └── lib.rs        # Core state, mutators, and layout render templates
│
├── architecture_suggestions.md # Architecture recommendations (monorepo & abstractions)
├── package.json          # Workspace configuration & script tooling (Bun)
├── bun.lock              # Bun lockfile (dependencies)
├── eslint.config.js      # Shared ESLint configuration
└── .gitignore            # Clean gitignore (ignores IDE, target/ builds)
```

---

## 2. Local Development Setup

To build and run the extension locally, configure the prerequisites below.

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

### 3. Verify & Debug APIs

- **Popup UI**: Click the extension icon. The popup uses the `<wasm-dashboard>` Web Component powered by Rust, maintaining a count value and an interactive task list.
- **Side Panel**: Right-click the extension icon and select **Open side panel** (or click the icon if configured to open sidepanel directly). Type a string and click **Copy** to test clipboard writes via the Offscreen Document.
- **Alarms**: Keep the sidepanel open. Once a minute, the background alarm fires and pushes the timestamp event directly to the sidepanel list.
- **Network rules**: Click the links in the sidepanel. Notice that `doubleclick.net` blocks successfully, and requests to `https://httpbin.org/headers` include the custom header `X-Extension-Header: WasmUnifiedDemo`.
- **Options Benchmark**: Right-click the extension icon and choose **Options**. Set your favorite colors, and click **Run Speed Test** to run 500,000 Fibonacci calculations comparing JS to Rust WASM execution speeds.

---

## 4. Production Build & Publishing Process

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
