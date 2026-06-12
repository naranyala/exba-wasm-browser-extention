import init, { CoreEngine } from '../../wasm/pkg/wasm_unified_core';
import { defineExba, ExbaElement } from '../lib/framework';

export class WasmBenchmark extends ExbaElement {
  constructor() {
    super(init as any, CoreEngine as any);
  }

  // 1. Static UI Structure
  renderInitial() {
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = `
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
          strong { color: #38bdf8; }
        </style>
        <div>
          <div class="bench-box">
            Loading results...
          </div>
        </div>
      `;
    }
  }

  // 2. Reactive Bindings
  setupEffects() {
    this.bindText(
      '.bench-box',
      (s) => `Last calculated: fib(${s.count}) = ${s.fib_val}`,
    );
  }

  // 3. Public API for JS to invoke calculations inside Rust
  runBenchmark(n: number): number {
    if (this.engine) {
      // Direct call into compiled Rust method
      this.engine.run_fibonacci(n);
      this.syncStateFromRust();
      return this.state.value.fib_val;
    }
    return 0;
  }
}

defineExba('wasm-benchmark', WasmBenchmark);
