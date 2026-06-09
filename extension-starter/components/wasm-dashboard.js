import { WasmElement } from '../framework.js';
import init, { CoreEngine } from '../wasm/pkg/wasm_unified_core.js';

export class WasmDashboard extends WasmElement {
  constructor() {
    // Pass the compile wrapper and Rust CoreEngine class constructor
    super(init, CoreEngine);
  }

  static get observedAttributes() {
    return ['title'];
  }
}

customElements.define('wasm-dashboard', WasmDashboard);
