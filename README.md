# Unified Rust-WASM Chrome Extension Starter (EXBA)

A high-performance, Manifest V3 Chrome Extension powered by **Rust**, **WebAssembly**, and the **EXBA (Extended Browser API)** framework. This boilerplate avoids heavy SPA frameworks in favor of browser-native primitives, a custom reactivity engine, and a high-performance Rust core.

---

## 🚀 Key Architectural Features

-   **Zero-Framework UI**: Uses native **Web Components** (Shadow DOM) and the **EXBA** framework base class (`ExbaElement` inside `src/lib/framework.ts`) for true encapsulation without the "framework tax."
-   **Custom Reactivity Primitives**: A bespoke, lightweight reactivity system (Signals, Effects, Computeds & Watches) implemented from scratch in `src/lib/reactivity.ts`. This ensures zero external dependencies and full control over the rendering lifecycle.
-   **Security & CSP Compliance**: Clean, script-free HTML templates in `public/` mapped to modular compiled entry scripts in `src/` (such as `popup.ts`, `options.ts`, `sidepanel.ts`). This strictly complies with Manifest V3's ban on inline scripts.
-   **Rust-WASM Core**: Offloads heavy computations (fuzzy subsequence matching, cryptography, algorithms) to a compiled Rust engine inside the `wasm/` directory.
-   **Local Integration Launcher**: An automated launcher (`run-browser.sh`) that auto-detects `chromium`, `brave`, or `google-chrome` and spins up a dedicated development session with an isolated, persistent profile (`.chrome-profile/`).
-   **Injected EXBA Command Bar (Dock)**: A floating macOS-like glassmorphic dock injected on target webpage layouts. Includes quick-trigger controls, settings navigation, panel toggling, and minimizes into a pinned circular **EXBA** badge.
-   **Native Chrome Side Panel**: Pinned toolbar action clicks (`openPanelOnActionClick: true`) and right-click Context Menus ("Toggle EXBA Panel") launch the native side panel directly, housing the reactive search dashboard.
-   **Manifest V3 Ready**: Fully compliant with MV3 standards, including Service Workers, Declarative Net Request rules, and Offscreen Documents.

---

## 🛠️ Integrated Demos

1.  **Reactive Dashboard**: A searchable grid of extension tools. Typing in the search bar triggers subsequence-based fuzzy matching in **Rust**, which reactively filters the UI via **Signals**.
2.  **EXBA Command Bar**: Injected on webpages to toggle the side panel, open settings, or collapse into a minimized badge.
3.  **Security Suite**:
    *   **Password Generator**: Cryptographically secure generation performed in Rust using the `getrandom` crate.
    *   **SHA-256 Hasher**: High-speed hashing using the Rust `sha2` crate.
4.  **Performance Benchmarking**: A JS vs. Rust Fibonacci comparison tool to demonstrate WASM execution speed.
5.  **Background Alarms**: Service worker-managed alarms that push real-time updates to open extension pages.
6.  **Offscreen Clipboard**: Accesses the System Clipboard from a Service Worker context using an Offscreen Document.
7.  **Network Filtering**: Demonstrates `declarativeNetRequest` for blocking advertising trackers (e.g. doubleclick.net) and modifying request headers.

---

## 📦 Directory Structure

```text
├── src/
│   ├── background.ts       # Service worker handling alarms, clipboard, & navigation
│   ├── content.ts          # Injects the floating Command Bar & collapsed Badge into webpage DOM
│   ├── offscreen.ts        # Service worker clipboard helper
│   ├── options.ts          # Options configurations script & benchmark triggers
│   ├── sidepanel.ts        # Sidebar Dashboard entry script
│   ├── popup.ts            # Extension action popup entry script
│   ├── components/         # Reactive Web Components
│   │   ├── wasm-dashboard.ts # Main UI with fuzzy search & security tools
│   │   └── wasm-benchmark.ts # JS vs Rust speed comparison
│   └── lib/                # Shared utilities, reactivity engine, & framework
│       ├── chrome.ts       # Type-safe Chrome API wrappers
│       ├── reactivity.ts   # Custom zero-dependency reactivity system (Signals)
│       ├── framework.ts    # EXBA framework base class (ExbaElement)
│       └── ui.ts           # UI helper utilities (Spinner, EscapeHTML)
├── wasm/                   # Rust Core Crate
│   ├── src/lib.rs          # Core logic, state management, & algorithms
│   └── Cargo.toml          # Rust dependencies (sha2, getrandom, serde)
├── public/                 # Static assets & HTML templates
│   ├── manifest.json       # Extension configuration (permissions, DNR, commands)
│   └── *.html              # Page HTML templates (dynamically compiled by Rsbuild)
├── dist/                   # Compiled & bundled output (load this in Chrome)
├── rsbuild.config.ts       # Extension-specific bundling configuration
└── build.sh                # Unified build script (Rust + TS)
```

---

## 🛠️ Installation & Local Setup

Follow these steps to get the EXBA extension running on your local machine for development.

### 1. Prerequisites
Ensure you have the following tools installed:
- **Bun** (Latest stable)
- **Rust & Cargo** (Latest stable)
- **wasm-pack**: For compiling Rust to WebAssembly.
  ```bash
  cargo install wasm-pack
  ```

### 2. Prepare the Workspace
Clone the repository and install the necessary dependencies:
```bash
bun install
```

### 3. Build & Run the Extension
The project uses a unified build script and launcher to make local integration frictionless.

```bash
# Run the dev server to watch and recompile changes in real-time
bun run dev

# (In a separate terminal) Launch Chromium with the extension loaded and isolated profile
bun run browser
```
This automatically targets `chromium`, `chromium-browser`, `google-chrome-stable`, or `brave-browser` and loads the extension.

---

## 🔄 Development Workflow

-   **Modify Rust logic**: Edit `wasm/src/lib.rs` and run `bun run build` or `./build.sh` to compile the core.
-   **Modify UI/TS/CSS**: Edit files in `src/` (e.g. components or layout stylesheets). The running `bun run dev` server will write updates directly to `dist/` instantly.
-   **Apply Changes**: In your development browser window, the extension updates automatically. If changes are not immediately visible, click the **Reload** icon on the extension's card under `chrome://extensions`.

---

## 🧪 Testing Suite

The project includes a comprehensive testing suite covering all layers:

-   **TypeScript/JS (Vitest)**: Tests extension logic, Chrome wrappers, and Web Components.
    ```bash
    bun test
    ```
-   **Rust Core (wasm-pack)**: Unit tests for WASM algorithms.
    ```bash
    bun run test:wasm
    ```

---

## 🛡️ Security & WASM Policy
Google Chrome's Manifest V3 requires all WASM to be local:
- The WASM binary is bundled inside the extension (no remote loading).
- CSP includes `'wasm-unsafe-eval'` for local WASM execution.
- Reviewers are informed that WASM is used for client-side compute (cryptography/matching).
