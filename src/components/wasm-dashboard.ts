import { ExbaElement, defineExba } from '../lib/framework';
import init, { CoreEngine } from '../../wasm/pkg/wasm_unified_core';
import { chromeAPI } from '../lib/chrome';

export class WasmDashboard extends ExbaElement {
  private _selectedIndex = this.computed(() => 0);
  private _showSecurityTools = false;

  constructor() {
    super(init as any, CoreEngine as any);
  }

  static get observedAttributes() {
    return ['title'];
  }

  // 1. Static UI Structure
  renderInitial() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `
      <style>
        .search-wrapper { position: relative; margin-bottom: 8px; }
        .search-input {
          width: 100%; background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px; padding: 10px 14px 10px 36px; color: #f8fafc; font-family: inherit;
          font-size: 13px; transition: all 0.25s ease; box-sizing: border-box;
        }
        .search-input:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2); }
        .search-icon {
          position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
          color: #64748b; pointer-events: none; display: flex; align-items: center;
        }

        .category-tabs {
            display: flex; gap: 8px; margin-bottom: 12px; overflow-x: auto; padding-bottom: 4px;
        }
        .category-tabs::-webkit-scrollbar { height: 2px; }
        .tab {
            font-size: 11px; font-weight: 600; color: #94a3b8; padding: 4px 10px;
            background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 20px; cursor: pointer; transition: all 0.2s; white-space: nowrap;
        }
        .tab.active {
            background: #6366f1; color: white; border-color: #6366f1;
        }

        #search-status {
          font-size: 10px; color: #64748b; margin-bottom: 8px; padding-left: 4px; height: 12px;
        }
        .grid-menu {
          display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
          max-height: 260px; overflow-y: auto; padding-right: 4px;
        }
        .grid-menu::-webkit-scrollbar { width: 4px; }
        .grid-menu::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 2px; }
        
        .grid-card {
          background: rgba(30, 41, 59, 0.35); border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 10px; padding: 12px; cursor: pointer; transition: all 0.2s ease;
          display: flex; flex-direction: column; justify-content: space-between; min-height: 90px;
          outline: none;
        }
        .grid-card:hover, .grid-card.focused {
          transform: translateY(-2px); border-color: #6366f1; background: rgba(99, 102, 241, 0.08);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
        }
        .grid-card.focused {
            box-shadow: 0 0 0 2px #6366f1 inset;
        }
        .card-top { display: flex; flex-direction: column; gap: 4px; }
        .card-title { font-size: 12px; font-weight: 700; color: #f8fafc; }
        .card-desc { font-size: 10.5px; color: #94a3b8; line-height: 1.3; margin: 0; }
        .card-badge {
          align-self: flex-start; font-size: 8px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.05em; background: rgba(99, 102, 241, 0.15); color: #a5b4fc;
          padding: 2px 6px; border-radius: 4px; margin-top: 8px;
        }
        .card-badge.tag-basic { background: rgba(16, 185, 129, 0.15); color: #34d399; }
        .card-badge.tag-advanced { background: rgba(239, 68, 68, 0.15); color: #f87171; }
        .card-badge.tag-network { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
        .card-badge.tag-wasm { background: rgba(168, 85, 247, 0.15); color: #d8b4fe; }
        .card-badge.tag-security { background: rgba(6, 182, 212, 0.15); color: #22d3ee; }
        
        .security-panel {
          margin-top: 12px; background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px; padding: 12px; font-family: inherit; margin-bottom: 14px;
        }
        .security-row { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
        .security-row:last-child { margin-bottom: 0; }
        .security-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
        .security-input {
          width: 100%; background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px; padding: 8px; color: #f8fafc; font-size: 12px; box-sizing: border-box;
        }
        .security-button {
          background: #6366f1; color: white; border: none; border-radius: 6px;
          padding: 8px 12px; font-size: 11px; font-weight: 600; cursor: pointer; transition: opacity 0.2s;
        }
        .security-button:hover { opacity: 0.9; }
        .security-result {
          font-family: monospace; font-size: 11px; color: #10b981; word-break: break-all;
          background: rgba(16, 185, 129, 0.05); padding: 6px; border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.1);
        }
        .no-results {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 40px 20px; text-align: center; color: #64748b; font-size: 12px; grid-column: span 2;
        }
      </style>
      <div>
        <div class="search-wrapper">
          <div class="search-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </div>
          <input type="text" id="search-input" class="search-input" placeholder="Search tools (e.g. Wasm, Block)..." autofocus>
        </div>

        <div class="category-tabs" id="category-tabs">
            <div class="tab" data-cat="All">All</div>
            <div class="tab" data-cat="Wasm">Wasm</div>
            <div class="tab" data-cat="Security">Security</div>
            <div class="tab" data-cat="Network">Network</div>
            <div class="tab" data-cat="Advanced">Advanced</div>
            <div class="tab" data-cat="Basic">Basic</div>
        </div>

        <div id="search-status">Loading tools...</div>

        <div id="security-tools" class="security-panel" style="display: none;">
          <div class="security-row">
            <div class="security-label">Password Generator</div>
            <div style="display: flex; gap: 8px;">
              <input type="number" id="pass-len" class="security-input" style="width: 60px;" value="16">
              <button id="btn-gen-pass" class="security-button">Generate</button>
            </div>
            <div id="pass-result" class="security-result">Click generate...</div>
          </div>
          <div class="security-row">
            <div class="security-label">SHA-256 Hasher</div>
            <input type="text" id="hash-input" class="security-input" placeholder="Text to hash...">
            <div id="hash-result" class="security-result">Result will appear here...</div>
          </div>
        </div>

        <div class="grid-menu" id="grid-menu">
          <!-- Dynamically populated -->
        </div>
      </div>
    `;
  }

  // 2. Reactive Bindings
  setupEffects() {
    const searchStatus = this.computed(() => {
      const count = this.state.value.filtered_items?.length || 0;
      const query = this.state.value.search_query;
      const cat = this.state.value.selected_category;
      let msg = `Showing ${count} tool${count === 1 ? '' : 's'}`;
      if (cat !== 'All') msg += ` in ${cat}`;
      if (query) msg += ` matching "${query}"`;
      return msg;
    });

    this.bindText('#pass-result', (s) => s.password_result || 'Click generate...');
    this.bindText('#hash-result', (s) => s.hash_result || 'Result will appear here...');
    this.bindText('#search-status', () => searchStatus.value);

    // Active category highlight
    this.effect(() => {
        const cat = this.state.value.selected_category;
        this.shadowRoot?.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', tab.getAttribute('data-cat') === cat);
        });
    });

    this.bindList('#grid-menu', 
      (s) => s.filtered_items, 
      (item: any, index: number) => `
        <div class="grid-card ${index === this._selectedIndex.value ? 'focused' : ''}" id="${item.action_id}" data-index="${index}">
          <div class="card-top">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="color: #a5b4fc; display: flex; align-items: center;">${item.icon_svg}</span>
              <span class="card-title">${item.title}</span>
            </div>
            <p class="card-desc">${item.description}</p>
          </div>
          <span class="card-badge ${item.tag_class}">${item.tag}</span>
        </div>
      `
    );

    // Watch for list changes to re-bind card events and reset selection
    this.watch(() => this.state.value.filtered_items, () => {
        (this._selectedIndex as any)._value = 0; // Reset focus to first item
        this.bindCardEvents();
    });

    // Manual effect to update focus class without full list re-render if possible
    // (Though bindList currently re-renders everything, which is fine for small lists)
  }

  // 3. User Interactions
  bindEvents() {
    const searchInput = this.shadowRoot?.querySelector('#search-input') as HTMLInputElement;

    this.on('#search-input', 'input', (e) => {
        if (this.engine) this.engine.set_search_query((e.target as HTMLInputElement).value);
        this.syncStateFromRust();
    });

    // Keyboard Navigation
    this.on('#search-input', 'keydown', (e: any) => {
        const key = e.key;
        const items = this.state.value.filtered_items || [];
        const max = items.length;

        if (key === 'ArrowDown') {
            e.preventDefault();
            this._selectedIndex.value = Math.min(this._selectedIndex.value + 2, max - 1);
        } else if (key === 'ArrowUp') {
            e.preventDefault();
            this._selectedIndex.value = Math.max(this._selectedIndex.value - 2, 0);
        } else if (key === 'ArrowRight') {
            this._selectedIndex.value = Math.min(this._selectedIndex.value + 1, max - 1);
        } else if (key === 'ArrowLeft') {
            this._selectedIndex.value = Math.max(this._selectedIndex.value - 1, 0);
        } else if (key === 'Enter') {
            const selectedItem = items[this._selectedIndex.value];
            if (selectedItem) {
                this.triggerAction(selectedItem.action_id);
            }
        }
    });

    // Category Tabs
    this.shadowRoot?.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const cat = tab.getAttribute('data-cat');
            if (this.engine && cat) {
                this.engine.set_category(cat);
                this.syncStateFromRust();
                searchInput?.focus();
            }
        });
    });

    this.on('#btn-gen-pass', 'click', () => {
        const passLen = (this.shadowRoot?.querySelector('#pass-len') as HTMLInputElement)?.value;
        if (this.engine) this.engine.generate_password(Number.parseInt(passLen || '16'));
        this.syncStateFromRust();
    });

    this.on('#hash-input', 'input', (e) => {
        if (this.engine) this.engine.calculate_hash((e.target as HTMLInputElement).value);
        this.syncStateFromRust();
    });
  }

  bindCardEvents() {
    const cards = this.shadowRoot?.querySelectorAll('.grid-card');
    cards?.forEach((card) => {
      card.addEventListener('click', () => {
        this.triggerAction(card.id);
      });
      card.addEventListener('mouseenter', () => {
          const idx = Number.parseInt(card.getAttribute('data-index') || '0');
          this._selectedIndex.value = idx;
      });
    });
  }

  private triggerAction(action: string) {
    if (action === 'btn-open-options' || action === 'btn-open-benchmarks') {
      chromeAPI.runtime.openOptionsPage();
    } else if (action === 'btn-open-security') {
      this._showSecurityTools = !this._showSecurityTools;
      const securityTools = this.shadowRoot?.querySelector('#security-tools') as HTMLElement;
      if (securityTools) securityTools.style.display = this._showSecurityTools ? 'block' : 'none';
      
      // Auto-focus password length if opened
      if (this._showSecurityTools) {
          setTimeout(() => (this.shadowRoot?.querySelector('#pass-len') as HTMLElement)?.focus(), 50);
      }
    } else if (action === 'btn-open-sidepanel') {
      this.openSidePanel();
    }
  }

  private async openSidePanel() {
    if ((chrome.sidePanel as any)?.open) {
      const tabs = await chromeAPI.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (tab && tab.id) {
        chromeAPI.sidePanel.open({ tabId: tab.id }).catch(() => {
          alert('Please click the extension icon in your toolbar to view the Sidebar Monitor.');
        });
      }
    } else {
      alert('Click the extension icon in your Chrome toolbar to open the Sidebar Monitor.');
    }
  }
}

defineExba('wasm-dashboard', WasmDashboard);
