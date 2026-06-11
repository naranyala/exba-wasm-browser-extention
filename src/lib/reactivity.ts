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
  private effectRef: () => void;

  constructor(fn: () => T) {
    super(undefined as any);
    this.fn = fn;
    this.effectRef = effect(() => {
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
    }
  };
  subscriber.run();
  return () => {
    for (const dep of subscriber.dependencies) {
      dep.unsubscribe(subscriber);
    }
    subscriber.dependencies.clear();
  };
}

export function watch<T>(source: () => T, cb: (val: T, oldVal: T) => void, options: { immediate?: boolean } = {}) {
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
