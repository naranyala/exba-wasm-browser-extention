# Unified Rust-WASM Chrome Extension Starter (EXBA)

A production-grade Manifest V3 Chrome Extension powered by **Rust**, **WebAssembly**, and the **EXBA** meta-framework. Combines a custom signal-reactive UI layer with a compiled Rust core for high-performance browser extension development — no heavy SPA framework required.

---

## Meta-Framework Surface

The EXBA framework is a **browser-native, signal-reactive, WASM-backed component system** built from scratch. Every layer is designed for composition, type safety, and zero-overhead DOM updates.

### Reactivity System (`src/lib/reactivity.ts`)

Fine-grained dependency tracking inspired by SolidJS, implemented in ~180 lines.

| Primitive | Purpose |
|-----------|---------|
| `signal(value)` | Create a reactive value container. Reading `.value` inside an `effect` auto-subscribes; assigning `.value` triggers subscribers. |
| `computed(fn)` | Derive a read-only reactive value that re-computes only when its tracked dependencies change. |
| `effect(fn)` | Run a function, tracking every signal read. Re-runs automatically when any tracked signal changes. Returns a dispose function. |
| `watch(source, cb)` | Observe a signal for changes. Accepts `{ immediate: true }` to fire immediately. |
| `batch(fn)` | Group multiple signal writes into a single notification cycle. Pending subscribers flush once after the batch completes. |
| `untrack(fn)` | Execute a function without creating any signal subscriptions. Useful for reading signal values inside callbacks. |
| `createStore(initial)` | **Deep reactive proxy** — each property becomes its own tracked signal. Reading `store.foo` inside an effect only tracks `foo`; changing `store.bar` does **not** re-run effects that only read `store.foo`. |

### WASM Integration Layer

Bidirectional TypeScript↔Rust bridge with typed dispatch, event streaming, and schema validation.

| Module | Files | Purpose |
|--------|-------|---------|
| `WasmClient` | `src/lib/wasm-client.ts` | Typed reactive wrapper around the Rust `CoreEngine`. Manages action dispatch, state sync, manifest caching, and auto-polling. |
| `WasmEventBus` | `src/lib/wasm-event-bus.ts` | Reactive event stream. Subscribe to module-specific, event-name-specific, or wildcard events emitted by Rust modules. |
| `wasm-bridge.ts` | `src/lib/wasm-bridge.ts` | Low-level helpers: `loadWasmModule`, `dispatchAction`, `drainEvents`, `syncStateFromRust`, `syncStateToRust`, `getStateValue`, `setStateValue`, `validateState`. |
| `wasm-types.d.ts` | `src/wasm-types.d.ts` | Auto-generated TypeScript interfaces from wasm-bindgen: `WasmModuleManifest`, `WasmDispatchResult`, `WasmModuleEvent`, `WasmModuleError`. |

### Component System

Shadow DOM Web Components backed by a shared Rust engine instance.

| File | Purpose |
|------|---------|
| `framework.ts` | `ExbaElement<TState>` — base class with WASM init, state sync, signal binding helpers, and lifecycle hooks. |
| `register-component.ts` | `createWasmComponent(config)` — factory for ergonomic component definition with render/effect/mount callbacks. |

**Lifecycle**: `connectedCallback` → `init()` (WASM engine) → `render()` → `setupEffects()` → `onMounted()` → `disconnectedCallback` → `onUnmounted()`.

**Convenience methods on ExbaElement**:
- `bindText(sel, fn)` / `bindAttr(sel, attr, fn)` / `bindStyle(sel, prop, fn)` / `bindList(sel, src, tmpl)` — reactive DOM bindings
- `on(sel, event, handler)` — event listener with auto state sync
- `$(sel)` / `$$(sel)` — shadow DOM query shortcuts

### Rendering Primitives (`src/lib/render.ts`)

Composable DOM management functions that solve the five gaps blocking complex UI creation.

| Primitive | Signature | What it solves |
|-----------|-----------|----------------|
| `createShow` | `{ mount, when, children, fallback? }` | **Conditional DOM** — creates content when `when()` is truthy, destroys when falsy. Proper create/destroy lifecycle. |
| `createFor` | `{ mount, each, keyed?, children }` | **Keyed list** — items identified by key. Only patches DOM for changed items. Preserves focus, scroll, form state. **Updates DOM content** when existing items change. |
| `createBindValue` | `(el, get, set)` | **Two-way input binding** — signal → input.value + input event → setter. One-liner instead of manual listeners. |
| `createClassList` | `(el, classes)` | **Reactive classes** — toggle `el.classList` based on signal values. |
| `createRef` | `(initial?)` | **Element reference** — mutable `.current` for capturing DOM nodes. Not reactive; for third-party lib integrations. |
| `html` | tagged template literal | **Template to DOM** — `html\`<li>${name}</li>\`` → `DocumentFragment`. One-shot, not reactive. |

### Context API (`src/lib/context.ts`)

Dependency injection for the component tree. No prop threading needed.

| Primitive | Purpose |
|-----------|---------|
| `createContext<T>(default)` | Define a typed context key. |
| `provideContext(key, value)` | Push a value onto the context stack. Returns a dispose function. |
| `useContext(key)` | Walk up the context stack and return the nearest provided value, or default. |

### Rust Module System (`wasm/src/`)

Static module registry with dynamic action dispatch.

