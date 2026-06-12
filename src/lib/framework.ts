import type { WasmModuleManifest } from '../wasm-types';
import {
  type ContextKey,
  createContext,
  provideContext,
  useContext,
} from './context';
import {
  batch,
  computed,
  createStore,
  effect,
  type Signal,
  signal,
  untrack,
  watch,
} from './reactivity';
import {
  createBindValue,
  createClassList,
  createFor,
  createRef,
  createShow,
  type ForProps,
  html,
  type Ref,
  type ShowProps,
} from './render';
import { getWasmModuleManifests, validateState } from './wasm-bridge';
import type { WasmClientOptions } from './wasm-client';
import { WasmClient } from './wasm-client';

/**
 * Interface for the Rust WASM engine (backward compat).
 */
export interface Engine<TState = any> {
  get_state_json(): string;
  set_state(state_json: string): void;
  [key: string]: any;
}

export type { ContextKey } from './context';
export { createContext, provideContext, useContext } from './context';
export { createStore, untrack } from './reactivity';
export type { Ref } from './render';
export { createRef, html } from './render';
export type InitWasmFn = (config?: { module_or_path: string }) => Promise<void>;
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

  /** WasmClient — typed reactive wrapper around CoreEngine */
  public wasm: WasmClient | null = null;

  // The core reactive signal holding our synchronized Rust state
  public state: Signal<TState>;

  protected _disposables: Set<() => void> = new Set();

  /**
   * @param initWasmFn - The default initialization function exported by wasm-bindgen
   * @param EngineClass - The Rust WASM engine class (e.g. CoreEngine)
   * @param initialArgs - Arguments to pass to the engine constructor
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
    if (this.wasm) {
      this.wasm.dispose();
      this.wasm = null;
    }
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

  // ══════════════════════════════════════════════════════════
  //  Reactive primitives
  // ══════════════════════════════════════════════════════════

  /**
   * Create a derived reactive value.
   */
  computed<T>(fn: () => T) {
    return computed(fn);
  }

  /**
   * Create a reactive side-effect that tracks signal dependencies.
   * The returned dispose function is automatically called on unmount.
   */
  effect(fn: () => void) {
    const stop = effect(fn);
    this._disposables.add(stop);
    return stop;
  }

  /**
   * Watch a signal for changes.
   */
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
   * Execute a function without tracking signal dependencies.
   */
  untrack<T>(fn: () => T): T {
    return untrack(fn);
  }

  /**
   * Create a deep reactive store with path-level tracking.
   * Each property access inside an effect is individually tracked.
   *
   * @example
   * ```ts
   * const store = this.createStore({ count: 0, name: 'hello' });
   * effect(() => { console.log(store.count); }); // only tracks 'count'
   * store.count = 5; // triggers only effects reading store.count
   * ```
   */
  createStore<T extends Record<string, unknown>>(initial: T): T {
    return createStore(initial);
  }

  /**
   * Create a mutable ref container for capturing DOM elements.
   * Not reactive — reading ref.current does not create tracking.
   */
  createRef<T extends Element = HTMLElement>(initial: T | null = null): Ref<T> {
    return createRef(initial);
  }

  // ══════════════════════════════════════════════════════════
  //  Context API
  // ══════════════════════════════════════════════════════════

  /**
   * Provide a context value to descendant components.
   * Returns a dispose function. The value is available to any
   * `useContext` call in effects down the tree.
   *
   * @example
   * ```ts
   * this.effect(() => {
   *   const dispose = this.provideContext(ThemeCtx, { mode: 'dark' });
   *   this._disposables.add(dispose);
   * });
   * ```
   */
  provideContext<T>(key: ContextKey<T>, value: T): () => void {
    return provideContext(key, value);
  }

  /**
   * Read a context value provided by an ancestor component.
   * Returns the default value if no provider is found.
   */
  useContext<T>(key: ContextKey<T>): T {
    return useContext(key);
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

  // ══════════════════════════════════════════════════════════
  //  Advanced rendering primitives
  // ══════════════════════════════════════════════════════════

  /**
   * Conditionally mount/unmount DOM content based on a signal.
   * Manages lifecycle — creates DOM when truthy, removes when falsy.
   *
   * @example
   * ```ts
   * this.show({
   *   mount: this.$('#detail'),
   *   when: () => this.state.value.hasSelection,
   *   children: () => html`<p>Selected: ${this.state.value.selection}</p>`,
   * });
   * ```
   */
  show<T>(
    props: Omit<ShowProps<T>, 'mount'> & {
      mount?: string | Element | ShadowRoot;
    },
  ): () => void {
    const mountEl = this.resolveMount(props.mount);
    if (!mountEl) return () => {};
    return createShow({ ...props, mount: mountEl });
  }

  /**
   * Keyed list rendering with DOM reuse.
   * Only creates/removes nodes for items that change.
   *
   * @example
   * ```ts
   * this.for({
   *   mount: '#todo-list',
   *   each: () => this.state.value.todos,
   *   keyed: (t) => t.id,
   *   children: (t, i) => html`<li>${i()} - ${t.text}</li>`,
   * });
   * ```
   */
  for<T>(
    props: Omit<ForProps<T>, 'mount'> & {
      mount?: string | Element | ShadowRoot;
    },
  ): () => void {
    const mountEl = this.resolveMount(props.mount);
    if (!mountEl) return () => {};
    return createFor({ ...props, mount: mountEl });
  }

  /**
   * Two-way reactive binding between an input and a signal.
   *
   * @example
   * ```ts
   * this.bindValue('#search', () => state.value.query, (val) => {
   *   state.value = { ...state.value, query: val };
   * });
   * ```
   */
  bindValue(
    selector: string,
    get: () => string,
    set: (value: string) => void,
  ): () => void {
    const el = this.$(selector) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement
      | null;
    if (!el) return () => {};
    return createBindValue(el, get, set);
  }

  /**
   * Reactively toggle CSS classes on an element.
   *
   * @example
   * ```ts
   * this.toggleClass('#panel', {
   *   active: () => state.value.open,
   *   'has-error': () => state.value.error !== null,
   * });
   * ```
   */
  toggleClass(
    selector: string,
    classes: Record<string, () => boolean>,
  ): () => void {
    const el = this.$(selector);
    if (!el) return () => {};
    return createClassList(el, classes);
  }

  /**
   * Query a single element in the shadow root.
   */
  $(selector: string): HTMLElement | null {
    return this.shadowRoot?.querySelector(selector) ?? null;
  }

  /**
   * Query all matching elements in the shadow root.
   */
  $$(selector: string): NodeListOf<HTMLElement> {
    return this.shadowRoot?.querySelectorAll(selector) ?? ([] as any);
  }

  private resolveMount(
    mount?: string | Element | ShadowRoot,
  ): Element | ShadowRoot | null {
    if (!mount) return this.shadowRoot ?? null;
    if (typeof mount === 'string') return this.$(mount);
    return mount;
  }

  /**
   * Get registered module manifests from the Rust engine.
   * Returns empty array if engine is not initialized or doesn't have the method.
   */
  getModuleManifests(): WasmModuleManifest[] {
    const fn = (this.engine as any)?.get_module_manifests_json;
    if (typeof fn === 'function') {
      return getWasmModuleManifests(() => fn.call(this.engine));
    }
    return [];
  }

  /**
   * Validate current state against expected keys (for development).
   */
  validateState(expectedKeys: string[]): string[] {
    return validateState(this.state.value as any, expectedKeys);
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
        // Create WasmClient — handles init, engine creation, state sync, events
        const wasmOptions: WasmClientOptions = {
          autoSync: false,
          debug: false,
        };
        this.wasm = new WasmClient(
          this.initWasmFn,
          this.EngineClass as any,
          this.getEngineArgs(),
          wasmOptions,
        );

        await this.wasm.waitReady();
        this.engine = this.wasm.engine;

        // Sync initial state from Rust
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
    if (this.wasm) {
      this.wasm.pullState();
    }
    try {
      const newState = JSON.parse(this.engine.get_state_json());
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
