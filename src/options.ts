import './components/wasm-benchmark';

// Define the interface for the custom element for easier typing
interface WasmBenchmark extends HTMLElement {
  runBenchmark(n: number): number;
  render(): void;
}

// Native JS iterative Fibonacci implementation
function jsFibonacci(n: number): number {
  if (n <= 1) return n;
  let a = 0;
  let b = 1;
  for (let i = 2; i <= n; i++) {
    const temp = a + b;
    a = b;
    b = temp;
  }
  return b;
}

document.addEventListener('DOMContentLoaded', () => {
  const defaultColorSelect = document.getElementById('default-color') as HTMLSelectElement | null;
  const autoApplyCheckbox = document.getElementById('auto-apply') as HTMLInputElement | null;
  const btnSave = document.getElementById('btn-save') as HTMLButtonElement | null;
  const statusMsg = document.getElementById('status-msg') as HTMLParagraphElement | null;

  const btnBenchmark = document.getElementById('btn-run-benchmark') as HTMLButtonElement | null;
  const jsResult = document.getElementById('js-benchmark-result') as HTMLParagraphElement | null;
  const wasmBenchComponent = document.getElementById('wasm-bench') as WasmBenchmark | null;
  const nInput = document.getElementById('benchmark-n') as HTMLInputElement | null;
  const statusInfo = document.getElementById('status-info') as HTMLParagraphElement | null;

  // 1. Load Configurations from Chrome Storage
  chromeAPI.storage.local.get<any>(['favoriteColor', 'autoApply']).then((result) => {
    if (typeof result.favoriteColor === 'string' && defaultColorSelect) {
      defaultColorSelect.value = result.favoriteColor;
    }
    if (autoApplyCheckbox) {
      autoApplyCheckbox.checked = !!result.autoApply;
    }
  });

  // 2. Save Configurations
  btnSave?.addEventListener('click', async () => {
    const color = defaultColorSelect?.value || '';
    const apply = autoApplyCheckbox?.checked || false;

    await chromeAPI.storage.local.set({
      favoriteColor: color,
      autoApply: apply,
    });

    if (statusMsg) {
      statusMsg.textContent = 'Settings saved successfully!';
      setTimeout(() => {
        statusMsg.textContent = '';
      }, 2000);
    }
  });

  // 3. Wasm Load Status Update
  // Once the custom element is defined, we can listen or assume it's ready since it handles its own connectedCallback
  setTimeout(() => {
    if (wasmBenchComponent && wasmBenchComponent.shadowRoot) {
      if (statusInfo) {
        statusInfo.textContent = 'Wasm Benchmark Engine Ready';
        statusInfo.style.color = '#10b981';
      }
    }
  }, 1000);

  // 4. Run Benchmark
  btnBenchmark?.addEventListener('click', () => {
    const n = nInput ? parseInt(nInput.value, 10) : NaN;
    if (isNaN(n) || n < 0) {
      alert('Please enter a valid non-negative number.');
      return;
    }

    btnBenchmark.disabled = true;
    btnBenchmark.textContent = 'Running...';
    if (jsResult) jsResult.textContent = 'Running JS benchmark...';

    // Trigger placeholder update inside custom Web Component shadow DOM
    const wasmResultBox = wasmBenchComponent?.shadowRoot?.querySelector('.bench-box');
    if (wasmResultBox) {
      wasmResultBox.textContent = 'Running Wasm benchmark...';
      (wasmResultBox as HTMLElement).style.color = '#38bdf8';
    }

    setTimeout(() => {
      const iterations = 500000;

      // Benchmark JavaScript
      const jsStart = performance.now();
      let jsVal = 0;
      for (let i = 0; i < iterations; i++) {
        jsVal = jsFibonacci(n);
      }
      const jsEnd = performance.now();
      const jsDuration = jsEnd - jsStart;
      if (jsResult) jsResult.textContent = `Result: ${jsVal} | Time: ${jsDuration.toFixed(2)}ms (for ${iterations.toLocaleString()} runs)`;

      // Benchmark Rust WASM (via Web Component method)
      let wasmVal = 0;
      if (wasmBenchComponent) {
        const wasmStart = performance.now();
        for (let i = 0; i < iterations; i++) {
          wasmVal = wasmBenchComponent.runBenchmark(n);
        }
        const wasmEnd = performance.now();
        const wasmDuration = wasmEnd - wasmStart;

        // Re-trigger layout render inside Web Component
        wasmBenchComponent.render();

        const ratio = jsDuration / wasmDuration;
        let comparison;
        if (ratio > 1) {
          comparison = `Rust WASM is ~${ratio.toFixed(1)}x faster than JS.`;
        } else {
          comparison = `Rust WASM is comparable to JS (JS is ~${(1 / ratio).toFixed(1)}x faster due to JIT optimizations).`;
        }

        if (statusInfo) {
          statusInfo.textContent = `Benchmark Complete. ${comparison}`;
        }
      }

      btnBenchmark.disabled = false;
      btnBenchmark.textContent = 'Run Speed Test';
    }, 100);
  });
});
