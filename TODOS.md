# Extension Development Roadmap & TODOs

This document tracks completed milestones and upcoming features for this high-performance Rust-WASM extension.

---

## ✅ Completed Milestones

### Architecture & Framework
- [x] **EXBA Framework**: Developed the `ExbaElement` (Extended Browser API) base class for high-performance Shadow DOM encapsulation.
- [x] **Signal Reactivity**: Developed a custom, zero-dependency reactivity system (Signals & Effects) in `src/lib/reactivity.ts`.
- [x] **Rust-WASM Integration**: Established a bidirectional state-sync bridge between TypeScript and Rust.
- [x] **Bundling & Build System**: Configured Rsbuild for Manifest V3 and created a unified `build.sh` script.
- [x] **Codebase Reorganization**: Relocated general library modules and framework classes inside `src/lib/` to isolate code compiler targets and strictly satisfy Manifest V3 CSP constraints.
- [x] **CSP-Compliant Entry Points**: Separated HTML templates from scripting files, compiling page initializers (e.g. `popup.ts`, `sidepanel.ts`) without inline script violations.

### Features & Demos
- [x] **Fuzzy Search Dashboard**: Subsequence matching engine implemented in Rust and rendered via reactive signals.
- [x] **Security Suite**: Implemented SHA-256 hashing and cryptographically secure password generation in Rust.
- [x] **Performance Benchmarks**: CPU-intensive Fibonacci benchmark comparison between JS and WASM.
- [x] **Advanced Chrome APIs**: Implemented Background Alarms, SidePanel integration, and Offscreen Document clipboard access.
- [x] **Network Filtering**: Added `declarativeNetRequest` rules for tracking blocking and request header injection.
- [x] **Injected EXBA Command Bar (Dock)**: Developed a webpage-level macOS-style glassmorphic command bar (dock) that slides open the dashboard, opens settings, and collapses into a minimized badge.
- [x] **Direct Toolbar launch**: Configured browser action click (`openPanelOnActionClick: true`) to open the native side panel directly, housing the reactive search dashboard.

### Reliability & Testing
- [x] **Type-Safe Wrappers**: Built a promisified Chrome API wrapper in `src/lib/chrome.ts`.
- [x] **Testing Suite**: 
    - [x] Vitest/JSDOM for TypeScript & Web Components.
    - [x] wasm-pack test for Rust algorithms.
- [x] **Linting & Formatting**: Configured Biome for high-speed code quality checks.
- [x] **Chromium Dev Launcher**: Scripted `run-browser.sh` with Chromium/Brave/Chrome automatic detection and persistent local session profiling.

---

## 📅 Upcoming Roadmap

### Phase 1: Enhanced State Synchronization
- [ ] **Binary State Bridge**: Explore Bincode or ProtoBuf for state synchronization instead of JSON strings to further reduce boundary overhead.
- [ ] **Partial Sync**: Implement a system to sync only modified state fields from Rust to TS.

### Phase 2: User Experience Enhancements
- [ ] **Internationalization (i18n)**: Integrate `chrome.i18n` with the Rust core to support multi-language dashboards.
- [ ] **Advanced Component Library**: Build more reusable reactive components (buttons, inputs, sliders) that map directly to Rust mutators.

### Phase 3: Content Script Power-ups
- [ ] **WASM Content Scrapers**: Move complex DOM parsing and data extraction logic from `content.ts` into WASM for higher performance on data-heavy pages.
- [ ] **Dynamic Injection Toggle**: Allow toggling the visibility of the injected floating Command Bar itself from the browser settings.

### Phase 4: CI/CD & Deployment
- [ ] **Automated Packaging**: Create a production-ready CI script to zip only the `dist/` artifacts.
- [ ] **GitHub Actions**: Automated test runs on PR and automated Web Store uploads on tagged releases.
