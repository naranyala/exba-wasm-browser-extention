import { WasmElement } from '../framework';
import init, { CoreEngine } from '../../wasm/pkg/wasm_unified_core';

export class WasmBenchmark extends WasmElement {
  constructor() {
    super(init as any, CoreEngine as any);
  }

  renderContent(state: any) {
    return `
            <style>
              .bench-box {
                background: rgba(15, 23, 42, 0.4);
                border: 1px dashed rgba(255, 255, 255, 0.08);
                border-radius: 6px;
                padding: 10px;
                font-family: monospace;
                font-size: 12px;
                color: #10b981;
                margin-top: 6px;
              }
              strong {
                color: #38bdf8;
              }
            </style>
            <div>
              <div class="bench-box">
                Last calculated: fib(<strong>${state.count}</strong>) = <strong>${state.fib_val}</strong>
              </div>
            </div>
            `;
  }

  // Public method for JS to invoke calculations inside Rust
  runBenchmark(n: number): number {
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
