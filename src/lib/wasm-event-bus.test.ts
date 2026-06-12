import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WasmModuleEvent } from '../wasm-types';
import { WasmEventBus } from './wasm-event-bus';

// ─── Helper ───────────────────────────────────────────────────────────────────
function makeEvent(
  module: string,
  name: string,
  data: any = {},
): WasmModuleEvent {
  return { module, name, data };
}

// ─────────────────────────────────────────────────────────────────────────────
describe('WasmEventBus', () => {
  let bus: WasmEventBus;

  beforeEach(() => {
    bus = new WasmEventBus();
  });

  // ── subscribe (wildcard) ────────────────────────────────────────────────────
  describe('subscribe() — wildcard', () => {
    it('receives all events from all modules', () => {
      const handler = vi.fn();
      bus.subscribe(handler);
      bus.feed([
        makeEvent('crypto', 'password_generated', {}),
        makeEvent('text', 'text_processed', {}),
        makeEvent('menu', 'filtered', {}),
      ]);
      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('dispose function removes wildcard handler', () => {
      const handler = vi.fn();
      const dispose = bus.subscribe(handler);
      dispose();
      bus.feed([makeEvent('crypto', 'password_generated')]);
      expect(handler).not.toHaveBeenCalled();
    });

    it('multiple wildcard handlers all fire', () => {
      const a = vi.fn(),
        b = vi.fn();
      bus.subscribe(a);
      bus.subscribe(b);
      bus.feed([makeEvent('mod', 'evt')]);
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });
  });

  // ── subscribeModule ─────────────────────────────────────────────────────────
  describe('subscribeModule()', () => {
    it('only fires for the named module', () => {
      const handler = vi.fn();
      bus.subscribeModule('crypto', handler);
      bus.feed([
        makeEvent('crypto', 'password_generated'),
        makeEvent('text', 'text_processed'),
      ]);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].module).toBe('crypto');
    });

    it('does not fire when no events from subscribed module', () => {
      const handler = vi.fn();
      bus.subscribeModule('menu', handler);
      bus.feed([makeEvent('crypto', 'password_generated')]);
      expect(handler).not.toHaveBeenCalled();
    });

    it('dispose function removes module-specific handler', () => {
      const handler = vi.fn();
      const dispose = bus.subscribeModule('crypto', handler);
      dispose();
      bus.feed([makeEvent('crypto', 'password_generated')]);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ── subscribeEvent ──────────────────────────────────────────────────────────
  describe('subscribeEvent()', () => {
    it('only fires for the named event type', () => {
      const handler = vi.fn();
      bus.subscribeEvent('password_generated', handler);
      bus.feed([
        makeEvent('crypto', 'password_generated'),
        makeEvent('crypto', 'hash_calculated'),
      ]);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('fires for the same event name from different modules', () => {
      const handler = vi.fn();
      bus.subscribeEvent('filtered', handler);
      bus.feed([
        makeEvent('menu', 'filtered'),
        makeEvent('search', 'filtered'), // another module — same event name
      ]);
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('dispose function removes event-name handler', () => {
      const handler = vi.fn();
      const dispose = bus.subscribeEvent('password_generated', handler);
      dispose();
      bus.feed([makeEvent('crypto', 'password_generated')]);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ── subscribeExact ──────────────────────────────────────────────────────────
  describe('subscribeExact()', () => {
    it('only fires when both module AND event name match', () => {
      const handler = vi.fn();
      bus.subscribeExact('crypto', 'password_generated', handler);
      bus.feed([
        makeEvent('crypto', 'password_generated'), // MATCH
        makeEvent('crypto', 'calculate_hash'), // wrong event
        makeEvent('menu', 'password_generated'), // wrong module
      ]);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('dispose function removes exact handler', () => {
      const handler = vi.fn();
      const dispose = bus.subscribeExact(
        'crypto',
        'password_generated',
        handler,
      );
      dispose();
      bus.feed([makeEvent('crypto', 'password_generated')]);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ── feed ────────────────────────────────────────────────────────────────────
  describe('feed()', () => {
    it('delivers event data correctly to handler', () => {
      const handler = vi.fn();
      bus.subscribe(handler);
      const evt = makeEvent('crypto', 'password_generated', { length: 16 });
      bus.feed([evt]);
      expect(handler).toHaveBeenCalledWith(evt);
    });

    it('handles empty array gracefully', () => {
      const handler = vi.fn();
      bus.subscribe(handler);
      bus.feed([]);
      expect(handler).not.toHaveBeenCalled();
    });

    it('a single event can trigger multiple subscription types simultaneously', () => {
      const wildcard = vi.fn();
      const byModule = vi.fn();
      const byEvent = vi.fn();
      const exact = vi.fn();

      bus.subscribe(wildcard);
      bus.subscribeModule('crypto', byModule);
      bus.subscribeEvent('password_generated', byEvent);
      bus.subscribeExact('crypto', 'password_generated', exact);

      bus.feed([makeEvent('crypto', 'password_generated', { length: 20 })]);

      expect(wildcard).toHaveBeenCalledTimes(1);
      expect(byModule).toHaveBeenCalledTimes(1);
      expect(byEvent).toHaveBeenCalledTimes(1);
      expect(exact).toHaveBeenCalledTimes(1);
    });
  });

  // ── clear ───────────────────────────────────────────────────────────────────
  describe('clear()', () => {
    it('removes all handlers', () => {
      const h1 = vi.fn(),
        h2 = vi.fn(),
        h3 = vi.fn();
      bus.subscribe(h1);
      bus.subscribeModule('crypto', h2);
      bus.subscribeEvent('evt', h3);
      bus.clear();
      bus.feed([makeEvent('crypto', 'evt')]);
      expect(h1).not.toHaveBeenCalled();
      expect(h2).not.toHaveBeenCalled();
      expect(h3).not.toHaveBeenCalled();
    });
  });

  // ── handlerCount ────────────────────────────────────────────────────────────
  describe('handlerCount', () => {
    it('starts at 0', () => {
      expect(bus.handlerCount).toBe(0);
    });

    it('increments for each added handler', () => {
      bus.subscribe(vi.fn());
      bus.subscribeModule('crypto', vi.fn());
      bus.subscribeEvent('evt', vi.fn());
      bus.subscribeExact('mod', 'evt', vi.fn());
      expect(bus.handlerCount).toBe(4);
    });

    it('decrements when dispose is called', () => {
      const dispose = bus.subscribe(vi.fn());
      expect(bus.handlerCount).toBe(1);
      dispose();
      expect(bus.handlerCount).toBe(0);
    });

    it('returns 0 after clear()', () => {
      bus.subscribe(vi.fn());
      bus.subscribeModule('mod', vi.fn());
      bus.clear();
      expect(bus.handlerCount).toBe(0);
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────────────
  describe('edge cases', () => {
    it('feeding an event with empty module string does not crash', () => {
      const handler = vi.fn();
      bus.subscribe(handler);
      expect(() => bus.feed([makeEvent('', 'any_event')])).not.toThrow();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('same handler can be subscribed via multiple channels', () => {
      const handler = vi.fn();
      bus.subscribe(handler);
      bus.subscribeModule('crypto', handler);
      bus.feed([makeEvent('crypto', 'password_generated')]);
      // Called once as wildcard, once as module-specific
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });
});
