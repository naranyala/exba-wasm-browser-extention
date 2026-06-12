/**
 * WasmClient — typed, reactive wrapper around the Rust CoreEngine.
 *
 * Features:
 * - Typed action dispatch with generics
 * - Fine-grained state key subscriptions (only re-render on changed keys)
 * - Integrated event bus for WASM → JS events
 * - Module manifest cache with schema validation
 * - Patch-based state diffing (only changed keys trigger subscribers)
 * - Auto-sync loop (optional)
 */

import type {
  WasmComponentState,
  WasmDispatchResult,
  WasmModuleError,
  WasmModuleEvent,
  WasmModuleManifest,
} from '../wasm-types';
import { batch, effect, type Signal, signal } from './reactivity';
import {
  getWasmModuleManifests,
  loadWasmModule,
  dispatchAction as rawDispatch,
  drainEvents as rawDrainEvents,
} from './wasm-bridge';
import { WasmEventBus } from './wasm-event-bus';

// ── Type helpers for typed action dispatch ──

/**
 * Define a module's action contract for type-safe dispatch.
 *
 * @example
 * ```ts
 * interface CryptoActions extends WasmModuleActions {
 *   actions: {
 *     generate_password: { params: { length: number }; result: { ok: boolean } };
 *     calculate_hash:   { params: { input: string };   result: { ok: boolean } };
 *   };
 * }
 * ```
 */
export interface WasmModuleActions {
  actions: Record<
    string,
    { params?: Record<string, unknown>; result?: unknown }
  >;
}

type ActionParams<T, K extends string> = T extends WasmModuleActions
  ? K extends keyof T['actions']
    ? T['actions'][K] extends { params: infer P }
      ? P
      : Record<string, unknown>
    : Record<string, unknown>
  : Record<string, unknown>;

/**
 * State subscription — fires when a specific key changes.
 */
type StateSubscriber = (value: unknown, key: string) => void;

// ── WasmClient Options ──

export interface WasmClientOptions {
  /** Enable auto-sync loop (polls Rust state on rAF). Default: false */
  autoSync?: boolean;
  /** Auto-sync interval in ms. Default: 16 (next frame) */
  autoSyncInterval?: number;
  /** Enable debug logging. Default: false */
  debug?: boolean;
}

// ── WasmClient ──

export class WasmClient {
  /** Raw CoreEngine instance */
  engine: any = null;

  /** Reactive state signal */
  state: Signal<Record<string, unknown>>;

  /** Event bus for WASM → JS events */
  events: WasmEventBus;

  /** Cached module manifests */
  manifests: WasmModuleManifest[] = [];

  /** Whether WASM is initialized */
  ready = false;

  /** Initialization promise */
  readyPromise: Promise<void>;

  private initWasmFn: (config?: { module_or_path: string }) => Promise<void>;
  private EngineClass: new (
    ...args: any[]
  ) => any;
  private engineArgs: any[];
  private options: Required<WasmClientOptions>;

  // Per-key subscriptions
  private keySubscribers = new Map<string, Set<StateSubscriber>>();
  private wildcardSubscribers = new Set<StateSubscriber>();

  // Last known state for diffing
  private prevState: Record<string, unknown> = {};

  // Auto-sync
  private autoSyncTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  constructor(
    initWasmFn: (config?: { module_or_path: string }) => Promise<void>,
    EngineClass: new (...args: any[]) => any,
    engineArgs: any[] = [],
    options: WasmClientOptions = {},
  ) {
    this.initWasmFn = initWasmFn;
    this.EngineClass = EngineClass;
    this.engineArgs = engineArgs;
    this.options = {
      autoSync: false,
      autoSyncInterval: 16,
      debug: false,
      ...options,
    };
    this.state = signal<Record<string, unknown>>({});
    this.events = new WasmEventBus();

    // Start async initialization
    this.readyPromise = this.init();

    // Auto-setup sync loop
    if (this.options.autoSync) {
      this.startAutoSync();
    }

    if (this.options.debug) {
      this.onAnyChange((val, key) => {
        console.debug(`[WasmClient] state "${key}" changed:`, val);
      });
    }
  }

