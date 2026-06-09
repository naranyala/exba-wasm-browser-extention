/**
 * WasmElement - A custom base class for Web Components backed by Rust-WASM core engines.
 */
export class WasmElement extends HTMLElement {
  /**
   * @param {Function} initWasmFn - The default initialization function exported by wasm-bindgen
   * @param {Class} EngineClass - The Rust WASM engine class (e.g. CoreEngine)
   * @param {Array} initialArgs - Arguments to pass to the engine constructor
   */
  constructor(initWasmFn, EngineClass, initialArgs = []) {
    super();
    this.attachShadow({ mode: 'open' });
    this.initWasmFn = initWasmFn;
    this.EngineClass = EngineClass;
    this.initialArgs = initialArgs;

    this.engine = null;
    this._state = {}; // Internal raw state
    this.state = this.createReactiveState({}); // Reactive Proxy
  }

  // Create a reactive Proxy for state
  createReactiveState(initialState) {
    const self = this;
    return new Proxy(initialState, {
      set(target, property, value) {
        if (target[property] === value) return true;
        target[property] = value;
        // Auto-sync to Rust and re-render
        self.syncStateToRust();
        self.render();
        return true;
      },
    });
  }

  // Lifecycle callback when component is attached to DOM
  async connectedCallback() {
    await this.init();
  }

  // Lifecycle callback when observed attributes change
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue && this.engine) {
      // Sync attribute change back to the state and Rust
      this.state[name] = newValue;
      this.syncStateToRust();
      this.render();
    }
  }

  // Hook to provide arguments to the Rust constructor (can be overridden by subclasses)
  getEngineArgs() {
    return this.initialArgs.length
      ? this.initialArgs
      : [this.getAttribute('title') || 'Wasm Component'];
  }

  async init() {
    try {
      if (!this.engine) {
        // 1. Initialize WASM module
        await this.initWasmFn();

        // 2. Instantiate Rust Core Engine
        this.engine = new this.EngineClass(...this.getEngineArgs());

        // 3. Populate initial state from Rust
        this.syncStateFromRust();
      }
      this.render();
    } catch (error) {
      console.error('[WasmElement] Initialization failed:', error);
      this.shadowRoot.innerHTML = `
        <div style="color: #ef4444; padding: 12px; border: 1px dashed #ef4444; border-radius: 6px; font-size: 12px;">
          <strong>Error loading WASM Core:</strong> ${error.message}
        </div>
      `;
    }
  }

  // Pulls the serialized state from Rust and updates the JS object
  syncStateFromRust() {
    if (!this.engine) return;
    const jsonStr = this.engine.get_state_json();
    try {
      const newState = JSON.parse(jsonStr);
      // Replace the proxy to update the state with new data from Rust
      this.state = this.createReactiveState(newState);
    } catch (e) {
      console.error('[WasmElement] Error parsing Rust state JSON:', e);
    }
  }

  // Pushes the serialized state from JS back to Rust
  syncStateToRust() {
    if (!this.engine) return;
    // We need to get the target object from the proxy to serialize it
    // Or just serialize the proxy directly (JSON.stringify works on proxies)
    this.engine.set_state(JSON.stringify(this.state));
  }

  // Renders HTML from the client. Must be overridden by subclasses.
  render() {
    if (!this.engine) {
      this.renderSkeleton();
      return;
    }

    // Default implementation: Subclasses should override this
    // Or, if using the Rust engine for rendering, they can call this.engine.render()
    this.shadowRoot.innerHTML = this.renderContent ? this.renderContent(this.state) : (this.engine.render ? this.engine.render() : '');
    this.bindEvents();
  }

  renderSkeleton() {
    this.shadowRoot.innerHTML = `
        <style>
          .skeleton-search {
            height: 38px;
            background: rgba(15, 23, 42, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 8px;
            margin-bottom: 14px;
            box-sizing: border-box;
          }
          .skeleton-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }
          .skeleton-card {
            background: rgba(30, 41, 59, 0.25);
            border: 1px solid rgba(255, 255, 255, 0.04);
            border-radius: 10px;
            height: 105px;
            box-sizing: border-box;
            animation: pulse 1.5s infinite alternate;
          }
          @keyframes pulse {
            from { opacity: 0.6; }
            to { opacity: 1; }
          }
        </style>
        <div>
          <div class="skeleton-search"></div>
          <div class="skeleton-grid">
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
          </div>
        </div>
      `;
  }

  // Binds event listeners inside the Shadow DOM
  // Subclasses can override this to add custom bindings
  bindEvents() {
    // 1. Declarative click bindings (elements with data-click="rust_method_name")
    const clickElements = this.shadowRoot.querySelectorAll('[data-click]');
    clickElements.forEach((el) => {
      const methodName = el.getAttribute('data-click');
      el.addEventListener('click', () => {
        if (this.engine && typeof this.engine[methodName] === 'function') {
          this.engine[methodName]();
          this.syncStateFromRust();
          this.render(); // Re-render on state change
        }
      });
    });
  }
}
