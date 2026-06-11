# Unified Rust-WASM Chrome Extension Starter (EXBA)

A high-performance, Manifest V3 Chrome Extension powered by **Rust**, **WebAssembly**, and the **EXBA (Extended Browser API)** framework. This boilerplate avoids heavy SPA frameworks in favor of browser-native primitives and a high-performance Rust core.

---

## 🚀 Key Architectural Features

-   **Zero-Framework UI**: Uses native **Web Components** (Shadow DOM) and the **EXBA** framework for true encapsulation without the "framework tax."
-   **Custom Reactivity Primitives**: A bespoke, lightweight reactivity system (Signals & Effects) implemented from scratch in `lib/reactivity.ts`. This ensures zero external dependencies and full control over the rendering lifecycle.
-   **Rust-WASM Core**: Offloads heavy computation (fuzzy matching, cryptography, algorithms) to a compiled Rust engine.
-   **Manifest V3 Ready**: Fully compliant with the latest Chrome extension standards, including Service Workers and Offscreen Documents.
-   **Type-Safe APIs**: Includes a promisified, type-safe wrapper for Chrome APIs (`lib/chrome.ts`).

---

## 🛠️ Integrated Demos

1.  **Reactive Dashboard**: A searchable grid of extension tools. Typing in the search bar triggers subsequence-based fuzzy matching in **Rust**, which reactively filters the UI via **Signals**.
2.  **Security Suite**:
    *   **Password Generator**: Cryptographically secure generation performed in Rust using the `getrandom` crate.
    *   **SHA-256 Hasher**: High-speed hashing using the Rust `sha2` crate.
3.  **Performance Benchmarking**: A JS vs. Rust Fibonacci comparison tool to demonstrate WASM execution speed.
4.  **Background Alarms & Sidebar**: Service worker-managed alarms that push real-time updates to a persistent Sidebar Monitor.
5.  **Offscreen Clipboard**: Accesses the System Clipboard from a Service Worker context using an Offscreen Document.
6.  **Network Filtering**: Demonstrates `declarativeNetRequest` for blocking trackers and modifying request headers.

---

## 📦 Directory Structure

```text
├── src/
│   ├── background.ts       # Service worker handling alarms & Offscreen Document
│   ├── content.ts          # Page script for DOM manipulation & Sidebar Panel
│   ├── offscreen.ts        # Service worker clipboard helper
│   ├── options.ts          # Options configuration script
│   ├── sidepanel.ts        # Sidebar Monitor script
│   ├── popup.ts            # Extension action popup script
│   ├── components/         # Reactive Web Components
│   │   ├── wasm-dashboard.ts # Main UI with fuzzy search & security tools
│   │   └── wasm-benchmark.ts # JS vs Rust speed comparison
│   └── lib/                # Shared utilities, reactivity engine, & framework
│       ├── chrome.ts       # Type-safe Chrome API wrappers
│       ├── reactivity.ts   # Custom zero-dependency reactivity system (Signals)
│       ├── framework.ts    # EXBA framework base class (ExbaElement)
│       └── ui.ts           # UI helper utilities
├── wasm/                   # Rust Core Crate
│   ├── src/lib.rs          # Core logic, state management, & algorithms
│   └── Cargo.toml          # Rust dependencies (sha2, getrandom, serde)
├── public/                 # Static assets & HTML templates
│   ├── manifest.json       # Extension configuration
│   └── *.html              # Page HTML templates
├── dist/                   # Compiled & bundled output (load this in Chrome)
├── rsbuild.config.ts       # Extension-specific bundling configuration
└── build.sh                # Unified build script (Rust + TS)
```

---

## 🛠️ Installation & Local Setup

Follow these steps to get the EXBA extension running on your local machine for development.

### 1. Prerequisites
Ensure you have the following tools installed:
- **Node.js** (v18+) or **Bun**
- **Rust & Cargo** (Latest stable)
- **wasm-pack**: For compiling Rust to WebAssembly.
  ```bash
  cargo install wasm-pack
  ```

### 2. Prepare the Workspace
Clone the repository and install the necessary Node dependencies:
```bash
npm install
```

### 3. Build the Extension
The project uses a unified build script that compiles the Rust core to WASM and bundles the TypeScript/CSS assets into a production-ready format.
```bash
# Make the script executable (first time only)
chmod +x build.sh

# Run the unified build
./build.sh
```
This will create a `dist/` directory in the root. **This directory is your actual extension.**

### 4. Load into Google Chrome
1. Open Google Chrome and navigate to: `chrome://extensions/`
2. In the top-right corner, toggle the **Developer mode** switch to **ON**.
3. Click the **Load unpacked** button that appears in the top-left.
4. Select the `dist/` folder from this project directory.
5. (Optional) Click the **Puzzle Piece** icon in your Chrome toolbar and **Pin** the extension for easy access.

---

## 🔄 Development Workflow

-   **Modify Rust logic**: Edit `wasm/src/lib.rs` and run `./build.sh` to recompile.
-   **Modify UI/TS**: Edit files in `src/` and run `./build.sh` to rebuild the bundle.
-   **Apply Changes**: After rebuilding, go to `chrome://extensions/` and click the **Refresh icon** on the extension card to load the new code.

---

## 🧪 Testing Suite

The project includes a comprehensive testing suite covering all layers:

-   **TypeScript/JS (Vitest)**: Tests extension logic, Chrome wrappers, and Web Components.
    ```bash
    npm test
    ```
-   **Rust Core (wasm-pack)**: Unit tests for WASM algorithms.
    ```bash
    npm run test:wasm
    ```

---

## 🛡️ Security & WASM Policy
Google Chrome's Manifest V3 requires all WASM to be local:
- The WASM binary is bundled inside the extension (no remote loading).
- CSP includes `'wasm-unsafe-eval'` for local WASM execution.
- Reviewers are informed that WASM is used for client-side compute (cryptography/matching).
