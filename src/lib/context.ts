/**
 * Context API for dependency injection.
 *
 * Provides a way to pass services (WasmClient instances, theme configs,
 * user preferences) through the component tree without explicitly
 * threading them through every constructor or prop.
 *
 * ## Usage
 *
 * ```ts
 * // 1. Define a context key
 * const ThemeCtx = createContext<{ mode: 'dark' | 'light' }>({ mode: 'dark' });
 *
 * // 2. Provide a value at some level
 * const dispose = provideContext(ThemeCtx, { mode: 'light' });
 * // ... component subtree ...
 * dispose();
 *
 * // 3. Consume anywhere in the subtree
 * const theme = useContext(ThemeCtx);
 * effect(() => { console.log(theme.mode); });
 * ```
 */
import { createStore } from './reactivity';

// ── Context internals ──

const CONTEXT_SYMBOL = Symbol('__context__');

interface ContextNode {
  parent: ContextNode | null;
  values: Map<ContextKey<any>, any>;
}

let currentContext: ContextNode | null = null;

// ── ContextKey ──

export class ContextKey<T> {
  constructor(public defaultValue: T) {}
}

// ── createContext ──

/**
 * Create a typed context key with a default value.
 *
 * @example
 * ```ts
 * const WasmCtx = createContext<WasmClient | null>(null);
 * const ThemeCtx = createContext<'dark' | 'light'>('dark');
 * ```
 */
export function createContext<T>(defaultValue: T): ContextKey<T> {
  return new ContextKey(defaultValue);
}

// ── provideContext ──

/**
 * Provide a context value for the current scope.
 * Returns a dispose function that restores the previous context.
 *
 * Must be called inside an effect or synchronous context.
 * When called inside a component's `setupEffects` or `onMounted`,
 * the value is available to all descendant effects.
 *
 * @example
 * ```ts
 * this.effect(() => {
 *   const dispose = provideContext(WasmCtx, this.wasm);
 *   this._disposables.add(dispose);
 * });
 * ```
 */
export function provideContext<T>(key: ContextKey<T>, value: T): () => void {
  const node: ContextNode = {
    parent: currentContext,
    values: new Map([[key, value]]),
  };
  currentContext = node;
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    if (currentContext === node) {
      currentContext = node.parent;
    } else {
      let curr = currentContext;
      while (curr !== null) {
        if (curr.parent === node) {
          curr.parent = node.parent;
          break;
        }
        curr = curr.parent;
      }
    }
  };
}

// ── useContext ──

/**
 * Read a context value by walking up the context stack.
 * Returns the nearest provided value, or the default if none found.
 *
 * Can be called anywhere — inside effects, render functions, event handlers.
 *
 * @example
 * ```ts
 * const wasm = useContext(WasmCtx);
 * const theme = useContext(ThemeCtx);
 * ```
 */
export function useContext<T>(key: ContextKey<T>): T {
  let node = currentContext;
  while (node) {
    if (node.values.has(key)) {
      return node.values.get(key)!;
    }
    node = node.parent;
  }
  return key.defaultValue;
}
