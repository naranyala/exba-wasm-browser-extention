import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WasmModuleEvent } from '../wasm-types';
import { WasmClient } from './wasm-client';

// ─── Mock engine ──────────────────────────────────────────────────────────────
class MockEngine {
  private _state: Record<string, unknown> = {
    count: 0,
    title: 'Test',
    items: [],
    password_result: '',
    hash_result: '',
    processed_text: '',
    search_query: '',
    selected_category: 'All',
    filtered_items: [],
  };

  dispatch_action(module: string, action: string, paramsJson: string): string {
    const params = JSON.parse(paramsJson);
    if (module === 'nonexistent') {
      return JSON.stringify({
        ok: false,
        error: { code: 'MODULE_NOT_FOUND', message: 'not found' },
      });
    }
    if (module === 'crypto' && action === 'generate_password') {
      this._state.password_result = 'x'.repeat(params.length ?? 16);
      return JSON.stringify({
        ok: true,
        events: [
          {
            module: 'crypto',
            name: 'password_generated',
            data: { length: params.length },
          },
        ],
      });
    }
    if (module === 'text' && action === 'process') {
      this._state.processed_text = String(params.text ?? '')
        .split('')
        .reverse()
        .join('');
      return JSON.stringify({
        ok: true,
        events: [{ module: 'text', name: 'text_processed', data: {} }],
      });
    }
    return JSON.stringify({ ok: true, events: [] });
  }

  drain_events(): string {
    return '[]';
  }

  get_state_json(): string {
    return JSON.stringify(this._state);
  }

  set_state(json: string): void {
    const patch = JSON.parse(json);
    Object.assign(this._state, patch);
  }

  get_state_value(key: string): string {
    return JSON.stringify(this._state[key] ?? null);
  }

  set_state_value(key: string, value: string): void {
    this._state[key] = JSON.parse(value);
  }

  get_module_manifests_json(): string {
    return JSON.stringify([
      {
        name: 'crypto',
        version: '0.1.0',
        description: 'Crypto',
        state_keys: ['password_result', 'hash_result'],
      },
      {
        name: 'text',
        version: '0.1.0',
        description: 'Text',
        state_keys: ['processed_text'],
      },
      {
        name: 'menu',
        version: '0.1.0',
        description: 'Menu',
        state_keys: ['filtered_items', 'selected_category', 'search_query'],
      },
    ]);
  }
}

// ─── Helper to create a pre-initialized WasmClient ───────────────────────────
async function makeClient(
  options: ConstructorParameters<typeof WasmClient>[3] = {},
) {
  const engineInstance = new MockEngine();
  const initFn = vi.fn().mockResolvedValue(undefined);
  const EngineClass = vi.fn().mockImplementation(function() { return engineInstance; });

  const client = new WasmClient(initFn, EngineClass as any, ['Test'], options);
  await client.waitReady();
  return { client, engineInstance };
}

