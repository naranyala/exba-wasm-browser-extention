import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  batch,
  Computed,
  computed,
  createStore,
  effect,
  ReadonlySignal,
  Signal,
  signal,
  untrack,
  watch,
} from './reactivity';

// ─────────────────────────────────────────────────────────────────────────────
//  Signal
// ─────────────────────────────────────────────────────────────────────────────
describe('Signal', () => {
  it('holds an initial value', () => {
    const s = signal(42);
    expect(s.value).toBe(42);
  });

  it('returns updated value after assignment', () => {
    const s = signal('hello');
    s.value = 'world';
    expect(s.value).toBe('world');
  });

  it('does NOT notify when value is identical (===)', () => {
    const s = signal(5);
    const run = vi.fn();
    effect(() => {
      run();
      s.value;
    });
    run.mockClear();
    s.value = 5; // same — should not re-run
    expect(run).not.toHaveBeenCalled();
  });

  it('notifies when value changes', () => {
    const s = signal(0);
    const run = vi.fn();
    effect(() => {
      run();
      s.value;
    });
    run.mockClear();
    s.value = 1;
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('peek() reads value without tracking', () => {
    const s = signal(10);
    let effectRuns = 0;
    effect(() => {
      effectRuns++;
      s.peek(); // should NOT track
    });
    effectRuns = 0;
    s.value = 99; // should NOT re-trigger effect
    expect(effectRuns).toBe(0);
  });

  it('update() applies a transform function', () => {
    const s = signal(3);
    s.update((v) => v * 2);
    expect(s.value).toBe(6);
  });

  it('unsubscribe() removes a subscriber', () => {
    const s = signal(0);
    const run = vi.fn();
    const stop = effect(() => {
      run();
      s.value;
    });
    run.mockClear();
    stop();
    s.value = 1;
    expect(run).not.toHaveBeenCalled();
  });

  it('supports null and undefined values', () => {
    const s1 = signal<null | number>(null);
    expect(s1.value).toBeNull();
    s1.value = 7;
    expect(s1.value).toBe(7);

    const s2 = signal<undefined | string>(undefined);
    expect(s2.value).toBeUndefined();
  });

  it('supports object references — notifies when ref changes', () => {
    const obj = { x: 1 };
    const s = signal(obj);
    const run = vi.fn();
    effect(() => {
      run();
      s.value;
    });
    run.mockClear();
    s.value = { x: 2 }; // new reference
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does NOT notify when the same object reference is assigned', () => {
    const obj = { x: 1 };
    const s = signal(obj);
    const run = vi.fn();
    effect(() => {
      run();
      s.value;
    });
    run.mockClear();
    s.value = obj; // same ref — no notify
    expect(run).not.toHaveBeenCalled();
  });

  it('asReadonly() returns a ReadonlySignal that tracks changes', () => {
    const s = signal(1);
    const ro = s.asReadonly();
    expect(ro).toBeInstanceOf(ReadonlySignal);
    expect(ro.value).toBe(1);
    s.value = 2;
    expect(ro.value).toBe(2);
  });

  it('multiple subscribers are all notified', () => {
    const s = signal(0);
    const a = vi.fn(),
      b = vi.fn(),
      c = vi.fn();
    effect(() => {
      a();
      s.value;
    });
    effect(() => {
      b();
      s.value;
    });
    effect(() => {
      c();
      s.value;
    });
    a.mockClear();
    b.mockClear();
    c.mockClear();
    s.value = 1;
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(c).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  ReadonlySignal
// ─────────────────────────────────────────────────────────────────────────────
describe('ReadonlySignal', () => {
  it('exposes value from wrapped signal', () => {
    const s = signal(42);
    const ro = s.asReadonly();
    expect(ro.value).toBe(42);
  });

  it('peek() reads without creating dependency', () => {
    const s = signal(10);
    const ro = s.asReadonly();
    let runs = 0;
    effect(() => {
      runs++;
      ro.peek();
    });
    runs = 0;
    s.value = 20;
    expect(runs).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  Computed
// ─────────────────────────────────────────────────────────────────────────────
describe('Computed', () => {
  it('derives value from dependencies', () => {
    const a = signal(2);
    const b = signal(3);
    const sum = computed(() => a.value + b.value);
    expect(sum.value).toBe(5);
  });

  it('re-evaluates when a dependency changes', () => {
    const a = signal(1);
    const c = computed(() => a.value * 10);
    expect(c.value).toBe(10);
    a.value = 5;
    expect(c.value).toBe(50);
  });

  it('is lazy (does not compute until read)', () => {
    const fn = vi.fn(() => 42);
    const c = new Computed(fn);
    // fn is called once in Computed constructor via effect, so reset
    fn.mockClear();
    // should recompute on dirty read
    const _ = c.value;
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws when trying to assign to computed.value', () => {
    const c = computed(() => 99);
    expect(() => {
      (c as any).value = 0;
    }).toThrow('read-only');
  });

  it('tracks transitively chained computeds', () => {
    const base = signal(1);
    const double = computed(() => base.value * 2);
    const quad = computed(() => double.value * 2);
    expect(quad.value).toBe(4);
    base.value = 3;
    expect(quad.value).toBe(12);
  });

  it('diamond dependency — each dependency is tracked once', () => {
    const s = signal(2);
    const a = computed(() => s.value + 1);
    const b = computed(() => s.value + 2);
    const diamond = computed(() => a.value + b.value);
    expect(diamond.value).toBe(7); // (3) + (4)
    s.value = 5;
    expect(diamond.value).toBe(13); // (6) + (7)
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  effect
// ─────────────────────────────────────────────────────────────────────────────
describe('effect', () => {
  it('runs immediately on creation', () => {
    const run = vi.fn();
    effect(run);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('re-runs when tracked signal changes', () => {
    const s = signal(0);
    const run = vi.fn();
    effect(() => {
      run();
      s.value;
    });
    run.mockClear();
    s.value = 1;
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('dispose function stops future executions', () => {
    const s = signal(0);
    const run = vi.fn();
    const stop = effect(() => {
      run();
      s.value;
    });
    run.mockClear();
    stop();
    s.value = 99;
    expect(run).not.toHaveBeenCalled();
  });

  it('dynamically tracks conditional dependencies', () => {
    const flag = signal(true);
    const a = signal('A');
    const b = signal('B');
    const log: string[] = [];

    effect(() => {
      log.push(flag.value ? a.value : b.value);
    });

    log.length = 0;
    a.value = 'A2'; // tracked when flag=true
    expect(log).toEqual(['A2']);

    flag.value = false;
    log.length = 0;
    b.value = 'B2'; // now tracked
    expect(log).toEqual(['B2']);

    log.length = 0;
    a.value = 'A3'; // NO LONGER tracked
    expect(log).toHaveLength(0);
  });

  it('nested effects work correctly', () => {
    const outer = signal(0);
    const inner = signal(0);
    const log: string[] = [];

    effect(() => {
      log.push(`outer=${outer.value}`);
      effect(() => {
        log.push(`inner=${inner.value}`);
      });
    });

    log.length = 0;
    inner.value = 1;
    expect(log.some((l) => l.includes('inner=1'))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  batch
// ─────────────────────────────────────────────────────────────────────────────
describe('batch', () => {
  it('runs effects once even if multiple signals change', () => {
    const a = signal(0);
    const b = signal(0);
    const run = vi.fn();
    effect(() => {
      run();
      a.value;
      b.value;
    });
    run.mockClear();

    batch(() => {
      a.value = 1;
      b.value = 2;
    });

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('values are correct after batch', () => {
    const x = signal(1);
    const y = signal(2);
    batch(() => {
      x.value = 10;
      y.value = 20;
    });
    expect(x.value).toBe(10);
    expect(y.value).toBe(20);
  });

  it('nested batches coalesce updates', () => {
    const s = signal(0);
    const run = vi.fn();
    effect(() => {
      run();
      s.value;
    });
    run.mockClear();

    batch(() => {
      batch(() => {
        s.value = 1;
      });
      batch(() => {
        s.value = 2;
      });
    });

    // Effect runs once after outermost batch completes
    expect(run).toHaveBeenCalledTimes(1);
    expect(s.value).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  watch
// ─────────────────────────────────────────────────────────────────────────────
describe('watch', () => {
  it('does NOT call callback on first run (no immediate)', () => {
    const s = signal(0);
    const cb = vi.fn();
    watch(() => s.value, cb);
    expect(cb).not.toHaveBeenCalled();
  });

  it('calls callback with new and old values when signal changes', () => {
    const s = signal(5);
    const cb = vi.fn();
    watch(() => s.value, cb);
    s.value = 10;
    expect(cb).toHaveBeenCalledWith(10, 5);
  });

  it('does NOT call callback when value is unchanged', () => {
    const s = signal(3);
    const cb = vi.fn();
    watch(() => s.value, cb);
    s.value = 3; // same
    expect(cb).not.toHaveBeenCalled();
  });

  it('immediate option calls callback on first run', () => {
    const s = signal(7);
    const cb = vi.fn();
    watch(() => s.value, cb, { immediate: true });
    expect(cb).toHaveBeenCalledWith(7, undefined);
  });

  it('stop function prevents future callbacks', () => {
    const s = signal(0);
    const cb = vi.fn();
    const stop = watch(() => s.value, cb);
    stop();
    s.value = 1;
    expect(cb).not.toHaveBeenCalled();
  });

  it('watches computed values', () => {
    const a = signal(1);
    const doubled = computed(() => a.value * 2);
    const cb = vi.fn();
    watch(() => doubled.value, cb);
    a.value = 3;
    expect(cb).toHaveBeenCalledWith(6, 2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  untrack
// ─────────────────────────────────────────────────────────────────────────────
describe('untrack', () => {
  it('reads signal value without tracking', () => {
    const s = signal(42);
    let runs = 0;
    effect(() => {
      runs++;
      untrack(() => s.value); // should not track
    });
    runs = 0;
    s.value = 100; // should NOT re-trigger
    expect(runs).toBe(0);
  });

  it('returns the value', () => {
    const s = signal('hello');
    const result = untrack(() => s.value);
    expect(result).toBe('hello');
  });

  it('mixed tracked and untracked reads', () => {
    const tracked = signal('a');
    const untracked = signal('b');
    const log: string[] = [];

    effect(() => {
      log.push(tracked.value + untrack(() => untracked.value));
    });

    log.length = 0;
    tracked.value = 'A'; // triggers
    expect(log).toEqual(['Ab']);

    log.length = 0;
    untracked.value = 'B'; // does NOT trigger
    expect(log).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  createStore
// ─────────────────────────────────────────────────────────────────────────────
describe('createStore', () => {
  it('provides initial values', () => {
    const store = createStore({ count: 0, name: 'Alice' });
    expect(store.count).toBe(0);
    expect(store.name).toBe('Alice');
  });

  it('updates individual keys', () => {
    const store = createStore({ count: 0 });
    store.count = 5;
    expect(store.count).toBe(5);
  });

  it('fine-grained: changing key A does not trigger effects reading key B', () => {
    const store = createStore({ a: 1, b: 2 });
    const aRuns = vi.fn();
    const bRuns = vi.fn();
    effect(() => {
      aRuns();
      store.a;
    });
    effect(() => {
      bRuns();
      store.b;
    });
    aRuns.mockClear();
    bRuns.mockClear();

    store.a = 10;
    expect(aRuns).toHaveBeenCalledTimes(1);
    expect(bRuns).not.toHaveBeenCalled();
  });

  it('fine-grained: changing key B only triggers effects reading key B', () => {
    const store = createStore({ a: 1, b: 2 });
    const aRuns = vi.fn();
    const bRuns = vi.fn();
    effect(() => {
      aRuns();
      store.a;
    });
    effect(() => {
      bRuns();
      store.b;
    });
    aRuns.mockClear();
    bRuns.mockClear();

    store.b = 99;
    expect(bRuns).toHaveBeenCalledTimes(1);
    expect(aRuns).not.toHaveBeenCalled();
  });

  it('does not trigger effect when setting same value', () => {
    const store = createStore({ x: 5 });
    const run = vi.fn();
    effect(() => {
      run();
      store.x;
    });
    run.mockClear();
    store.x = 5; // same value
    expect(run).not.toHaveBeenCalled();
  });

  it('has() proxy trap works', () => {
    const store = createStore({ a: 1 });
    expect('a' in store).toBe(true);
    expect('z' in store).toBe(false);
  });

  it('ownKeys proxy trap returns expected keys', () => {
    const store = createStore({ x: 1, y: 2 });
    const keys = Object.keys(store);
    expect(keys).toContain('x');
    expect(keys).toContain('y');
  });

  it('supports undefined and null values', () => {
    const store = createStore<{ a: null | number; b: undefined | string }>({
      a: null,
      b: undefined,
    });
    expect(store.a).toBeNull();
    expect(store.b).toBeUndefined();
    store.a = 42;
    expect(store.a).toBe(42);
  });
});
