import { WasmElement } from '../framework.js';
import init, { CoreEngine } from '../wasm/pkg/wasm_unified_core.js';

export class WasmBenchmark extends WasmElement {
  constructor() {
    super(init, CoreEngine);
  }

  // Override render to call our custom benchmark renderer in Rust
  render() {
    if (!this.engine) {
      this.shadowRoot.innerHTML = `
        <div style="color: #94a3b8; font-family: monospace; font-size: 12px; margin-top: 8px;">
          Initializing Wasm Core...
        </div>
      `;
      return;
    }
    this.shadowRoot.innerHTML = this.engine.render_benchmark();
  }

  // Public method for JS to invoke calculations inside Rust
  runBenchmark(n) {
    if (this.engine) {
      // Direct call into compiled Rust method
      this.engine.run_fibonacci(n);
      this.syncStateFromRust();
      this.render();
      return this.state.fib_val;
    }
    return 0;
  }
}

customElements.define('wasm-benchmark', WasmBenchmark);
