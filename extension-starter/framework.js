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
    this.state = {};
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
    return this.initialArgs.length ? this.initialArgs : [this.getAttribute('title') || 'Wasm Component'];
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
      this.state = JSON.parse(jsonStr);
    } catch (e) {
      console.error('[WasmElement] Error parsing Rust state JSON:', e);
    }
  }

  // Pushes the serialized state from JS back to Rust
  syncStateToRust() {
    if (!this.engine) return;
    this.engine.set_state(JSON.stringify(this.state));
  }

  // Renders HTML from the Rust Engine and binds events
  render() {
    if (!this.engine) {
      this.shadowRoot.innerHTML = `
        <div style="color: #94a3b8; font-family: sans-serif; font-size: 12px;">
          Initializing WASM Core...
        </div>
      `;
      return;
    }
    
    // Get HTML directly from the Rust render engine!
    this.shadowRoot.innerHTML = this.engine.render();
    this.bindEvents();
  }

  // Binds event listeners inside the Shadow DOM
  bindEvents() {
    // 1. Declarative click bindings (elements with data-click="rust_method_name")
    const clickElements = this.shadowRoot.querySelectorAll('[data-click]');
    clickElements.forEach(el => {
      const methodName = el.getAttribute('data-click');
      el.addEventListener('click', () => {
        if (this.engine && typeof this.engine[methodName] === 'function') {
          this.engine[methodName]();
          this.syncStateFromRust();
          this.render(); // Re-render on state change
        }
      });
    });

    // 2. Specific bindings for adding items in our demo form
    const addBtn = this.shadowRoot.querySelector('#btn-add');
    const inputEl = this.shadowRoot.querySelector('#item-input');
    if (addBtn && inputEl) {
      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addBtn.click();
        }
      });

      addBtn.addEventListener('click', () => {
        const text = inputEl.value.trim();
        if (text) {
          this.engine.add_item(text);
          inputEl.value = ''; // Reset input
          this.syncStateFromRust();
          this.render();
        }
      });
    }

    // 3. Specific bindings for delete item buttons (list item deletions)
    const deleteBtns = this.shadowRoot.querySelectorAll('.delete-btn');
    deleteBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (!isNaN(idx)) {
          this.engine.delete_item(idx);
          this.syncStateFromRust();
          this.render();
        }
      });
    });
  }
}
