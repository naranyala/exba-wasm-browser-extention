# Extension Development Roadmap & TODOs

This document tracks completed milestones and upcoming features for this high-performance Rust-WASM extension.

---

## ✅ Completed Milestones

### Architecture & Framework
- [x] **EXBA Framework**: Developed the `ExbaElement` (Extended Browser API) base class for high-performance Shadow DOM encapsulation.
- [x] **Signal Reactivity**: Developed a custom, zero-dependency reactivity system (Signals & Effects) in `lib/reactivity.ts`.
- [x] **Rust-WASM Integration**: established a bidirectional state-sync bridge between TypeScript and Rust.
- [x] **Bundling & Build System**: Configured Rsbuild for Manifest V3 and a unified `build.sh` script.

### Features & Demos
- [x] **Fuzzy Search Dashboard**: Subsequence matching engine implemented in Rust and rendered via reactive signals.
- [x] **Security Suite**: Implemented SHA-256 hashing and cryptographically secure password generation in Rust.
- [x] **Performance Benchmarks**: CPU-intensive Fibonacci benchmark comparison between JS and WASM.
- [x] **Advanced Chrome APIs**: Implemented Background Alarms, SidePanel integration, and Offscreen Document clipboard access.
- [x] **Network Filtering**: Added `declarativeNetRequest` rules for tracking blocking and request header injection.

### Reliability & Testing
- [x] **Type-Safe Wrappers**: Built a promisified Chrome API wrapper in `lib/chrome.ts`.
- [x] **Testing Suite**: 
    - [x] Vitest/JSDOM for TypeScript & Web Components.
    - [x] wasm-pack test for Rust algorithms.
- [x] **Linting & Formatting**: Configured Biome for high-speed code quality checks.

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
- [ ] **Shadow DOM UI injection**: Inject the reactive Dashboard UI directly into web pages via Content Scripts.

### Phase 4: CI/CD & Deployment
- [ ] **Automated Packaging**: Create a production-ready CI script to zip only the `dist/` artifacts.
- [ ] **GitHub Actions**: Automated test runs on PR and automated Web Store uploads on tagged releases.
