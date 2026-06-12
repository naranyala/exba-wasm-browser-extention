import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type Engine, ExbaElement, defineExba } from './framework';
import { ContextKey } from './context';
import { effect } from './reactivity';
import { html } from './render';

// Mock Engine implementation for testing
class MockEngine implements Engine {
  private state: any = { title: 'Initial', count: 0, items: ['A', 'B'], query: '' };

  constructor(title: string) {
    this.state.title = title;
  }

  get_state_json(): string {
    return JSON.stringify(this.state);
  }

  set_state(state_json: string): void {
    this.state = JSON.parse(state_json);
  }

  get_module_manifests_json(): string {
    return JSON.stringify([{ name: 'test_module', state_keys: ['count'] }]);
  }

  increment() {
    this.state.count++;
  }
}

// Define a test component
class TestComponent extends ExbaElement {
  public renderInitialCalled = false;
  public setupEffectsCalled = false;
  public unmountedCalled = false;

  constructor() {
    super(async () => {}, MockEngine as any, ['Test Title']);
  }

  static get observedAttributes() {
    return ['title'];
  }

  renderInitial() {
    this.renderInitialCalled = true;
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = `
        <div id="content"></div>
        <div id="text-bind"></div>
        <div id="attr-bind"></div>
        <div id="style-bind"></div>
        <div id="list-bind"></div>
        <input id="input-bind" type="text" />
        <div id="class-bind"></div>
        <div class="multi"></div>
        <div class="multi"></div>
      `;
    }
  }

  setupEffects() {
    this.setupEffectsCalled = true;
  }

  onUnmounted() {
    this.unmountedCalled = true;
  }
}

// Ensure it's defined via defineExba to get coverage
defineExba('test-component', TestComponent);

