# Chrome Extension & Rust-WASM Codebase Architecture Guide

As you expand this repository from a set of simple samples into a production-ready extension development environment, moving toward a **monorepo architecture** and implementing **runtime abstractions** will improve maintainability, reduce code duplication, and streamline your build pipeline.

---

## 1. Directory Structure: Monorepo Architecture

A monorepo structure allows you to separate shared utilities (like shared UI components, helper libraries, and Rust crates) from the actual extension targets. Using **Bun Workspaces**, you can manage these easily.

### Proposed Folder Structure
```text
my-extensions-monorepo/
├── package.json              # Root package.json configuring Bun Workspaces
├── bun.lock                  # Shared lockfile
├── tsconfig.base.json        # Base TypeScript config (shared)
├── eslint.config.js          # Shared ESLint config
├── apps/                     # Your Chrome Extensions
│   ├── main-extension/       # Main extension folder
│   │   ├── manifest.json
│   │   ├── popup/
│   │   ├── background/
│   │   └── package.json      # Inherits workspace dependencies
│   └── helper-extension/
├── packages/                 # Shared JavaScript/TypeScript packages
│   ├── chrome-helpers/       # Typed storage & messaging abstractions
│   │   ├── index.ts
│   │   └── package.json
│   └── ui-components/        # Shared CSS/HTML modules or templates
└── rust-modules/             # Rust Workspace (Shared Cargo modules)
    ├── Cargo.toml            # Cargo workspace configuration
    ├── shared-utils/         # Core Rust algorithms/ciphers crate
    └── extension-bridge/     # Crate compiled with wasm-pack for extensions
```

### Configuring Bun Workspaces (`package.json`)
You can define this structure in your root `package.json` to link packages automatically:
```json
{
  "name": "extensions-monorepo",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

---

## 2. Shared Configurations

Ensure consistency across your extensions by centralizing your tool configurations.

### TypeScript Inheritance (`tsconfig.json`)
Create a `tsconfig.base.json` in the root:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noImplicitAny": true
  }
}
```
In each extension/package sub-directory, inherit the base config:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

---

## 3. Rust-WASM Workspace Architecture

If you develop multiple Rust-powered extensions, avoid duplicate compilation steps and massive target folders by using a **Cargo Workspace**.

### Root `rust-modules/Cargo.toml`
```toml
[workspace]
members = [
    "shared-utils",
    "extension-bridge"
]
resolver = "2"
```

### Shared Crate (`shared-utils`)
Write core algorithms, business logic, and heavy compute functions in a standard Rust library crate (`shared-utils`) *without* `wasm-bindgen` annotations. This makes the logic fully testable using native cargo tests:
```rust
// rust-modules/shared-utils/src/lib.rs
pub fn compute_hash(input: &str) -> String {
    // ... logic ...
}
```

### WASM Bridge Crate (`extension-bridge`)
This crate depends on `shared-utils` and handles exposing functions to JS via `wasm-bindgen`:
```toml
# rust-modules/extension-bridge/Cargo.toml
[dependencies]
wasm-bindgen = "0.2"
shared-utils = { path = "../shared-utils" }
```
```rust
// rust-modules/extension-bridge/src/lib.rs
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn bridge_compute_hash(input: &str) -> String {
    shared-utils::compute_hash(input)
}
```

---

## 4. Manifest V3 Runtime Abstractions

Writing raw Chrome Extension APIs can lead to boilerplate code. Abstracting key Chrome APIs into reusable helpers simplifies your business logic.

### Abstraction A: Message Passing Wrapper
Simplify asynchronous communication between background workers, content scripts, and popups.

```javascript
// packages/chrome-helpers/messaging.js
export class ExtensionMessenger {
  /**
   * Send a strongly-typed message to another context
   */
  static async send(action, data = {}) {
    try {
      const response = await chrome.runtime.sendMessage({ action, ...data });
      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message);
      }
      return response;
    } catch (error) {
      console.error(`[Messenger] Error sending ${action}:`, error);
      throw error;
    }
  }

  /**
   * Register listeners cleanly
   */
  static listen(handlers) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const handler = handlers[message.action];
      if (handler) {
        Promise.resolve(handler(message, sender))
          .then(result => sendResponse({ success: true, result }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keeps the messaging channel open for asynchronous responses
      }
    });
  }
}
```

### Abstraction B: Storage Helper
An abstraction over `chrome.storage.local` to provide default values and clean error handling.

```javascript
// packages/chrome-helpers/storage.js
export class ExtensionStorage {
  static async get(key, defaultValue = null) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key] !== undefined ? result[key] : defaultValue);
      });
    });
  }

  static async set(key, value) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }
}
```

### Abstraction C: WASM Loader Hook
To prevent loading/initializing the WASM module multiple times on every popup click, create a wrapper that handles caching the initialization promise.

```javascript
// packages/chrome-helpers/wasm-loader.js
let wasmInstance = null;
let initPromise = null;

export async function getWasmModule(initFn) {
  if (wasmInstance) return wasmInstance;
  
  if (!initPromise) {
    initPromise = initFn().then((instance) => {
      wasmInstance = instance;
      return instance;
    });
  }
  
  return initPromise;
}
```
You can use it in your scripts like this:
```javascript
import init, * as wasm from './wasm/pkg/extension_bridge.js';
import { getWasmModule } from './wasm-loader.js';

async function run() {
  await getWasmModule(init);
  wasm.some_function();
}
```
