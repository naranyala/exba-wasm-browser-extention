# Extension Development Roadmap & TODOs

This document tracks the development of the EXBA meta-framework and the extension built on top of it.

---

## ✅ Completed Milestones

### Meta-Framework Core

#### Reactivity System (`src/lib/reactivity.ts`)
- [x] `Signal<T>` — reactive value container with auto-tracking via `activeSubscriber` global
- [x] `computed(fn)` — lazy derived value, re-computes only when dependencies change
- [x] `effect(fn)` — side-effect that subscribes to every signal read during execution
- [x] `watch(source, cb, options?)` — observe signal changes with optional immediate fire
- [x] `batch(fn)` — coalesce multiple signal writes into a single notification cycle
- [x] `untrack(fn)` — execute a function without tracking signal reads
- [x] `createStore(initial)` — **deep reactive proxy**: each property is an independent tracked signal; reading `store.foo` only tracks `foo`

#### Rendering Primitives (`src/lib/render.ts`)
- [x] `createShow({ mount, when, children, fallback? })` — conditional DOM create/destroy
- [x] `createFor({ mount, each, keyed?, children })` — keyed list rendering with DOM reuse; **updates DOM content** when existing items change via stable comment anchors
- [x] `createBindValue(el, get, set)` — two-way reactive input binding
- [x] `createClassList(el, classes)` — reactive conditional class toggling via `classList.toggle`
- [x] `createRef(initial?)` — mutable `{ current }` container for DOM element references (not reactive)
- [x] `html` — tagged template literal that produces a `DocumentFragment` from an HTML string

#### Context API (`src/lib/context.ts`)
- [x] `createContext<T>(defaultValue)` — define a typed context key
- [x] `provideContext(key, value)` — stack-based value provision; returns dispose
- [x] `useContext(key)` — walk up the context stack, return nearest value or default

#### WASM Integration Layer
- [x] `WasmClient` — typed reactive wrapper around CoreEngine with `call()`, `pullState()`, `pushState()`, `pushPartial()`, `onKeyChange()`, `onAnyChange()`, `validate()`, `drainEvents()`, auto-sync
- [x] `WasmEventBus` — reactive event stream with module/event-name/wildcard subscriptions
- [x] `wasm-bridge.ts` — low-level helpers: `loadWasmModule`, `dispatchAction`, `drainEvents`, `syncStateFromRust`, `syncStateToRust`, `getStateValue`, `setStateValue`, `validateState`
- [x] Typed action dispatch with generics
- [x] Fine-grained state key subscriptions (only re-render on changed keys)
- [x] Module manifest cache with schema validation
- [x] Patch-based state diffing
- [x] Auto-sync loop (optional requestAnimationFrame-based polling)

#### Component System
- [x] `ExbaElement<TState>` — shadow DOM base class with WASM init, state sync, signal bindings, lifecycle hooks
- [x] `createWasmComponent(config)` — factory for ergonomic component definition
- [x] Lifecycle hooks: `onMounted`, `onUnmounted`, `setupEffects`, `bindEvents`, `render`
- [x] Reactive binding helpers: `bindText`, `bindAttr`, `bindStyle`, `bindList`
- [x] Event helper with auto state sync: `on(sel, event, handler)`
- [x] Shadow DOM query shortcuts: `$(sel)`, `$$(sel)`
- [x] Advanced rendering on ExbaElement: `show()`, `for()`, `bindValue()`, `toggleClass()`, `createStore()`, `createRef()`, `untrack()`, `provideContext()`, `useContext()`

#### Rust Module System (`wasm/src/`)
- [x] `ModuleDef` — static module definitions with metadata, state_keys, optional `ActionHandler`
- [x] Dynamic action dispatch: `dispatch_action(module, action, params)` routes to correct module
- [x] Event system: modules emit `ModuleEvent { module, name, data }` during action handling; JS drains via `drain_events()`
- [x] Structured errors: `ModuleError { code, message, details }`
- [x] State as dynamic `Map<String, Value>` — fully extensible without Rust recompilation
- [x] 12 backward-compat convenience methods on CoreEngine
- [x] `scaffold-module.sh` — generates Rust module + TypeScript Web Component
- [x] `gen-wasm-types.ts` — auto-generates `wasm-types.d.ts` from wasm-bindgen

