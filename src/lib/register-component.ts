import type { WasmDispatchResult, WasmModuleEvent } from '../wasm-types';
import {
  createContext,
  createRef,
  createStore,
  defineExba,
  ExbaElement,
  html,
  provideContext,
  untrack,
  useContext,
} from './framework';

type InitWasmFn = (config?: { module_or_path: string }) => Promise<void>;
type EngineConstructor = new (...args: any[]) => any;

interface ComponentConfig<TState extends Record<string, any>> {
  /** Tag name for the custom element (must contain a hyphen) */
  tag: string;
  /** WASM init function (default export from wasm-bindgen) */
  initWasm: InitWasmFn;
  /** WASM engine constructor class */
  Engine: EngineConstructor;
  /** Arguments passed to the engine constructor */
  constructorArgs?: any[];
  /** Render function — return HTML string */
  render: (ctx: ComponentContext<TState>) => string;
  /** Called after first render for event binding */
  onMount?: (ctx: ComponentContext<TState>) => void;
  /** Called when WASM events are received */
  onEvent?: (ctx: ComponentContext<TState>, event: WasmModuleEvent) => void;
  /** Reactive effects to set up */
  effects?: ((ctx: ComponentContext<TState>) => void)[];
}

interface ComponentContext<TState extends Record<string, any>> {
  state: { value: TState };
  engine: any;
  wasm: import('./wasm-client').WasmClient | null;
  shadowRoot: ShadowRoot;
  host: HTMLElement;
  query: (sel: string) => HTMLElement | null;
  queryAll: (sel: string) => NodeListOf<HTMLElement>;
  bindText: (selector: string, fn: (state: TState) => string) => void;
  bindList: <T>(
    selector: string,
    source: (state: TState) => T[],
    template: (item: T, i: number) => string,
  ) => void;
  on: (selector: string, event: string, handler: (e: Event) => void) => void;
  syncFromRust: () => void;
  syncToRust: () => void;
  /** Dispatch an action to a WASM module and process events */
  dispatch: (
    module: string,
    action: string,
    params?: Record<string, unknown>,
  ) => WasmDispatchResult;
  /** Drain pending events from the WASM engine */
  drainEvents: () => WasmModuleEvent[];
  /** Advanced rendering primitives */
  $: (sel: string) => HTMLElement | null;
  $$: (sel: string) => NodeListOf<HTMLElement>;
  show: <T>(
    props: Omit<import('./render').ShowProps<T>, 'mount'> & {
      mount?: string | Element | ShadowRoot;
    },
  ) => () => void;
  for: <T>(
    props: Omit<import('./render').ForProps<T>, 'mount'> & {
      mount?: string | Element | ShadowRoot;
    },
  ) => () => void;
  bindValue: (
    selector: string,
    get: () => string,
    set: (value: string) => void,
  ) => () => void;
  toggleClass: (
    selector: string,
    classes: Record<string, () => boolean>,
  ) => () => void;
  /** Deep reactive store with path-level tracking */
  createStore: <T extends Record<string, unknown>>(initial: T) => T;
  /** Mutable DOM element ref (not reactive) */
  createRef: <T extends Element = HTMLElement>(
    initial?: T | null,
  ) => import('./render').Ref<T>;
  /** Read signals without creating dependencies */
  untrack: <T>(fn: () => T) => T;
  /** Context API */
  createContext: <T>(defaultValue: T) => import('./context').ContextKey<T>;
  useContext: <T>(key: import('./context').ContextKey<T>) => T;
  provideContext: <T>(
    key: import('./context').ContextKey<T>,
    value: T,
  ) => () => void;
}

/**
 * Create and register a new WASM-powered Web Component.
 */
export function createWasmComponent<TState extends Record<string, any> = any>(
  config: ComponentConfig<TState>,
): void {
  const { tag, initWasm, Engine, constructorArgs } = config;

  class WasmComponent extends ExbaElement<TState> {
    constructor() {
      super(initWasm as any, Engine as any, constructorArgs ?? []);
    }

    renderInitial() {
      if (!this.shadowRoot) return;

      const ctx = this.createContext();

      this.shadowRoot.innerHTML = `<style>
        :host { display: block; }
        .wasm-error { color: #ef4444; padding: 8px; font-size: 12px; }
      </style>
      ${config.render(ctx)}`;

      // Set up effects
      if (config.effects) {
        for (const effect of config.effects) {
          effect(ctx);
        }
      }

      // On mount callback
      if (config.onMount) {
        queueMicrotask(() => config.onMount!(ctx));
      }
    }

    private createContext(): ComponentContext<TState> {
      return {
        state: this.state as { value: TState },
        engine: this.engine,
        wasm: this.wasm,
        shadowRoot: this.shadowRoot!,
        host: this,
        query: (sel: string) => this.shadowRoot?.querySelector(sel) ?? null,
        queryAll: (sel: string) =>
          this.shadowRoot?.querySelectorAll(sel) ?? ([] as any),
        bindText: (sel, fn) => this.bindText(sel, fn as any),
        bindList: (sel, src, tmpl) =>
          this.bindList(sel, src as any, tmpl as any),
        on: (sel, evt, handler) => this.on(sel, evt, handler),
        $: (sel) => this.$(sel),
        $$: (sel) => this.$$(sel),
        show: (props: any) => this.show(props as any),
        for: (props: any) => this.for(props as any),
        bindValue: (sel, get, set) => this.bindValue(sel, get, set),
        toggleClass: (sel, classes) => this.toggleClass(sel, classes),
        createStore: (initial: any) => this.createStore(initial),
        createRef: (initial?: any) => this.createRef(initial),
        untrack: (fn: any) => this.untrack(fn),
        createContext: (defaultValue: any) => createContext(defaultValue),
        useContext: (key: any) => this.useContext(key),
        provideContext: (key: any, value: any) =>
          this.provideContext(key, value),
        syncFromRust: () => {
          if (this.wasm) {
            this.wasm.pullState();
            this.state.value = { ...this.wasm.state.value } as TState;
          } else {
            this.syncStateFromRust();
          }
        },
        syncToRust: () => this.syncStateToRust(),
        dispatch: (module, action, params = {}) => {
          if (this.wasm) {
            const result = this.wasm.call(module, action, params);
            // Process events via callback
            if (result.events && config.onEvent) {
              for (const evt of result.events) {
                config.onEvent(this.createContext(), evt);
              }
            }
            this.state.value = { ...this.wasm.state.value } as TState;
            return result;
          }
          // Fallback to raw dispatch
          const result = (this.engine as any)?.dispatch_action?.(
            module,
            action,
            JSON.stringify(params),
          );
          if (result) {
            const parsed = JSON.parse(result) as WasmDispatchResult;
            if (parsed.events && config.onEvent) {
              for (const evt of parsed.events) {
                config.onEvent(this.createContext(), evt);
              }
            }
            this.syncStateFromRust();
            return parsed;
          }
          return {
            ok: false,
            error: { code: 'NO_ENGINE', message: 'Engine not available' },
          };
        },
        drainEvents: () => {
          if (this.wasm) {
            return this.wasm.drainEvents();
          }
          const json = (this.engine as any)?.drain_events?.();
          return json ? JSON.parse(json) : [];
        },
      };
    }
  }

  defineExba(tag, WasmComponent);
}

export {
  createContext,
  createRef,
  createStore,
  html,
  provideContext,
  untrack,
  useContext,
};
