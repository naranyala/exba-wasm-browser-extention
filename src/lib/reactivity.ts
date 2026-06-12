type Subscriber = {
  run: () => void;
  dependencies: Set<Signal<any>>;
};

let activeSubscriber: Subscriber | null = null;
let batching = false;
const pendingSubscribers = new Set<Subscriber>();

/**
 * Custom Signal class for fine-grained reactivity.
 */
export class Signal<T> {
  protected _value: T;
  protected subscribers = new Set<Subscriber>();

  constructor(value: T) {
    this._value = value;
  }

  get value(): T {
    if (activeSubscriber) {
      this.subscribers.add(activeSubscriber);
      activeSubscriber.dependencies.add(this);
    }
    return this._value;
  }

  set value(newValue: T) {
    if (this._value !== newValue) {
      this._value = newValue;
      this.notify();
    }
  }

  peek(): T {
    return this._value;
  }

  update(fn: (val: T) => T) {
    this.value = fn(this._value);
  }

  unsubscribe(subscriber: Subscriber) {
    this.subscribers.delete(subscriber);
  }

  protected notify() {
    if (batching) {
      for (const sub of this.subscribers) {
        pendingSubscribers.add(sub);
      }
      return;
    }
    const subs = Array.from(this.subscribers);
    for (const sub of subs) {
      sub.run();
    }
  }

  asReadonly(): ReadonlySignal<T> {
    return new ReadonlySignal(this);
  }
}

export class ReadonlySignal<T> {
  constructor(private signal: Signal<T>) {}
  get value(): T {
    return this.signal.value;
  }
  peek(): T {
    return this.signal.peek();
  }
}

export class Computed<T> extends Signal<T> {
  private fn: () => T;
  private dirty = true;
  private disposeEffect: (() => void) | null = null;

  constructor(fn: () => T) {
    super(undefined as any);
    this.fn = fn;
    this.disposeEffect = effect(() => {
      this.fn();
      this.dirty = true;
      this.notify();
    });
  }

  get value(): T {
    if (this.dirty) {
      this._value = this.fn();
      this.dirty = false;
    }
    if (activeSubscriber) {
      this.subscribers.add(activeSubscriber);
      activeSubscriber.dependencies.add(this);
    }
    return this._value;
  }

  set value(_v: T) {
    throw new Error('Computed signals are read-only');
  }
}

export function signal<T>(value: T): Signal<T> {
  return new Signal(value);
}

export function computed<T>(fn: () => T): Computed<T> {
  return new Computed(fn);
}

export function batch(fn: () => void) {
  const prevBatching = batching;
  batching = true;
  try {
    fn();
  } finally {
    batching = prevBatching;
    if (!batching) {
      const subs = Array.from(pendingSubscribers);
      pendingSubscribers.clear();
      for (const sub of subs) {
        sub.run();
      }
    }
  }
}

export function effect(fn: () => void): () => void {
  const subscriber: Subscriber = {
    dependencies: new Set(),
    run() {
      for (const dep of this.dependencies) {
        dep.unsubscribe(this);
      }
      this.dependencies.clear();
      const prevSubscriber = activeSubscriber;
      activeSubscriber = this;
      try {
        fn();
      } finally {
        activeSubscriber = prevSubscriber;
      }
    },
  };
  subscriber.run();
  return () => {
    for (const dep of subscriber.dependencies) {
      dep.unsubscribe(subscriber);
    }
    subscriber.dependencies.clear();
  };
}

export function watch<T>(
  source: () => T,
  cb: (val: T, oldVal: T) => void,
  options: { immediate?: boolean } = {},
) {
  let oldVal: T;
  let firstRun = true;
  const stop = effect(() => {
    const newVal = source();
    if (firstRun) {
      oldVal = newVal;
      firstRun = false;
      if (options.immediate) cb(newVal, undefined as any);
      return;
    }
    if (newVal !== oldVal) {
      cb(newVal, oldVal);
      oldVal = newVal;
    }
  });
  return stop;
}

// ════════════════════════════════════════════════════════════
//  untrack — Read signals without creating dependencies
// ════════════════════════════════════════════════════════════

/**
 * Execute a function without tracking any signal reads inside it.
 * Useful for reading signal values in callbacks without creating subscriptions.
 *
 * @example
 * ```ts
 * const count = untrack(() => state.value.count);
 * ```
 */
export function untrack<T>(fn: () => T): T {
  const prev = activeSubscriber;
  activeSubscriber = null;
  try {
    return fn();
  } finally {
    activeSubscriber = prev;
  }
}

// ════════════════════════════════════════════════════════════
//  createStore — Deep reactive proxy store
// ════════════════════════════════════════════════════════════

/**
 * Create a deep reactive store with path-level tracking.
 * Each property access inside an effect is individually tracked,
 * so changing one key only triggers effects that read that specific key.
 *
 * Unlike a plain `signal({})`, this enables fine-grained reactivity
 * where changing `store.foo` won't re-run effects that only read `store.bar`.
 *
 * @example
 * ```ts
 * const store = createStore({ count: 0, name: 'hello' });
 *
 * effect(() => {
 *   console.log(store.count); // only re-runs when count changes
 * });
 *
 * store.count = 5; // triggers the effect above
 * store.name = 'world'; // does NOT trigger it
 * ```
 */
export function createStore<T extends Record<string, unknown>>(initial: T): T {
  const _target = { ...initial } as Record<string, unknown>;
  const _signals = new Map<string, Signal<any>>();

  const getSignal = (key: string): Signal<any> => {
    if (!_signals.has(key)) {
      _signals.set(key, signal(_target[key]));
    }
    return _signals.get(key)!;
  };

  return new Proxy(_target, {
    get(_target, key: string | symbol) {
      if (typeof key !== 'string') return (_target as any)[key];
      return getSignal(key).value;
    },
    set(_target, key: string | symbol, value: unknown) {
      if (typeof key !== 'string') {
        (_target as any)[key] = value;
        return true;
      }
      const sig = getSignal(key);
      if (sig.peek() !== value) {
        _target[key] = value;
        sig.value = value;
      }
      return true;
    },
    has(_target, key) {
      if (typeof key === 'string' && _signals.has(key)) return true;
      return key in _target;
    },
    ownKeys(_target) {
      return Reflect.ownKeys(_target);
    },
    getOwnPropertyDescriptor(_target, key) {
      return Reflect.getOwnPropertyDescriptor(_target, key);
    },
  }) as unknown as T;
}
