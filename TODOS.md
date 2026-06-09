# Extension Development Roadmap & TODOs

This document tracks upcoming features, enhancements, and tasks to transition this flat, unified starter into a production-ready WebExtension.

---

## 📅 Roadmap Tasks

### Phase 1: JS Bundling with Bun (`Bun.build`)

Since we have added NPM packages (`webextension-polyfill`, `webext-bridge`, etc.), we need a bundling step to resolve node modules in our JS files before loading the extension.

- [ ] Create a root `bundle.js` script utilizing Bun's built-in bundler (`Bun.build`).
- [ ] Write logic in `bundle.js` to compile input entry points (`popup.html`, `options.js`, `sidepanel.js`, `background.js`, `content.js`, `offscreen.js`) into a `dist/` output folder.
- [ ] Automatically copy HTML, CSS, manifest, and compiled WASM packages (`wasm/pkg/`) into the `dist/` directory during bundling.
- [ ] Update `package.json` with a `"build": "bun run bundle.js"` script.

### Phase 2: Integrate Promise-Based Polyfill & Typed Messaging

Upgrade extension communication to use our newly installed helper packages.

- [ ] Replace callback-based `chrome.*` calls with promise-based `browser.*` calls imported from `webextension-polyfill`.
- [ ] Migrate raw `chrome.runtime.sendMessage` and `chrome.runtime.onMessage.addListener` blocks to typed routing paths using `webext-bridge`.
- [ ] Setup type-safe packet structures in JavaScript to ensure messages are correctly dispatched.

### Phase 3: Automatic Settings Synchronization

Simplify options saving and restore using `webext-options-sync`.

- [ ] Add `webext-options-sync` listener in `options.js` to automatically bind options forms (`#default-color`, `#auto-apply`) with `chrome.storage.sync`.
- [ ] Remove boilerplate click handlers for saving options from `options.js` and let the syncing package manage storage states.

### Phase 4: Extend Rust WebAssembly Engine

Expand the Rust WASM core to tackle computationally demanding logic.

- [ ] Implement a custom string parsing, indexing, or tokenizing engine inside `wasm/src/lib.rs` (useful for content script scraper helpers).
- [ ] Add a cryptography utility (e.g. encrypting/decrypting input strings in Rust via AES/SHA) and expose it to the popup dashboard.
- [ ] Benchmark heavy encryption tasks in JS vs Rust WASM.

### Phase 5: CI/CD Packaging & Deployment

Automate store submission.

- [ ] Create a bash/JS script to package active distribution files (excluding `wasm/src`, cargo builds, `.git`) into a compressed `extension.zip`.
- [ ] Write a GitHub Actions workflow that triggers on git tags to run `bun install`, `wasm-pack build`, bundle scripts, and automatically upload the release `.zip` to the Chrome Web Store using `chrome-webstore-upload`.
