import {
  batch,
  computed,
  effect,
  type Signal,
  signal,
  watch,
} from './reactivity';

/**
 * Interface for the Rust WASM engine.
 */
export interface Engine<TState = any> {
  get_state_json(): string;
  set_state(state_json: string): void;
  [key: string]: any;
}

export type InitWasmFn = () => Promise<void>;
export type EngineConstructor<TState = any> = new (
  ...args: any[]
) => Engine<TState>;

/**
 * Define a custom element using the ExbaElement class.
 */
export function defineExba(
  name: string,
  ComponentClass: new () => ExbaElement,
) {
  if (!customElements.get(name)) {
    customElements.define(name, ComponentClass);
  }
}

/**
 * ExbaElement - A custom base class for Web Components backed by Rust-WASM core engines.
 */
export class ExbaElement<
  TState extends Record<string, any> = any,
> extends HTMLElement {
  protected initWasmFn: InitWasmFn;
  protected EngineClass: EngineConstructor<TState>;
  protected initialArgs: any[];
  protected engine: Engine<TState> | null = null;

  // The core reactive signal holding our synchronized Rust state
  public state: Signal<TState>;

  protected _disposables: Set<() => void> = new Set();

  /**
   * @param {InitWasmFn} initWasmFn - The default initialization function exported by wasm-bindgen
   * @param {EngineConstructor} EngineClass - The Rust WASM engine class (e.g. CoreEngine)
   * @param {Array} initialArgs - Arguments to pass to the engine constructor
   */
  constructor(
    initWasmFn: InitWasmFn,
    EngineClass: EngineConstructor<TState>,
    initialArgs: any[] = [],
  ) {
    super();
    this.attachShadow({ mode: 'open' });
    this.initWasmFn = initWasmFn;
    this.EngineClass = EngineClass;
    this.initialArgs = initialArgs;

    // Initialize state as a Signal
    this.state = signal({} as TState);
  }

  // Lifecycle callback when component is attached to DOM
  async connectedCallback() {
    await this.init();
    this.setupEffects();
    this.onMounted();
  }

  // Lifecycle callback when component is removed from DOM
  disconnectedCallback() {
    for (const dispose of this._disposables) {
      dispose();
    }
    this._disposables.clear();
    this.onUnmounted();
  }

  /**
   * Subclasses should override this to define fine-grained signal bindings.
   */
  setupEffects() {
    // Default implementation: can be empty
  }

  /**
   * Lifecycle hooks for subclasses
   */
  onMounted() {}
  onUnmounted() {}

  /**
   * High-level reactive primitives for subclasses
   */
  computed<T>(fn: () => T) {
    return computed(fn);
  }

  effect(fn: () => void) {
    const stop = effect(fn);
    this._disposables.add(stop);
    return stop;
  }

  watch<T>(
    source: () => T,
    cb: (val: T, oldVal: T) => void,
    options?: { immediate?: boolean },
  ) {
    const stop = watch(source, cb, options);
    this._disposables.add(stop);
    return stop;
  }

  /**
   * Helper to bind a signal's value to an element's text content.
   */
  bindText(selector: string, fn: (state: TState) => string) {
    const el = this.shadowRoot?.querySelector(selector);
    if (el) {
      this.effect(() => {
        el.textContent = fn(this.state.value);
      });
    }
  }

  /**
   * Helper to bind a signal's value to an element's attribute.
   */
  bindAttr(
    selector: string,
    attr: string,
    fn: (state: TState) => string | boolean | null,
  ) {
    const el = this.shadowRoot?.querySelector(selector);
    if (el) {
      this.effect(() => {
        const val = fn(this.state.value);
        if (val === null || val === false) {
          el.removeAttribute(attr);
        } else {
          el.setAttribute(attr, String(val));
        }
      });
    }
  }

  /**
   * Helper to bind a signal's value to an element's style property.
   */
  bindStyle(
    selector: string,
    prop: keyof CSSStyleDeclaration,
    fn: (state: TState) => string,
  ) {
    const el = this.shadowRoot?.querySelector(selector) as HTMLElement | null;
    if (el) {
      this.effect(() => {
        (el.style as any)[prop] = fn(this.state.value);
      });
    }
  }

  /**
   * Helper to bind an array of items to a container using a template.
   * Efficiently updates the DOM by only re-rendering when the array changes.
   */
  bindList<TItem>(
    selector: string,
    source: (state: TState) => TItem[],
    template: (item: TItem, index: number) => string,
  ) {
    const container = this.shadowRoot?.querySelector(selector);
    if (container) {
      this.effect(() => {
        const items = source(this.state.value) || [];
        container.innerHTML = items
          .map((item, index) => template(item, index))
          .join('');
      });
    }
  }

  /**
   * Helper to handle events and automatically sync state to Rust.
   */
  on(selector: string, event: string, handler: (e: Event) => void) {
    const el = this.shadowRoot?.querySelector(selector);
    if (el) {
      const wrappedHandler = (e: Event) => {
        handler(e);
        this.syncStateToRust();
      };
      el.addEventListener(event, wrappedHandler);
      this._disposables.add(() =>
        el.removeEventListener(event, wrappedHandler),
      );
    }
  }

  // Lifecycle callback when observed attributes change
  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null,
  ) {
    if (oldValue !== newValue && this.engine) {
      // Update state signal and sync to Rust
      this.state.value = {
        ...this.state.value,
        [name]: newValue,
      };
      this.syncStateToRust();
    }
  }

  // Hook to provide arguments to the Rust constructor (can be overridden by subclasses)
  getEngineArgs(): any[] {
    return this.initialArgs.length
      ? this.initialArgs
      : [this.getAttribute('title') || 'Wasm Component'];
  }

  async init() {
    try {
      if (!this.engine) {
        // 1. Initialize WASM module with absolute extension URL
        const chromeObj = (globalThis as any).chrome;
        const wasmUrl = chromeObj?.runtime?.getURL
          ? chromeObj.runtime.getURL('wasm/pkg/wasm_unified_core_bg.wasm')
          : 'wasm/pkg/wasm_unified_core_bg.wasm';

        await (this.initWasmFn as any)({ module_or_path: wasmUrl });

        // 2. Instantiate Rust Core Engine
        this.engine = new this.EngineClass(...this.getEngineArgs());

        // 3. Populate initial state from Rust
        this.syncStateFromRust();
      }

      // Initial render of the skeleton/base structure
      this.render();
      this.bindEvents();
    } catch (error) {
      console.error('[WasmElement] Initialization failed:', error);
      this.shadowRoot!.innerHTML = `
        <div style="color: #ef4444; padding: 12px; border: 1px dashed #ef4444; border-radius: 6px; font-size: 12px;">
          <strong>Error loading WASM Core:</strong> ${error instanceof Error ? error.message : String(error)}
        </div>
      `;
    }
  }

  // Pulls the serialized state from Rust and updates the Signal
  syncStateFromRust() {
    if (!this.engine) return;
    const jsonStr = this.engine.get_state_json();
    try {
      const newState = JSON.parse(jsonStr);
      // Updating .value triggers all subscribed effects
      this.state.value = newState;
    } catch (e) {
      console.error('[WasmElement] Error parsing Rust state JSON:', e);
    }
  }

  // Pushes the serialized state from JS back to Rust
  syncStateToRust() {
    if (!this.engine) return;
    this.engine.set_state(JSON.stringify(this.state.value));
  }

  /**
   * Renders the static HTML structure. Subclasses should override this.
   * This is called only once during initialization.
   */
  render() {
    if (!this.engine) {
      this.renderSkeleton();
      return;
    }

    if ((this as any).renderInitial) {
      (this as any).renderInitial();
    }
  }

  renderSkeleton() {
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = `
            <style>
              .skeleton-search {
                height: 38px;
                background: rgba(15, 23, 42, 0.4);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 8px;
                margin-bottom: 14px;
                box-sizing: border-box;
              }
              .skeleton-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
              }
              .skeleton-card {
                background: rgba(30, 41, 59, 0.25);
                border: 1px solid rgba(255, 255, 255, 0.04);
                border-radius: 10px;
                height: 105px;
                box-sizing: border-box;
                animation: pulse 1.5s infinite alternate;
              }
              @keyframes pulse {
                from { opacity: 0.6; }
                to { opacity: 1; }
              }
            </style>
            <div>
              <div class="skeleton-search"></div>
              <div class="skeleton-grid">
                <div class="skeleton-card"></div>
                <div class="skeleton-card"></div>
                <div class="skeleton-card"></div>
                <div class="skeleton-card"></div>
              </div>
            </div>
          `;
    }
  }

  // Binds event listeners. Subclasses should override this.
  bindEvents() {
    // Subclasses can implement event logic here
  }
}