  // ════════════════════════════════════════════════════
  //  Initialization
  // ════════════════════════════════════════════════════

  private async init(): Promise<void> {
    try {
      await loadWasmModule(this.initWasmFn as any);
      this.engine = new this.EngineClass(...this.engineArgs);
      this.cacheManifests();
      this.pullState();
      this.ready = true;
    } catch (err) {
      console.error('[WasmClient] Init failed:', err);
      throw err;
    }
  }

  /** Wait for WASM to be ready */
  async waitReady(): Promise<void> {
    await this.readyPromise;
  }

  // ════════════════════════════════════════════════════
  //  Module Manifests
  // ════════════════════════════════════════════════════

  private cacheManifests(): void {
    this.manifests = getWasmModuleManifests(
      () => this.engine?.get_module_manifests_json?.() ?? '[]',
    );
  }

  refreshManifests(): void {
    this.cacheManifests();
  }

  getManifest(moduleName: string): WasmModuleManifest | undefined {
    return this.manifests.find((m) => m.name === moduleName);
  }

  getStateKeysForModule(moduleName: string): string[] {
    return this.getManifest(moduleName)?.state_keys ?? [];
  }

  // ════════════════════════════════════════════════════
  //  Typed Action Dispatch
  // ════════════════════════════════════════════════════

  /**
   * Dispatch an action to a WASM module with full type safety.
   *
   * @example
   * ```ts
   * const result = client.call('crypto', 'generate_password', { length: 16 });
   * ```
   */
  call<M extends string, A extends string>(
    module: M,
    action: A,
    params?: Record<string, unknown>,
  ): WasmDispatchResult {
    const result = rawDispatch(this.engine, module, action, params);

    // Pull events into the bus
    if (result.events && result.events.length > 0) {
      this.events.feed(result.events);
    }

    // If dispatch succeeded, state changed; pull it
    if (result.ok) {
      this.pullState();
    }

    return result;
  }

  // ════════════════════════════════════════════════════
  //  State Sync
  // ════════════════════════════════════════════════════

  /**
   * Pull full state from Rust and apply diffs to subscribers.
   */
  pullState(): void {
    if (!this.engine) return;
    try {
      const json = this.engine.get_state_json();
      const newState = JSON.parse(json) as Record<string, unknown>;
      this.applyState(newState);
    } catch (e) {
      console.error('[WasmClient] Error pulling state:', e);
    }
  }

  /**
   * Push full state to Rust.
   */
  pushState(): void {
    if (!this.engine) return;
    this.engine.set_state(JSON.stringify(this.state.value));
  }

  /**
   * Push a partial state update to Rust.
   */
  pushPartial(patch: Record<string, unknown>): void {
    if (!this.engine) return;
    batch(() => {
      for (const [key, value] of Object.entries(patch)) {
        (this.state.value as any)[key] = value;
      }
    });
    this.engine.set_state(JSON.stringify(patch));
  }

  /**
   * Get a single state value.
   */
  get<T = unknown>(key: string): T | undefined {
    return this.state.value[key] as T | undefined;
  }

  /**
   * Set a single state value and sync to Rust.
   */
  set(key: string, value: unknown): void {
    this.pushPartial({ [key]: value });
  }

  // ════════════════════════════════════════════════════
  //  Fine-grained State Subscriptions
  // ════════════════════════════════════════════════════

  /**
   * Subscribe to changes on a specific state key.
   * Returns a dispose function.
   */
  onKeyChange<T = unknown>(
    key: string,
    handler: (value: T) => void,
  ): () => void {
    if (!this.keySubscribers.has(key)) {
      this.keySubscribers.set(key, new Set());
    }
    const wrapped: StateSubscriber = (val) => handler(val as T);
    this.keySubscribers.get(key)!.add(wrapped);
    return () => this.keySubscribers.get(key)?.delete(wrapped);
  }

  /**
   * Subscribe to all state changes.
   * Returns a dispose function.
   */
  onAnyChange(handler: (value: unknown, key: string) => void): () => void {
    this.wildcardSubscribers.add(handler);
    return () => this.wildcardSubscribers.delete(handler);
  }

