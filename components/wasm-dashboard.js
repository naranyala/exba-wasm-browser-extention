import { WasmElement } from '../framework.js';
import init, { CoreEngine } from '../wasm/pkg/wasm_unified_core.js';
import { chromeAPI } from '../lib/chrome.js';

export class WasmDashboard extends WasmElement {
  constructor() {
    super(init, CoreEngine);
  }

  static get observedAttributes() {
    return ['title'];
  }

  // Bind custom events for search and cards
  bindEvents() {
    const searchInput = this.shadowRoot.querySelector('#search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        // Reactive state update:
        // Updating the proxy automatically triggers:
        // 1. this.syncStateToRust()
        // 2. this.render()
        this.state.search_query = searchInput.value;
      });
    }

    const cards = this.shadowRoot.querySelectorAll('.grid-card');
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const action = card.id;
        if (action === 'btn-open-options' || action === 'btn-open-benchmarks') {
          chromeAPI.runtime.openOptionsPage();
        } else if (action === 'btn-open-sidepanel') {
          if (chrome.sidePanel && chrome.sidePanel.open) {
            chromeAPI.tabs
              .query({ active: true, currentWindow: true })
              .then(([tab]) => {
                if (tab && tab.id) {
                  chromeAPI.sidePanel.open({ tabId: tab.id }).catch(() => {
                    alert('Please click the extension icon in your toolbar to view the Sidebar Monitor.');
                  });
                }
              });
          } else {
            alert('Click the extension icon in your Chrome toolbar to open the Sidebar Monitor.');
          }
        }
      });
    });
  }
}

customElements.define('wasm-dashboard', WasmDashboard);
