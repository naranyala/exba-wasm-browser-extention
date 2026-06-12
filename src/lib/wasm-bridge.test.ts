import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WasmDispatchResult, WasmModuleEvent } from '../wasm-types';
import {
  dispatchAction,
  drainEvents,
  getStateValue,
  getWasmModuleManifests,
  loadWasmModule,
  setStateValue,
  syncStateFromRust,
  syncStateToRust,
  validateState,
} from './wasm-bridge';

// ─── Mock engine factory ──────────────────────────────────────────────────────
function makeEngine(
  overrides: Partial<{
    dispatch_action: (m: string, a: string, p: string) => string;
    drain_events: () => string;
    get_state_json: () => string;
    set_state: (json: string) => void;
    get_state_value: (key: string) => string;
    set_state_value: (key: string, val: string) => void;
    get_module_manifests_json: () => string;
  }> = {},
) {
  return {
    dispatch_action: vi.fn(() => JSON.stringify({ ok: true, events: [] })),
    drain_events: vi.fn(() => '[]'),
    get_state_json: vi.fn(() => JSON.stringify({ count: 0 })),
    set_state: vi.fn(),
    get_state_value: vi.fn((key: string) => (key === 'count' ? '0' : '""')),
    set_state_value: vi.fn(),
    get_module_manifests_json: vi.fn(() => '[]'),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
describe('getWasmModuleManifests', () => {
  it('parses valid JSON manifests', () => {
    const manifests = [
      {
        name: 'crypto',
        version: '0.1.0',
        description: 'crypto',
        state_keys: ['password_result'],
      },
    ];
    const result = getWasmModuleManifests(() => JSON.stringify(manifests));
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('crypto');
  });

  it('returns empty array on invalid JSON', () => {
    const result = getWasmModuleManifests(() => 'NOT_VALID_JSON');
    expect(result).toEqual([]);
  });

  it('returns empty array when getFn throws', () => {
    const result = getWasmModuleManifests(() => {
      throw new Error('boom');
    });
    expect(result).toEqual([]);
  });

  it('handles empty manifest list', () => {
    const result = getWasmModuleManifests(() => '[]');
    expect(result).toEqual([]);
  });

  it('returns multiple manifests', () => {
    const manifests = [
      { name: 'crypto', version: '0.1.0', description: '', state_keys: [] },
      { name: 'menu', version: '0.1.0', description: '', state_keys: [] },
    ];
    const result = getWasmModuleManifests(() => JSON.stringify(manifests));
    expect(result).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('loadWasmModule', () => {
  it('calls initFn with the chrome runtime URL when chrome.runtime is available', async () => {
    const initFn = vi.fn().mockResolvedValue(undefined);
    const mockChrome = {
      runtime: {
        getURL: vi.fn(
          () => 'chrome-extension://abc/wasm/pkg/wasm_unified_core_bg.wasm',
        ),
      },
    };
    (globalThis as any).chrome = mockChrome;
    await loadWasmModule(initFn as any);
    expect(initFn).toHaveBeenCalledWith({
      module_or_path:
        'chrome-extension://abc/wasm/pkg/wasm_unified_core_bg.wasm',
    });
    delete (globalThis as any).chrome;
  });

  it('falls back to relative path when chrome is unavailable', async () => {
    const initFn = vi.fn().mockResolvedValue(undefined);
    delete (globalThis as any).chrome;
    await loadWasmModule(initFn as any);
    expect(initFn).toHaveBeenCalledWith({
      module_or_path: 'wasm/pkg/wasm_unified_core_bg.wasm',
    });
  });

  it('uses explicit wasmPath override when provided', async () => {
    const initFn = vi.fn().mockResolvedValue(undefined);
    await loadWasmModule(initFn as any, '/custom/path/wasm.wasm');
    expect(initFn).toHaveBeenCalledWith({
      module_or_path: '/custom/path/wasm.wasm',
    });
  });

  it('propagates rejection from initFn', async () => {
    const initFn = vi.fn().mockRejectedValue(new Error('load failed'));
    await expect(loadWasmModule(initFn as any)).rejects.toThrow('load failed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('dispatchAction', () => {
  it('returns NO_ENGINE error when engine is null', () => {
    const result = dispatchAction(null, 'crypto', 'generate_password', {});
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('NO_ENGINE');
  });

  it('calls engine.dispatch_action with correct serialized params', () => {
    const engine = makeEngine();
    dispatchAction(engine, 'crypto', 'generate_password', { length: 16 });
    expect(engine.dispatch_action).toHaveBeenCalledWith(
      'crypto',
      'generate_password',
      JSON.stringify({ length: 16 }),
    );
  });

  it('returns parsed success result', () => {
    const engine = makeEngine({
      dispatch_action: vi.fn(() =>
        JSON.stringify({
          ok: true,
          events: [
            {
              module: 'crypto',
              name: 'password_generated',
              data: { length: 16 },
            },
          ],
        }),
      ),
    });
    const result = dispatchAction(engine, 'crypto', 'generate_password', {
      length: 16,
    });
    expect(result.ok).toBe(true);
    expect(result.events).toHaveLength(1);
  });

  it('returns parsed error result from engine', () => {
    const engine = makeEngine({
      dispatch_action: vi.fn(() =>
        JSON.stringify({
          ok: false,
          error: {
            code: 'MODULE_NOT_FOUND',
            message: "No module 'nonexistent'",
          },
        }),
      ),
    });
    const result = dispatchAction(engine, 'nonexistent', 'foo', {});
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('MODULE_NOT_FOUND');
  });

  it('returns PARSE_ERROR when engine returns invalid JSON', () => {
    const engine = makeEngine({
      dispatch_action: vi.fn(() => 'INVALID_JSON'),
    });
    const result = dispatchAction(engine, 'crypto', 'generate_password', {});
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('PARSE_ERROR');
  });

  it('uses empty params object by default', () => {
    const engine = makeEngine();
    dispatchAction(engine, 'text', 'process');
    expect(engine.dispatch_action).toHaveBeenCalledWith(
      'text',
      'process',
      '{}',
    );
  });

  it('returns PARSE_ERROR when dispatch_action throws', () => {
    const engine = makeEngine({
      dispatch_action: vi.fn(() => {
        throw new Error('engine error');
      }),
    });
    const result = dispatchAction(engine, 'crash', 'now', {});
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('PARSE_ERROR');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('drainEvents', () => {
  it('returns empty array when engine is null', () => {
    expect(drainEvents(null)).toEqual([]);
  });

  it('returns parsed events from engine', () => {
    const events: WasmModuleEvent[] = [
      { module: 'crypto', name: 'password_generated', data: { length: 16 } },
    ];
    const engine = makeEngine({
      drain_events: vi.fn(() => JSON.stringify(events)),
    });
    const result = drainEvents(engine);
    expect(result).toEqual(events);
  });

  it('returns empty array on invalid JSON', () => {
    const engine = makeEngine({ drain_events: vi.fn(() => 'INVALID') });
    expect(drainEvents(engine)).toEqual([]);
  });

  it('returns empty array when engine returns empty JSON array', () => {
    const engine = makeEngine({ drain_events: vi.fn(() => '[]') });
    expect(drainEvents(engine)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('syncStateFromRust', () => {
  it('returns null when engine is null', () => {
    expect(syncStateFromRust(null)).toBeNull();
  });

  it('parses and returns state object', () => {
    const engine = makeEngine({
      get_state_json: vi.fn(() => JSON.stringify({ count: 5, title: 'T' })),
    });
    const state = syncStateFromRust(engine);
    expect(state?.count).toBe(5);
    expect(state?.title).toBe('T');
  });

  it('returns null on invalid JSON', () => {
    const engine = makeEngine({ get_state_json: vi.fn(() => 'bad json') });
    expect(syncStateFromRust(engine)).toBeNull();
  });

  it('returns empty object for empty JSON object', () => {
    const engine = makeEngine({ get_state_json: vi.fn(() => '{}') });
    const state = syncStateFromRust(engine);
    expect(state).toEqual({});
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('syncStateToRust', () => {
  it('does nothing when engine is null', () => {
    expect(() => syncStateToRust(null, { count: 5 })).not.toThrow();
  });

  it('calls engine.set_state with serialized state', () => {
    const engine = makeEngine();
    syncStateToRust(engine, { count: 42, title: 'Hello' });
    expect(engine.set_state).toHaveBeenCalledWith(
      JSON.stringify({ count: 42, title: 'Hello' }),
    );
  });

  it('serializes empty state object', () => {
    const engine = makeEngine();
    syncStateToRust(engine, {});
    expect(engine.set_state).toHaveBeenCalledWith('{}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('getStateValue', () => {
  it('returns null when engine is null', () => {
    expect(getStateValue(null, 'count')).toBeNull();
  });

  it('parses numeric JSON string', () => {
    const engine = makeEngine({ get_state_value: vi.fn(() => '42') });
    expect(getStateValue(engine, 'count')).toBe(42);
  });

  it('parses JSON string-in-string', () => {
    const engine = makeEngine({ get_state_value: vi.fn(() => '"hello"') });
    expect(getStateValue(engine, 'title')).toBe('hello');
  });

  it('falls back to raw string when JSON parse fails', () => {
    const engine = makeEngine({ get_state_value: vi.fn(() => 'raw_string') });
    expect(getStateValue(engine, 'key')).toBe('raw_string');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('setStateValue', () => {
  it('does nothing when engine is null', () => {
    expect(() => setStateValue(null, 'key', 'value')).not.toThrow();
  });

  it('calls engine.set_state_value with JSON-serialized value', () => {
    const engine = makeEngine();
    setStateValue(engine, 'count', 99);
    expect(engine.set_state_value).toHaveBeenCalledWith('count', '99');
  });

  it('serializes string value correctly', () => {
    const engine = makeEngine();
    setStateValue(engine, 'title', 'Hello');
    expect(engine.set_state_value).toHaveBeenCalledWith('title', '"Hello"');
  });

  it('serializes null value', () => {
    const engine = makeEngine();
    setStateValue(engine, 'key', null);
    expect(engine.set_state_value).toHaveBeenCalledWith('key', 'null');
  });

  it('serializes object value', () => {
    const engine = makeEngine();
    setStateValue(engine, 'config', { a: 1 });
    expect(engine.set_state_value).toHaveBeenCalledWith(
      'config',
      JSON.stringify({ a: 1 }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('validateState', () => {
  it('returns empty array when all expected keys are present', () => {
    const state = { count: 0, title: 'T', items: [] };
    expect(validateState(state, ['count', 'title', 'items'])).toEqual([]);
  });

  it('returns missing key names', () => {
    const state = { count: 0 };
    const missing = validateState(state, ['count', 'title', 'items']);
    expect(missing).toContain('title');
    expect(missing).toContain('items');
    expect(missing).not.toContain('count');
  });

  it('returns all keys when state is empty', () => {
    const missing = validateState({}, ['a', 'b', 'c']);
    expect(missing).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array when expectedKeys is empty', () => {
    expect(validateState({ x: 1 }, [])).toEqual([]);
  });

  it('treats keys with undefined values as present', () => {
    const state: Record<string, any> = { count: undefined };
    const missing = validateState(state, ['count']);
    expect(missing).toEqual([]); // key IS present, just undefined
  });
});