#### Developer Tools
- [x] `<wasm-inspector>` — developer inspection panel showing module manifests, live state, events, validation results
- [x] Options page with live module manifest viewer
- [x] `browser.ts` — cross-browser (Chrome/Firefox) API wrapper

### Extension Features
- [x] Fuzzy search dashboard — subsequence matching in Rust, reactive UI filtering
- [x] Security suite — SHA-256 hashing + password generation in Rust
- [x] Performance benchmarks — JS vs WASM Fibonacci comparison
- [x] Background alarms with real-time UI updates
- [x] Offscreen document clipboard access
- [x] `declarativeNetRequest` — ad tracking blocking + header modification
- [x] Injected EXBA Command Bar — floating glassmorphic dock on webpages
- [x] Native Chrome Side Panel with `openPanelOnActionClick`
- [x] 12 integrated demo panels (audio player, accordion, treeview, tabs, storage, notifications, alarms, bookmarks, history, cookies, leaflet map, vis-network)

### Build & Infrastructure
- [x] Rsbuild bundler for Manifest V3
- [x] Unified `build.sh` for Rust + TS
- [x] Vitest for TypeScript tests (4 passing)
- [x] wasm-pack test for Rust tests (22 passing)
- [x] Biome for linting/formatting
- [x] Chromium dev launcher with auto-detection and persistent profile
- [x] Extension build validation script

---

## 📅 Upcoming Roadmap

### Phase 1: Framework Hardening

- [ ] **Error boundaries** — catch render errors in child components, show fallback UI without crashing the parent
- [ ] **Suspense / async rendering** — built-in loading states for async data (WASM init, fetch)
- [ ] **Transitions** — enter/leave/move animations for `Show` and `For` primitives
- [ ] **Error recovery** — retry mechanism for failed WASM dispatch calls with exponential backoff
- [ ] **`createResource`** — async data primitive that integrates with Suspense (like Solid's `createResource`)

### Phase 2: State & Data Layer

- [ ] **Binary state bridge** — explore Bincode or MsgPack for state sync instead of JSON to reduce serialization overhead
- [ ] **Deep nested store** — recursive Proxy wrapping so `store.a.b.c` creates tracked signals for each level
- [ ] **Store setters** — immutable update helpers for stores: `store.produce(s => { s.count++ })` or `store.set('path.to.key', value)`
- [ ] **Remote state sync** — synchronize WASM engine state with `chrome.storage` for persistence across sessions
- [ ] **State history / undo** — automatic snapshot stack for stores with time-travel debugging

### Phase 3: Component Ecosystem

- [ ] **Component library** — reusable `<exba-button>`, `<exba-input>`, `<exba-modal>`, `<exba-tabs>`, `<exba-toast>` built with the framework
- [ ] **Slot-based composition** — `createPortal` / `<slot>` projection for parent→child content injection
- [ ] **Form validation** — reactive form state with field-level dirty/touched/error tracking
- [ ] **`createQuery` / `createMutation`** — declarative data fetching cache (like TanStack Query) backed by WASM processing
- [ ] **Theming system** — CSS custom properties + context-based theme provider with dark/light mode

### Phase 4: Developer Experience

- [ ] **HMR for WASM** — hot-reload Rust modules during development without full page reload
- [ ] **DevTools panel** — Chrome DevTools custom panel showing signal graph, effect tree, store inspection
- [ ] **Framework CLI** — `npx create-exba` project scaffold with module generator wizard
- [ ] **Performance profiler** — integration with the benchmark component showing per-effect execution time and re-run count
- [ ] **Type-safe action contracts** — code generation from Rust `ModuleDef` to TS interfaces for fully typed `wasm.call()`

### Phase 5: Content Script Power-ups

- [ ] **WASM content scrapers** — move complex DOM parsing into WASM for data-heavy pages
- [ ] **Dynamic injection toggle** — settings UI for the command bar visibility
- [ ] **Cross-origin state bridge** — `window.postMessage` + `WindowProxy` for content script ↔ WASM communication

### Phase 6: CI/CD & Deployment

- [ ] **Automated packaging** — CI script to zip `dist/` for Chrome Web Store / Firefox Add-ons
- [ ] **GitHub Actions** — automated test runs on PR, Web Store upload on tagged releases
- [ ] **Sentry / error tracking** — WASM panic hook + JS error boundary integration