describe('WasmElement', () => {
  let element: TestComponent;

  beforeEach(() => {
    // Re-create the element
    element = document.createElement('test-component') as TestComponent;
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (element.parentElement) {
      element.parentElement.removeChild(element);
    }
  });

  it('should initialize with correct signal state', async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(element.state.value.title).toBe('Test Title');
    expect(element.renderInitialCalled).toBe(true);
    expect(element.setupEffectsCalled).toBe(true);
  });

  it('disconnectedCallback handles cleanup', async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    const wasmDispose = vi.spyOn(element.wasm as any, 'dispose');
    element.disconnectedCallback();
    expect(element.unmountedCalled).toBe(true);
    expect(wasmDispose).toHaveBeenCalled();
    expect(element.wasm).toBeNull();
  });

  it('should sync state from "Rust" correctly', async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    (element as any).engine.increment();
    element.syncStateFromRust();
    expect(element.state.value.count).toBe(1);
  });

  it('should sync state to "Rust" correctly', async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    element.state.value = { ...element.state.value, count: 42 };
    element.syncStateToRust();
    const engineState = JSON.parse((element as any).engine.get_state_json());
    expect(engineState.count).toBe(42);
  });

  it('should handle attribute changes', async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    element.setAttribute('title', 'New Title');
    expect(element.state.value.title).toBe('New Title');
    const engineState = JSON.parse((element as any).engine.get_state_json());
    expect(engineState.title).toBe('New Title');
  });

  it('computed works correctly', async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    const comp = element.computed(() => element.state.value.count * 2);
    expect(comp.value).toBe(0);
    element.state.value = { ...element.state.value, count: 5 };
    expect(comp.value).toBe(10);
  });

  it('effect tracks and disposes', async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    let val = 0;
    const dispose = element.effect(() => { val = element.state.value.count; });
    expect(val).toBe(0);
    element.state.value = { ...element.state.value, count: 10 };
    expect(val).toBe(10);
    dispose();
    element.state.value = { ...element.state.value, count: 20 };
    expect(val).toBe(10); // Should not update after dispose
  });

  it('watch tracks and disposes', async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    let newVal = 0;
    element.watch(() => element.state.value.count, (val) => { newVal = val; });
    element.state.value = { ...element.state.value, count: 7 };
    expect(newVal).toBe(7);
  });

  it('untrack reads without subscribing', async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    let val = 0;
    element.effect(() => {
      val = element.untrack(() => element.state.value.count);
    });
    element.state.value = { ...element.state.value, count: 5 };
    expect(val).toBe(0); // untrack prevents dependency registration
  });

  it('createStore creates a deep reactive store', async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    const store = element.createStore({ nested: 1 });
    expect(store.nested).toBe(1);
  });

  it('createRef creates a ref container', async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    const ref = element.createRef();
    expect(ref.current).toBe(null);
  });

  it('provideContext and useContext', async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    const Ctx = new ContextKey<string>('default');
    let val = '';
    element.effect(() => {
      element.provideContext(Ctx, 'provided');
      val = element.useContext(Ctx);
    });
    expect(val).toBe('provided');
  });

  it('bindText updates element textContent', async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    element.bindText('#text-bind', (state) => `Title is ${state.title}`);
    expect(element.$('#text-bind')?.textContent).toBe('Title is Test Title');
    element.state.value = { ...element.state.value, title: 'Changed' };
    expect(element.$('#text-bind')?.textContent).toBe('Title is Changed');
  });

  it('bindAttr updates element attribute', async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    element.bindAttr('#attr-bind', 'data-count', (state) => state.count);
    expect(element.$('#attr-bind')?.getAttribute('data-count')).toBe('0');
    element.state.value = { ...element.state.value, count: 5 };
    expect(element.$('#attr-bind')?.getAttribute('data-count')).toBe('5');
    element.bindAttr('#attr-bind', 'disabled', (state) => state.count === 0 ? true : null);
    element.state.value = { ...element.state.value, count: 0 };
    expect(element.$('#attr-bind')?.hasAttribute('disabled')).toBe(true);
    element.state.value = { ...element.state.value, count: 1 };
    expect(element.$('#attr-bind')?.hasAttribute('disabled')).toBe(false);
  });

  it('bindStyle updates element style', async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    element.bindStyle('#style-bind', 'color', (state) => state.count > 0 ? 'red' : 'blue');
    expect(element.$('#style-bind')?.style.color).toBe('blue');
    element.state.value = { ...element.state.value, count: 1 };
    expect(element.$('#style-bind')?.style.color).toBe('red');
  });

  it('bindList renders lists', async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    element.bindList('#list-bind', (state) => state.items, (item) => `<span>${item}</span>`);
    expect(element.$('#list-bind')?.innerHTML).toBe('<span>A</span><span>B</span>');
  });

  it('show mounts and unmounts', async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    element.show({
      mount: '#content',
      when: () => element.state.value.count > 0,
      children: () => html`<span>Visible</span>`
    });
    expect(element.$('#content')?.innerHTML).toBe('');
    element.state.value = { ...element.state.value, count: 1 };
    expect(element.$('#content')?.innerHTML).toBe('<span>Visible</span>');
  });

  it('for renders keyed lists', async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    element.for({
      mount: '#content',
      each: () => element.state.value.items,
      keyed: (item) => item,
      children: (item) => html`<li>${item}</li>`
    });
    expect(element.$('#content')?.innerHTML).toContain('<li>A</li>');
    expect(element.$('#content')?.innerHTML).toContain('<li>B</li>');
  });

  it('bindValue handles two-way binding', async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    let val = '';
    element.bindValue('#input-bind', () => element.state.value.query, (v) => { val = v; });
    const input = element.$('#input-bind') as HTMLInputElement;
    input.value = 'typed';
    input.dispatchEvent(new Event('input'));
    expect(val).toBe('typed');
  });

  it('toggleClass adds and removes classes', async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    element.toggleClass('#class-bind', {
      active: () => element.state.value.count > 0
    });
    const el = element.$('#class-bind');
    expect(el?.classList.contains('active')).toBe(false);
    element.state.value = { ...element.state.value, count: 1 };
    expect(el?.classList.contains('active')).toBe(true);
  });

  it('$ and $$ query selectors', async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(element.$('#content')).not.toBeNull();
    expect(element.$$('.multi').length).toBe(2);
  });

  it('getModuleManifests returns manifests', async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    const manifests = element.getModuleManifests();
    expect(manifests).toHaveLength(1);
    expect(manifests[0].name).toBe('test_module');
  });

  it('validateState works', async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    const missing = element.validateState(['count', 'missing_key']);
    expect(missing).toEqual(['missing_key']);
  });

  it('on attaches event listener and syncs state', async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    const spy = vi.spyOn(element, 'syncStateToRust');
    let called = false;
    element.on('#content', 'click', () => { called = true; });
    element.$('#content')?.dispatchEvent(new Event('click'));
    expect(called).toBe(true);
    expect(spy).toHaveBeenCalled();
  });
});