  // ── Internal: apply new state, notify subscribers of diffs ──

  private applyState(newState: Record<string, unknown>): void {
    const changedKeys: string[] = [];

    // Detect changes
    for (const key of Object.keys(newState)) {
      if (!isEqual(this.prevState[key], newState[key])) {
        changedKeys.push(key);
      }
    }
    // Detect deletions
    for (const key of Object.keys(this.prevState)) {
      if (!(key in newState)) {
        changedKeys.push(key);
      }
    }

    if (changedKeys.length === 0) return;

    // Update prev state
    this.prevState = { ...newState };

    // Batch signal updates
    batch(() => {
      for (const key of changedKeys) {
        (this.state.value as any)[key] = newState[key];
      }
    });

    // Notify subscribers
    for (const key of changedKeys) {
      const subs = this.keySubscribers.get(key);
      if (subs) {
        for (const sub of subs) {
          sub(newState[key], key);
        }
      }
    }

    // Wildcard subscribers
    for (const key of changedKeys) {
      for (const sub of this.wildcardSubscribers) {
        sub(newState[key], key);
      }
    }
  }

  // ════════════════════════════════════════════════════
  //  Event Bus
  // ════════════════════════════════════════════════════

  /**
   * Manually drain events from Rust and feed into the event bus.
   * Usually called automatically after dispatch, but useful
   * for polling if auto-sync is on.
   */
  drainEvents(): WasmModuleEvent[] {
    const events = rawDrainEvents(this.engine);
    if (events.length > 0) {
      this.events.feed(events);
    }
    return events;
  }

  // ════════════════════════════════════════════════════
  //  Auto-Sync
  // ════════════════════════════════════════════════════

  /**
   * Start automatically polling Rust state.
   */
  startAutoSync(intervalMs?: number): void {
    this.stopAutoSync();
    const ms = intervalMs ?? this.options.autoSyncInterval;
    this.autoSyncTimer = setInterval(() => {
      if (!this.disposed) {
        this.pullState();
        this.drainEvents();
      }
    }, ms);
  }

  /**
   * Stop automatic polling.
   */
  stopAutoSync(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
  }

  // ════════════════════════════════════════════════════
  //  Schema Validation
  // ════════════════════════════════════════════════════

  /**
   * Validate that the current state matches the manifest's expected keys.
   * Returns missing keys per module.
   */
  validate(): { module: string; missing: string[] }[] {
    const results: { module: string; missing: string[] }[] = [];
    for (const manifest of this.manifests) {
      const missing: string[] = [];
      for (const key of manifest.state_keys) {
        if (!(key in this.state.value)) {
          missing.push(key);
        }
      }
      if (missing.length > 0) {
        results.push({ module: manifest.name, missing });
      }
    }
    return results;
  }

  /**
   * Validate a specific module's state keys.
   */
  validateModule(moduleName: string): string[] {
    const manifest = this.getManifest(moduleName);
    if (!manifest) return [`Module "${moduleName}" not found`];
    return manifest.state_keys.filter((k) => !(k in this.state.value));
  }

  // ════════════════════════════════════════════════════
  //  Lifecycle
  // ════════════════════════════════════════════════════

  /**
   * Dispose the client, clean up subscriptions and auto-sync.
   */
  dispose(): void {
    this.disposed = true;
    this.stopAutoSync();
    this.keySubscribers.clear();
    this.wildcardSubscribers.clear();
    this.events.clear();
    this.engine = null;
  }
}

/**
 * Helper to deep-compare JS values (objects, arrays, primitives)
 */
function isEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a && typeof a === 'object' && b && typeof b === 'object') {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!isEqual(a[i], b[i])) return false;
      }
      return true;
    }
    if (Array.isArray(a) || Array.isArray(b)) return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (
        !Object.hasOwn(b, key) ||
        !isEqual((a as any)[key], (b as any)[key])
      ) {
        return false;
      }
    }
    return true;
  }
  return false;
}