// ─────────────────────────────────────────────────────────────────────────────
describe('WasmClient — initialization', () => {
  it('sets ready=true after init', async () => {
    const { client } = await makeClient();
    expect(client.ready).toBe(true);
  });

  it('assigns the engine instance', async () => {
    const { client } = await makeClient();
    expect(client.engine).not.toBeNull();
  });

  it('caches module manifests after init', async () => {
    const { client } = await makeClient();
    expect(client.manifests).toHaveLength(3);
    const names = client.manifests.map((m) => m.name);
    expect(names).toContain('crypto');
    expect(names).toContain('text');
    expect(names).toContain('menu');
  });

  it('pulls initial state from engine', async () => {
    const { client } = await makeClient();
    expect(client.state.value.count).toBe(0);
    expect(client.state.value.title).toBe('Test');
  });

  it('waitReady() resolves on already-ready client', async () => {
    const { client } = await makeClient();
    await expect(client.waitReady()).resolves.toBeUndefined();
  });

  it('throws when initFn rejects', async () => {
    const initFn = vi.fn().mockRejectedValue(new Error('wasm load fail'));
    const client = new WasmClient(initFn, MockEngine as any, ['T']);
    await expect(client.waitReady()).rejects.toThrow('wasm load fail');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('WasmClient — module manifests', () => {
  it('getManifest() returns correct manifest', async () => {
    const { client } = await makeClient();
    const manifest = client.getManifest('crypto');
    expect(manifest?.name).toBe('crypto');
    expect(manifest?.state_keys).toContain('password_result');
  });

  it('getManifest() returns undefined for unknown module', async () => {
    const { client } = await makeClient();
    expect(client.getManifest('nonexistent')).toBeUndefined();
  });

  it('getStateKeysForModule() returns keys', async () => {
    const { client } = await makeClient();
    const keys = client.getStateKeysForModule('text');
    expect(keys).toEqual(['processed_text']);
  });

  it('getStateKeysForModule() returns empty array for unknown module', async () => {
    const { client } = await makeClient();
    expect(client.getStateKeysForModule('ghost')).toEqual([]);
  });

  it('refreshManifests() re-fetches from engine', async () => {
    const { client } = await makeClient();
    const before = client.manifests.length;
    client.refreshManifests();
    expect(client.manifests.length).toBe(before);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('WasmClient — call() dispatch', () => {
  it('returns ok=true on success', async () => {
    const { client } = await makeClient();
    const result = client.call('crypto', 'generate_password', { length: 16 });
    expect(result.ok).toBe(true);
  });

  it('returns ok=false for unknown module', async () => {
    const { client } = await makeClient();
    const result = client.call('nonexistent', 'foo', {});
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('MODULE_NOT_FOUND');
  });

  it('pulls state after a successful dispatch', async () => {
    const { client } = await makeClient();
    client.call('crypto', 'generate_password', { length: 20 });
    expect(client.state.value.password_result).toBe('x'.repeat(20));
  });

  it('feeds events into the event bus after dispatch', async () => {
    const { client } = await makeClient();
    const handler = vi.fn();
    client.events.subscribeExact('crypto', 'password_generated', handler);
    client.call('crypto', 'generate_password', { length: 16 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does NOT pull state after a failed dispatch', async () => {
    const { client } = await makeClient();
    const prevState = JSON.stringify(client.state.value);
    client.call('nonexistent', 'foo', {});
    // State should not have changed (no successful dispatch)
    expect(JSON.stringify(client.state.value)).toBe(prevState);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('WasmClient — state sync', () => {
  it('pullState() syncs state from engine', async () => {
    const { client, engineInstance } = await makeClient();
    // Simulate engine-side mutation
    engineInstance.set_state(JSON.stringify({ count: 99 }));
    client.pullState();
    expect(client.state.value.count).toBe(99);
  });

  it('pushState() writes current state to engine', async () => {
    const { client, engineInstance } = await makeClient();
    (client.state.value as any).count = 77;
    client.pushState();
    const engineState = JSON.parse(engineInstance.get_state_json());
    expect(engineState.count).toBe(77);
  });

  it('pushPartial() updates specific keys', async () => {
    const { client, engineInstance } = await makeClient();
    client.pushPartial({ count: 55 });
    const engineState = JSON.parse(engineInstance.get_state_json());
    expect(engineState.count).toBe(55);
  });

  it('get() retrieves current state value', async () => {
    const { client } = await makeClient();
    expect(client.get('count')).toBe(0);
    expect(client.get('title')).toBe('Test');
  });

  it('get() returns undefined for unknown key', async () => {
    const { client } = await makeClient();
    expect(client.get('no_such_key')).toBeUndefined();
  });

  it('set() updates a single key and pushes to engine', async () => {
    const { client, engineInstance } = await makeClient();
    client.set('count', 123);
    const engineState = JSON.parse(engineInstance.get_state_json());
    expect(engineState.count).toBe(123);
  });

  it('pullState() does nothing when engine is null', async () => {
    const { client } = await makeClient();
    client.dispose();
    expect(() => client.pullState()).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('WasmClient — key subscriptions', () => {
  it('onKeyChange() fires when specific key changes', async () => {
    const { client, engineInstance } = await makeClient();
    const handler = vi.fn();
    client.onKeyChange('count', handler);
    engineInstance.set_state(JSON.stringify({ count: 10 }));
    client.pullState();
    expect(handler).toHaveBeenCalledWith(10);
  });

  it('onKeyChange() does NOT fire for other keys', async () => {
    const { client, engineInstance } = await makeClient();
    const handler = vi.fn();
    client.onKeyChange('title', handler);
    engineInstance.set_state(JSON.stringify({ count: 99 }));
    client.pullState();
    expect(handler).not.toHaveBeenCalled();
  });

  it('onKeyChange() dispose removes the subscriber', async () => {
    const { client, engineInstance } = await makeClient();
    const handler = vi.fn();
    const dispose = client.onKeyChange('count', handler);
    dispose();
    engineInstance.set_state(JSON.stringify({ count: 50 }));
    client.pullState();
    expect(handler).not.toHaveBeenCalled();
  });

  it('onAnyChange() fires for every changed key', async () => {
    const { client, engineInstance } = await makeClient();
    const handler = vi.fn();
    client.onAnyChange(handler);
    engineInstance.set_state(JSON.stringify({ count: 3, title: 'New' }));
    client.pullState();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('onAnyChange() dispose removes the subscriber', async () => {
    const { client, engineInstance } = await makeClient();
    const handler = vi.fn();
    const dispose = client.onAnyChange(handler);
    dispose();
    engineInstance.set_state(JSON.stringify({ count: 77 }));
    client.pullState();
    expect(handler).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('WasmClient — drainEvents()', () => {
  it('returns events from engine.drain_events', async () => {
    const events: WasmModuleEvent[] = [
      { module: 'text', name: 'text_processed', data: {} },
    ];
    const { client, engineInstance } = await makeClient();
    vi.spyOn(engineInstance, 'drain_events').mockReturnValueOnce(
      JSON.stringify(events),
    );
    const result = client.drainEvents();
    expect(result).toEqual(events);
  });

  it('feeds drained events into the event bus', async () => {
    const { client, engineInstance } = await makeClient();
    const handler = vi.fn();
    client.events.subscribe(handler);
    const evt: WasmModuleEvent = {
      module: 'text',
      name: 'text_processed',
      data: {},
    };
    vi.spyOn(engineInstance, 'drain_events').mockReturnValueOnce(
      JSON.stringify([evt]),
    );
    client.drainEvents();
    expect(handler).toHaveBeenCalledWith(evt);
  });

  it('returns empty array when no events are pending', async () => {
    const { client } = await makeClient();
    expect(client.drainEvents()).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('WasmClient — auto-sync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('startAutoSync() polls pullState at given interval', async () => {
    const { client } = await makeClient({ autoSync: false });
    const spy = vi.spyOn(client, 'pullState');
    client.startAutoSync(100);
    vi.advanceTimersByTime(350);
    expect(spy).toHaveBeenCalledTimes(3);
    client.stopAutoSync();
  });

  it('stopAutoSync() halts polling', async () => {
    const { client } = await makeClient({ autoSync: false });
    const spy = vi.spyOn(client, 'pullState');
    client.startAutoSync(100);
    vi.advanceTimersByTime(250);
    client.stopAutoSync();
    spy.mockClear();
    vi.advanceTimersByTime(300);
    expect(spy).not.toHaveBeenCalled();
  });

  it('autoSync option in constructor starts the loop', async () => {
    const { client } = await makeClient({
      autoSync: true,
      autoSyncInterval: 50,
    });
    const spy = vi.spyOn(client, 'pullState');
    vi.advanceTimersByTime(160);
    expect(spy).toHaveBeenCalledTimes(3);
    client.dispose();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('WasmClient — validate()', () => {
  it('returns empty array when all state keys are present', async () => {
    const { client } = await makeClient();
    const result = client.validate();
    // All manifest state keys should be in state
    expect(result.every((r) => r.missing.length === 0)).toBe(true);
  });

  it('validateModule() returns empty array for a valid module', async () => {
    const { client } = await makeClient();
    expect(client.validateModule('crypto')).toEqual([]);
  });

  it('validateModule() returns error message for unknown module', async () => {
    const { client } = await makeClient();
    const result = client.validateModule('ghost');
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('ghost');
  });

  it('validate() reports missing keys when state is incomplete', async () => {
    const { client } = await makeClient();
    // Forcibly remove a key from state
    delete (client.state.value as any).password_result;
    const results = client.validate();
    const cryptoResult = results.find((r) => r.module === 'crypto');
    expect(cryptoResult?.missing).toContain('password_result');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('WasmClient — dispose()', () => {
  it('sets disposed=true', async () => {
    const { client } = await makeClient();
    client.dispose();
    expect((client as any).disposed).toBe(true);
  });

  it('nullifies engine reference', async () => {
    const { client } = await makeClient();
    client.dispose();
    expect(client.engine).toBeNull();
  });

  it('clears all key subscribers', async () => {
    const { client } = await makeClient();
    const handler = vi.fn();
    client.onKeyChange('count', handler);
    client.dispose();
    // After dispose, keySubscribers should be empty
    expect((client as any).keySubscribers.size).toBe(0);
  });

  it('clears all wildcard subscribers', async () => {
    const { client } = await makeClient();
    client.onAnyChange(vi.fn());
    client.dispose();
    expect((client as any).wildcardSubscribers.size).toBe(0);
  });

  it('clears the event bus', async () => {
    const { client } = await makeClient();
    client.events.subscribe(vi.fn());
    client.dispose();
    expect(client.events.handlerCount).toBe(0);
  });

  it('stops auto-sync on dispose', async () => {
    const { client } = await makeClient({ autoSync: false });
    vi.useFakeTimers();
    client.startAutoSync(50);
    client.dispose();
    const spy = vi.spyOn(client, 'pullState');
    vi.advanceTimersByTime(200);
    expect(spy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
