import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExbaElement, Engine } from './framework';
import { effect } from './reactivity';

// Mock Engine implementation for testing
class MockEngine implements Engine {
  private state: any = { title: 'Initial', count: 0 };

  constructor(title: string) {
    this.state.title = title;
  }

  get_state_json(): string {
    return JSON.stringify(this.state);
  }

  set_state(state_json: string): void {
    this.state = JSON.parse(state_json);
  }
  
  // Custom method to simulate Rust logic
  increment() {
    this.state.count++;
  }
}

// Define a test component
class TestComponent extends ExbaElement {
  public renderInitialCalled = false;
  public setupEffectsCalled = false;

  constructor() {
    super(async () => {}, MockEngine as any, ['Test Title']);
  }

  static get observedAttributes() {
    return ['title'];
  }

  renderInitial() {
    this.renderInitialCalled = true;
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = '<div id="content"></div>';
    }
  }

  setupEffects() {
    this.setupEffectsCalled = true;
  }
}

customElements.define('test-component', TestComponent);

describe('WasmElement', () => {
  let element: TestComponent;

  beforeEach(() => {
    element = document.createElement('test-component') as TestComponent;
    document.body.appendChild(element);
  });

  it('should initialize with correct signal state', async () => {
    // Wait for async init
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(element.state.value.title).toBe('Test Title');
    expect(element.renderInitialCalled).toBe(true);
    expect(element.setupEffectsCalled).toBe(true);
  });

  it('should sync state from "Rust" correctly', async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Manually mutate engine state
    (element as any).engine.increment();
    element.syncStateFromRust();
    
    expect(element.state.value.count).toBe(1);
  });

  it('should sync state to "Rust" correctly', async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
    
    element.state.value = { ...element.state.value, count: 42 };
    element.syncStateToRust();
    
    const engineState = JSON.parse((element as any).engine.get_state_json());
    expect(engineState.count).toBe(42);
  });

  it('should handle attribute changes', async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
    
    element.setAttribute('title', 'New Title');
    // attributeChangedCallback is synchronous for custom elements
    
    expect(element.state.value.title).toBe('New Title');
    const engineState = JSON.parse((element as any).engine.get_state_json());
    expect(engineState.title).toBe('New Title');
  });
});