| Concept | Description |
|---------|-------------|
| `ModuleDef` | Static definition: name, description, state_keys, optional `ActionHandler` function pointer. |
| `dispatch_action(module, action, params)` | Routes to the correct module's handler. Returns `DispatchResult { ok, data?, error?, events? }`. |
| `ModuleEvent { module, name, data }` | Events emitted during action handling, drained by JS via `drain_events()`. |
| `ModuleError { code, message, details }` | Structured error returned on handler failure. |
| `scaffold-module.sh` | Generates full-stack Rust module + TypeScript Web Component. |
| `gen-wasm-types.ts` | Auto-generates `wasm-types.d.ts` from wasm-bindgen output. |

---

## Architecture

```
TypeScript Layer                    Rust WASM Layer
┌───────────────────┐              ┌──────────────────────┐
│  ExbaElement      │ ◄─ JSON ──► │  CoreEngine          │
│  - state: Signal  │   state      │  - Map<String,Value> │
│  - wasm: Client   │              │  - ModuleDef[]       │
│  - effects[]      │              │  - Event queue       │
├───────────────────┤  dispatch    ├──────────────────────┤
│  WasmClient       │ ────action──►│  modules/            │
│  - call()         │              │  ├─ fuzzy.rs         │
│  - pullState()    │ ◄─ events ── │  ├─ crypto.rs        │
│  - events (bus)   │              │  ├─ menu.rs          │
├───────────────────┤              │  └─ text.rs          │
│  createShow/For   │              └──────────────────────┘
│  bindValue/Ref    │
│  createStore()    │
│  Context API      │
└───────────────────┘
```

---

## Directory Structure

```
├── src/
│   ├── background.ts        # Service worker (alarms, clipboard, navigation)
│   ├── content.ts           # Injected command bar & badge
│   ├── sidepanel.ts         # Side panel entry
│   ├── popup.ts             # Popup entry
│   ├── options.ts           # Options page with module manifest viewer
│   ├── components/
│   │   ├── wasm-dashboard.ts   # Main searchable dashboard (12 demos)
│   │   ├── wasm-benchmark.ts   # JS vs WASM speed comparison
│   │   └── wasm-inspector.ts   # Dev inspector for WASM modules
│   └── lib/
│       ├── reactivity.ts       # Signal system + createStore + untrack
│       ├── render.ts           # Show, For, bindValue, classList, ref, html
│       ├── context.ts          # Context API (DI for component tree)
│       ├── framework.ts        # ExbaElement base class
│       ├── register-component.ts # createWasmComponent factory
│       ├── wasm-client.ts      # Typed WASM wrapper
│       ├── wasm-event-bus.ts   # Reactive event stream
│       ├── wasm-bridge.ts      # Low-level WASM helpers
│       ├── browser.ts          # Cross-browser API wrapper
│       └── ui.ts               # Spinner, escapeHTML helpers
├── wasm/                      # Rust crate
│   ├── src/
│   │   ├── lib.rs             # Crate entry
│   │   ├── engine.rs          # CoreEngine wasm_bindgen struct
│   │   ├── module_system.rs   # ModuleDef, dispatch, errors, events
│   │   └── modules/           # Module implementations
│   │       ├── mod.rs         # Registry (all_defs)
│   │       ├── fuzzy.rs       # Subsequence matching
│   │       ├── menu.rs        # Menu items with search/filter
│   │       ├── crypto.rs      # Password generation, SHA-256
│   │       └── text.rs        # Text transformation
│   └── scripts/
│       └── scaffold-module.sh # Full-stack module generator
├── scripts/
│   └── gen-wasm-types.ts      # Auto-generate TS types from WASM
├── public/                    # Static HTML/manifest
└── rsbuild.config.ts          # Bundler config
```

---

## npm Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Production build (TS + Rust) + validation |
| `npm test` | Run TypeScript tests (Vitest) |
| `npm run wasm:build` | Compile Rust to WASM |
| `npm run wasm:test` | Run Rust tests |
| `npm run wasm:module` | Scaffold a new module |
| `npm run wasm:types` | Regenerate TypeScript types |
| `npm run wasm:full` | Build + types |
| `npm run lint` | Biome check |

---

## Creating a New Module

```bash
# Scaffold a Rust module + TypeScript Web Component
npm run wasm:module
# Enter the module name when prompted
# Files created:
#   wasm/src/modules/<name>.rs
#   src/components/wasm-<name>.ts

# Then:
npm run wasm:full    # Compile Rust + regenerate TS types
npm run build        # Full build
```

---

## Installation

```bash
bun install
bun run dev          # TS dev server
bun run browser      # Launch Chromium with extension
```

---

## Testing

```bash
npm test              # TypeScript tests (Vitest)
npm run wasm:test     # Rust tests (wasm-pack)
```

---

## Key Design Decisions

- **State as `Map<String, Value>`** instead of typed struct: enables fully dynamic module state without recompilation.
- **Action handlers receive only their module's owned state keys**: cleaner encapsulation than full engine access.
- **Events use drain/poll model** instead of JS callbacks: avoids closure lifetime issues in wasm-bindgen.
- **`createStore` over plain `signal`**: each property is independently tracked — changing one key doesn't invalidate effects reading other keys.
- **Context stack instead of explicit props**: services like WasmClient, theme, and preferences flow through the component tree without constructor threading.
- **No virtual DOM**: direct DOM manipulation via `insertBefore`/`replaceChild` with comment anchors for identity tracking.
