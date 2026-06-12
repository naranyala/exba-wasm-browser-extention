import type {
  WasmComponentState,
  WasmDispatchResult,
  WasmModuleEvent,
  WasmModuleManifest,
} from '../wasm-types';

// ── Module Introspection ──

/**
 * Introspect all registered WASM modules at runtime.
 */
export function getWasmModuleManifests(
  getFn: () => string,
): WasmModuleManifest[] {
  try {
    return JSON.parse(getFn()) as WasmModuleManifest[];
  } catch {
    return [];
  }
}

// ── WASM Loading ──

/**
 * Load WASM module dynamically.
 */
export async function loadWasmModule(
  initFn: (config?: { module_or_path: string }) => Promise<void>,
  wasmPath?: string,
): Promise<void> {
  const chromeObj = (globalThis as any).chrome;
  const wasmUrl =
    wasmPath ??
    chromeObj?.runtime?.getURL?.('wasm/pkg/wasm_unified_core_bg.wasm') ??
    'wasm/pkg/wasm_unified_core_bg.wasm';
  await initFn({ module_or_path: wasmUrl });
}

// ── Action Dispatch ──

/**
 * Dispatch an action to a WASM module.
 * Returns the parsed result.
 */
export function dispatchAction(
  engine: {
    dispatch_action: (module: string, action: string, params: string) => string;
  } | null,
  module: string,
  action: string,
  params: Record<string, unknown> = {},
): WasmDispatchResult {
  if (!engine) {
    return {
      ok: false,
      error: { code: 'NO_ENGINE', message: 'WASM engine not initialized' },
    };
  }
  try {
    const json = engine.dispatch_action(module, action, JSON.stringify(params));
    return JSON.parse(json) as WasmDispatchResult;
  } catch (e) {
    return {
      ok: false,
      error: { code: 'PARSE_ERROR', message: String(e) },
    };
  }
}

/**
 * Drain all pending events from the WASM engine.
 */
export function drainEvents(
  engine: { drain_events: () => string } | null,
): WasmModuleEvent[] {
  if (!engine) return [];
  try {
    return JSON.parse(engine.drain_events()) as WasmModuleEvent[];
  } catch {
    return [];
  }
}

// ── State Sync ──

/**
 * Pull the full state from Rust into a typed object.
 */
export function syncStateFromRust<
  T extends Record<string, any> = WasmComponentState,
>(engine: { get_state_json: () => string } | null): T | null {
  if (!engine) return null;
  try {
    return JSON.parse(engine.get_state_json()) as T;
  } catch {
    return null;
  }
}

/**
 * Push a partial state update to Rust.
 */
export function syncStateToRust(
  engine: { set_state: (json: string) => void } | null,
  state: Record<string, unknown>,
): void {
  if (!engine) return;
  engine.set_state(JSON.stringify(state));
}

/**
 * Get a single state value from the WASM engine.
 */
export function getStateValue(
  engine: { get_state_value: (key: string) => string } | null,
  key: string,
): unknown {
  if (!engine) return null;
  try {
    return JSON.parse(engine.get_state_value(key));
  } catch {
    return engine.get_state_value(key);
  }
}

/**
 * Set a single state value in the WASM engine.
 */
export function setStateValue(
  engine: { set_state_value: (key: string, value: string) => void } | null,
  key: string,
  value: unknown,
): void {
  if (!engine) return;
  engine.set_state_value(key, JSON.stringify(value));
}

// ── Validation ──

/**
 * Validate that a state object has expected fields.
 */
export function validateState(
  state: Record<string, unknown>,
  expectedKeys: string[],
): string[] {
  return expectedKeys.filter((key) => !(key in state));
}
