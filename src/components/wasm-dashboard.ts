import browser, { chrome } from '../lib/browser';
import { ExbaElement, defineExba } from '../lib/framework';
import { signal } from '../lib/reactivity';
import init, { CoreEngine } from '../../wasm/pkg/wasm_unified_core';

interface OpenTab {
  id: string;
  title: string;
  iconSvg: string;
  description: string;
}

export class WasmDashboard extends ExbaElement {
  private _selectedIndex = signal(0);
  private _activeView = signal<'home' | string>('home');
  private _openTabs = signal<OpenTab[]>([]);

  constructor() {
    super(init as any, CoreEngine as any);
  }

  static get observedAttributes() {
    return ['title'];
  }

  renderInitial() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: 'Inter', system-ui, -apple-system, sans-serif; }

        /* ── Navbar ── */
        .navbar {
          display: flex; align-items: center; gap: 2px;
          padding: 6px; margin-bottom: 14px;
          background: rgba(15, 23, 42, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px; overflow-x: auto;
        }
        .navbar::-webkit-scrollbar { height: 0; }
        .nav-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 12px; border-radius: 8px;
          font-size: 11.5px; font-weight: 500; color: #94a3b8;
          background: transparent; border: none;
          cursor: pointer; transition: all 0.15s ease;
          white-space: nowrap; flex-shrink: 0; font-family: inherit;
        }
        .nav-btn:hover { color: #f8fafc; background: rgba(255, 255, 255, 0.06); }
        .nav-btn.active { color: #f8fafc; background: rgba(99, 102, 241, 0.15); }
        .nav-btn svg { flex-shrink: 0; }
        .nav-separator { width: 1px; height: 18px; background: rgba(255, 255, 255, 0.08); flex-shrink: 0; margin: 0 2px; }
        .tab-close {
          display: inline-flex; align-items: center; justify-content: center;
          width: 16px; height: 16px; border-radius: 4px;
          background: transparent; border: none; color: #64748b;
          cursor: pointer; transition: all 0.15s; font-size: 14px;
          line-height: 1; padding: 0; margin-left: 2px;
        }
        .tab-close:hover { color: #f87171; background: rgba(239, 68, 68, 0.15); }

        /* ── Search ── */
        .search-wrapper { position: relative; margin-bottom: 14px; }
        .search-input {
          width: 100%; background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px; padding: 12px 14px 12px 40px; color: #f8fafc; font-family: inherit;
          font-size: 13.5px; transition: all 0.25s ease; box-sizing: border-box;
        }
        .search-input:focus { outline: none; border-color: #818cf8; box-shadow: 0 0 0 2px rgba(129, 140, 248, 0.2); background: rgba(15, 23, 42, 0.6); }
        .search-input::placeholder { color: #475569; }
        .search-icon {
          position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
          color: #818cf8; pointer-events: none; display: flex; align-items: center;
        }
        #search-status { font-size: 11px; color: #64748b; margin-bottom: 10px; padding-left: 2px; height: 14px; font-weight: 500; }

        /* ── Category ── */
        .category-label {
          font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
          color: #64748b; padding: 0 2px; margin-bottom: 8px; margin-top: 6px;
        }
        .category-label:first-child { margin-top: 0; }

        /* ── 2-Column Grid ── */
        .grid-menu {
          display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px;
        }
        .home-scroll {
          max-height: calc(100vh - 160px); overflow-y: auto; padding-right: 2px;
        }
        .home-scroll::-webkit-scrollbar { width: 3px; }
        .home-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 2px; }

        .grid-card {
          background: rgba(30, 41, 59, 0.25); border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 12px; padding: 16px 14px; cursor: pointer; transition: all 0.15s ease;
          display: flex; flex-direction: column; align-items: center; gap: 10px;
          text-align: center; outline: none; min-height: 100px; justify-content: center;
        }
        .grid-card:hover {
          border-color: rgba(129, 140, 248, 0.3); background: rgba(99, 102, 241, 0.06);
          transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .card-icon-container {
          display: flex; align-items: center; justify-content: center;
          width: 42px; height: 42px; border-radius: 12px;
          background: rgba(99, 102, 241, 0.1); color: #a5b4fc;
        }
        .grid-card[data-cat="Browser API"] .card-icon-container {
          background: rgba(16, 185, 129, 0.1); color: #34d399;
        }
        .card-title { font-size: 13px; font-weight: 600; color: #f8fafc; }
        .card-desc { font-size: 10.5px; color: #64748b; line-height: 1.35; margin: 0; }

        /* ── Detail Panel ── */
        .detail-panel { animation: fadeSlide 0.2s ease-out; }
        .detail-header {
          display: flex; align-items: center; gap: 12px; margin-bottom: 16px;
          padding-bottom: 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .detail-icon {
          display: flex; align-items: center; justify-content: center;
          width: 40px; height: 40px; border-radius: 10px;
          background: rgba(99, 102, 241, 0.12); color: #a5b4fc;
        }
        .detail-title { font-size: 16px; font-weight: 700; color: #f8fafc; }
        .detail-subtitle { font-size: 11.5px; color: #64748b; margin-top: 2px; }

        /* ── Shared detail styles ── */
        .demo-section {
          background: rgba(15, 23, 42, 0.3); border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px; padding: 16px; margin-bottom: 10px;
        }
        .demo-section:last-child { margin-bottom: 0; }
        .demo-label { font-size: 10.5px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
        .demo-btn {
          background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%); color: white; border: none; border-radius: 6px;
          padding: 8px 14px; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.15s; font-family: inherit;
        }
        .demo-btn:hover { opacity: 0.9; }
        .demo-btn.danger { background: linear-gradient(135deg, #ef4444 0%, #f87171 100%); }
        .demo-btn.success { background: linear-gradient(135deg, #10b981 0%, #34d399 100%); }
        .demo-btn.small { padding: 5px 10px; font-size: 10px; }
        .demo-input {
          width: 100%; background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px; padding: 8px 10px; color: #f8fafc; font-size: 12px; box-sizing: border-box; font-family: inherit;
        }
        .demo-input:focus { outline: none; border-color: #818cf8; }
        .demo-result {
          font-family: 'SF Mono', 'Fira Code', monospace; font-size: 11px; color: #34d399; word-break: break-all;
          background: rgba(16, 185, 129, 0.06); padding: 8px 10px; border-radius: 6px;
          border: 1px solid rgba(16, 185, 129, 0.1); max-height: 200px; overflow-y: auto;
        }
        .demo-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .demo-list { display: flex; flex-direction: column; gap: 4px; }
        .demo-list-item {
          display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 6px;
          background: rgba(30, 41, 59, 0.3); border: 1px solid rgba(255, 255, 255, 0.04);
          font-size: 11.5px; color: #e2e8f0;
        }
        .demo-list-item .title { flex-grow: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .demo-list-item .meta { font-size: 10px; color: #64748b; flex-shrink: 0; }
        .demo-empty { text-align: center; padding: 20px; color: #64748b; font-size: 12px; }

        /* ── Accordion Demo ── */
        .accordion { display: flex; flex-direction: column; gap: 6px; }
        .accordion-item { border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; overflow: hidden; background: rgba(15,23,42,0.25); }
        .accordion-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 14px; cursor: pointer; transition: background 0.15s;
          font-size: 13px; font-weight: 600; color: #f8fafc;
          background: transparent; border: none; width: 100%; text-align: left; font-family: inherit;
        }
        .accordion-header:hover { background: rgba(255,255,255,0.03); }
        .accordion-header.open { color: #818cf8; }
        .accordion-chevron { transition: transform 0.25s ease; color: #64748b; flex-shrink: 0; }
        .accordion-header.open .accordion-chevron { transform: rotate(180deg); color: #818cf8; }
        .accordion-body { max-height: 0; overflow: hidden; transition: max-height 0.3s ease, padding 0.3s ease; padding: 0 14px; }
        .accordion-body.open { max-height: 200px; padding: 0 14px 14px; }
        .accordion-body p { font-size: 12px; color: #94a3b8; line-height: 1.6; margin: 0; }
        .accordion-tag {
          display: inline-block; font-size: 9px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.05em; padding: 2px 6px; border-radius: 4px; margin-right: 6px;
          background: rgba(99,102,241,0.12); color: #a5b4fc;
        }

        /* ── Treeview Demo ── */
        .treeview { display: flex; flex-direction: column; gap: 1px; user-select: none; }
        .tree-node { display: flex; flex-direction: column; }
        .tree-row {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 10px; border-radius: 6px; cursor: pointer;
          transition: background 0.12s; font-size: 12.5px; color: #e2e8f0;
        }
        .tree-row:hover { background: rgba(255,255,255,0.04); }
        .tree-row.selected { background: rgba(99,102,241,0.12); color: #818cf8; }
        .tree-toggle { display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex-shrink: 0; transition: transform 0.2s ease; color: #64748b; }
        .tree-toggle.open { transform: rotate(90deg); }
        .tree-toggle.leaf { visibility: hidden; }
        .tree-icon { display: flex; align-items: center; color: #64748b; flex-shrink: 0; }
        .tree-icon.folder { color: #fbbf24; }
        .tree-label { flex-grow: 1; }
        .tree-children { max-height: 0; overflow: hidden; transition: max-height 0.25s ease; padding-left: 22px; }
        .tree-children.open { max-height: 500px; }
        .tree-meta { font-size: 10px; color: #475569; flex-shrink: 0; }

        @keyframes fadeSlide { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      </style>

      <div>
        <div class="navbar" id="navbar">
          <button class="nav-btn active" id="nav-home">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            Home
          </button>
        </div>
        <div id="home-view">
          <div class="search-wrapper">
            <div class="search-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>
            <input type="text" id="search-input" class="search-input" placeholder="Search components..." autofocus>
          </div>
          <div id="search-status"></div>
          <div class="home-scroll" id="categorized-grid"></div>
        </div>
        <div id="detail-view" style="display: none;"></div>
      </div>
    `;
  }

  setupEffects() {
    const searchStatus = this.computed(() => {
      const count = this.state.value.filtered_items?.length || 0;
      const query = this.state.value.search_query;
      if (!query) return `${count} demo${count === 1 ? '' : 's'} available`;
      return `${count} result${count === 1 ? '' : 's'} for "${query}"`;
    });
    this.bindText('#search-status', () => searchStatus.value);

    // Render categorized grid
    this.effect(() => {
      const items = this.state.value.filtered_items || [];
      const container = this.shadowRoot?.querySelector('#categorized-grid');
      if (!container) return;

      // Group by tag
      const groups: Record<string, any[]> = {};
      for (const item of items) {
        const cat = item.tag || 'Other';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(item);
      }

      let html = '';
      let globalIndex = 0;
      for (const [category, catItems] of Object.entries(groups)) {
        html += `<div class="category-label">${category}</div>`;
        html += '<div class="grid-menu">';
        for (const item of catItems) {
          html += `
            <div class="grid-card" data-index="${globalIndex}" data-cat="${category}">
              <div class="card-icon-container">${item.icon_svg}</div>
              <span class="card-title">${item.title}</span>
              <p class="card-desc">${item.description}</p>
            </div>`;
          globalIndex++;
        }
        html += '</div>';
      }
      container.innerHTML = html;
    });

    this.effect(() => {
      const view = this._activeView.value;
      const homeView = this.shadowRoot?.querySelector('#home-view') as HTMLElement;
      const detailView = this.shadowRoot?.querySelector('#detail-view') as HTMLElement;
      if (!homeView || !detailView) return;
      homeView.style.display = view === 'home' ? 'block' : 'none';
      detailView.style.display = view === 'home' ? 'none' : 'block';
    });

    this.effect(() => {
      const tabs = this._openTabs.value;
      const activeView = this._activeView.value;
      this.renderNavbar(tabs, activeView);
    });
  }

  bindEvents() {
    const searchInput = this.shadowRoot?.querySelector('#search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        if (this.engine) { this.engine.set_search_query(searchInput.value); this.syncStateFromRust(); }
      });
      searchInput.addEventListener('keydown', (e: KeyboardEvent) => {
        const items = this.state.value.filtered_items || [];
        const max = items.length;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); this._selectedIndex.value = Math.min(this._selectedIndex.value + 1, max - 1); }
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); this._selectedIndex.value = Math.max(this._selectedIndex.value - 1, 0); }
        else if (e.key === 'Enter' && max > 0) { const item = items[this._selectedIndex.value]; if (item) this.openTabFromItem(item); }
      });
    }

    // Grid delegation
    const grid = this.shadowRoot?.querySelector('#categorized-grid');
    if (grid) {
      grid.addEventListener('click', (e: Event) => {
        const card = (e.target as HTMLElement).closest('.grid-card') as HTMLElement | null;
        if (!card) return;
        const index = Number.parseInt(card.getAttribute('data-index') || '0');
        const items = this.state.value.filtered_items || [];
        if (items[index]) this.openTabFromItem(items[index]);
      });
    }

    // Navbar delegation
    const navbar = this.shadowRoot?.querySelector('#navbar');
    if (navbar) {
      navbar.addEventListener('click', (e: Event) => {
        const target = e.target as HTMLElement;
        const closeBtn = target.closest('.tab-close') as HTMLElement | null;
        if (closeBtn) { e.stopPropagation(); const id = closeBtn.getAttribute('data-close-id'); if (id) this.closeTab(id); return; }
        if (target.closest('#nav-home')) { this._activeView.value = 'home'; return; }
        const tabBtn = target.closest('[data-tab-id]') as HTMLElement | null;
        if (tabBtn) { const id = tabBtn.getAttribute('data-tab-id'); if (id) { this._activeView.value = id; this.renderDetailForTab(id); } }
      });
    }
  }

  private renderNavbar(tabs: OpenTab[], activeView: string) {
    const navbar = this.shadowRoot?.querySelector('#navbar');
    if (!navbar) return;
    const homeBtn = `<button class="nav-btn ${activeView === 'home' ? 'active' : ''}" id="nav-home"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>Home</button>`;
    const tabBtns = tabs.map(tab => `<div class="nav-separator"></div><button class="nav-btn ${activeView === tab.id ? 'active' : ''}" data-tab-id="${tab.id}">${tab.iconSvg} ${tab.title}<span class="tab-close" data-close-id="${tab.id}">&times;</span></button>`).join('');
    navbar.innerHTML = homeBtn + tabBtns;
  }

  private openTabFromItem(item: any) {
    const id = item.action_id;
    if (!this._openTabs.value.find(t => t.id === id)) {
      this._openTabs.value = [...this._openTabs.value, { id, title: item.title, iconSvg: item.icon_svg, description: item.description }];
    }
    this._activeView.value = id;
    this.renderDetailForTab(id);
  }

  private renderDetailForTab(tabId: string) {
    const dv = this.shadowRoot?.querySelector('#detail-view') as HTMLElement;
    if (!dv) return;
    const tab = this._openTabs.value.find(t => t.id === tabId);
    if (!tab) return;

    const header = `<div class="detail-header"><div class="detail-icon">${tab.iconSvg}</div><div><div class="detail-title">${tab.title}</div><div class="detail-subtitle">${tab.description}</div></div></div>`;

    if (tabId === 'demo-accordion') { this.renderAccordionDemo(dv, header); }
    else if (tabId === 'demo-treeview') { this.renderTreeviewDemo(dv, header); }
    else if (tabId === 'demo-tabs') { this.renderTabManagerDemo(dv, header); }
    else if (tabId === 'demo-storage') { this.renderStorageDemo(dv, header); }
    else if (tabId === 'demo-notifications') { this.renderNotificationsDemo(dv, header); }
    else if (tabId === 'demo-alarms') { this.renderAlarmsDemo(dv, header); }
    else { dv.innerHTML = `<div class="detail-panel">${header}<div class="demo-section"><p style="color:#94a3b8;font-size:12.5px">${tab.description}</p></div></div>`; }
  }

  /* ══ ACCORDION ══ */
  private renderAccordionDemo(c: HTMLElement, header: string) {
    const sections = [
      { title: 'What is WebAssembly?', tag: 'Basics', content: 'WebAssembly (Wasm) is a binary instruction format for a stack-based virtual machine. It enables high-performance applications on the web, allowing code written in Rust, C++, and Go to run at near-native speed.' },
      { title: 'How does Rust compile to Wasm?', tag: 'Tooling', content: 'Rust compiles to Wasm via the <code>wasm32-unknown-unknown</code> target. Tools like <code>wasm-pack</code> and <code>wasm-bindgen</code> bridge Rust and JavaScript, generating typed bindings automatically.' },
      { title: 'Browser Extension Architecture', tag: 'Design', content: 'Modern extensions use Manifest V3 with service workers for background logic, content scripts for page injection, and side panels for persistent UI. This project combines all three with a Rust-Wasm core engine.' },
      { title: 'Signal-based Reactivity', tag: 'Reactive', content: 'This UI uses a custom fine-grained reactivity system inspired by SolidJS. Signals track dependencies automatically, and effects re-run only when their tracked values change — no virtual DOM diffing.' },
    ];
    const chev = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
    c.innerHTML = `<div class="detail-panel">${header}<div class="accordion" id="accordion-root">${sections.map((s, i) => `
      <div class="accordion-item"><button class="accordion-header" data-acc="${i}"><span><span class="accordion-tag">${s.tag}</span>${s.title}</span><span class="accordion-chevron">${chev}</span></button><div class="accordion-body" data-acc-body="${i}"><p>${s.content}</p></div></div>`).join('')}</div></div>`;
    this.shadowRoot?.querySelector('#accordion-root')?.addEventListener('click', (e: Event) => {
      const h = (e.target as HTMLElement).closest('.accordion-header') as HTMLElement | null;
      if (!h) return;
      const idx = h.getAttribute('data-acc');
      const body = this.shadowRoot?.querySelector(`[data-acc-body="${idx}"]`) as HTMLElement;
      if (!body) return;
      const open = h.classList.contains('open');
      this.shadowRoot?.querySelectorAll('.accordion-header').forEach(x => x.classList.remove('open'));
      this.shadowRoot?.querySelectorAll('.accordion-body').forEach(x => x.classList.remove('open'));
      if (!open) { h.classList.add('open'); body.classList.add('open'); }
    });
  }

  /* ══ TREEVIEW ══ */
  private renderTreeviewDemo(c: HTMLElement, header: string) {
    const fi = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>';
    const fli = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>';
    const ch = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
    interface TI { name: string; type: 'folder'|'file'; meta?: string; children?: TI[]; }
    const tree: TI[] = [
      { name: 'src', type: 'folder', children: [
        { name: 'components', type: 'folder', children: [{ name: 'wasm-dashboard.ts', type: 'file', meta: '12 KB' }, { name: 'wasm-benchmark.ts', type: 'file', meta: '4.5 KB' }] },
        { name: 'lib', type: 'folder', children: [{ name: 'framework.ts', type: 'file', meta: '8.9 KB' }, { name: 'reactivity.ts', type: 'file', meta: '3.7 KB' }, { name: 'browser.ts', type: 'file', meta: '1.2 KB' }] },
        { name: 'sidepanel.ts', type: 'file', meta: '0.8 KB' }, { name: 'background.ts', type: 'file', meta: '3.6 KB' },
      ]},
      { name: 'wasm', type: 'folder', children: [{ name: 'src', type: 'folder', children: [{ name: 'lib.rs', type: 'file', meta: '9.8 KB' }] }, { name: 'Cargo.toml', type: 'file', meta: '0.5 KB' }] },
      { name: 'public', type: 'folder', children: [{ name: 'sidepanel.html', type: 'file', meta: '0.7 KB' }, { name: 'styles.css', type: 'file', meta: '3.8 KB' }] },
      { name: 'package.json', type: 'file', meta: '1.1 KB' }, { name: 'rsbuild.config.ts', type: 'file', meta: '2.8 KB' },
    ];
    const rn = (item: TI): string => {
      const isF = item.type === 'folder';
      return `<div class="tree-node"><div class="tree-row" data-tree-type="${item.type}">${isF ? `<span class="tree-toggle">${ch}</span>` : '<span class="tree-toggle leaf"></span>'}<span class="tree-icon ${isF ? 'folder' : 'file'}">${isF ? fi : fli}</span><span class="tree-label">${item.name}</span>${item.meta ? `<span class="tree-meta">${item.meta}</span>` : ''}</div>${isF && item.children ? `<div class="tree-children">${item.children.map(c => rn(c)).join('')}</div>` : ''}</div>`;
    };
    c.innerHTML = `<div class="detail-panel">${header}<div class="treeview" id="treeview-root">${tree.map(i => rn(i)).join('')}</div></div>`;
    this.shadowRoot?.querySelector('#treeview-root')?.addEventListener('click', (e: Event) => {
      const row = (e.target as HTMLElement).closest('.tree-row') as HTMLElement | null;
      if (!row) return;
      this.shadowRoot?.querySelectorAll('.tree-row.selected').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
      if (row.getAttribute('data-tree-type') === 'folder') {
        const ch = row.closest('.tree-node')?.querySelector(':scope > .tree-children') as HTMLElement | null;
        const tg = row.querySelector('.tree-toggle');
        if (ch && tg) { ch.classList.toggle('open'); tg.classList.toggle('open'); }
      }
    });
  }

  /* ══ TAB MANAGER ══ */
  private renderTabManagerDemo(c: HTMLElement, header: string) {
    c.innerHTML = `<div class="detail-panel">${header}
      <div class="demo-section"><div class="demo-label">Open Tabs</div><div class="demo-row" style="margin-bottom:8px"><button class="demo-btn small" id="tabs-refresh">↻ Refresh</button><button class="demo-btn small success" id="tabs-new">+ New Tab</button></div><div class="demo-list" id="tabs-list"><div class="demo-empty">Click Refresh to load tabs</div></div></div></div>`;
    const loadTabs = async () => {
      const list = this.shadowRoot?.querySelector('#tabs-list');
      if (!list) return;
      try {
        const tabs = await browser.tabs.query({});
        if (!tabs.length) { list.innerHTML = '<div class="demo-empty">No tabs found</div>'; return; }
        list.innerHTML = tabs.map((t: any) => `<div class="demo-list-item"><span class="title" title="${t.url || ''}">${t.title || 'Untitled'}</span><span class="meta">#${t.id}</span><button class="demo-btn small danger" data-close-tab="${t.id}" style="padding:3px 8px">✕</button></div>`).join('');
      } catch { list.innerHTML = '<div class="demo-empty">tabs API not available</div>'; }
    };
    this.shadowRoot?.querySelector('#tabs-refresh')?.addEventListener('click', loadTabs);
    this.shadowRoot?.querySelector('#tabs-new')?.addEventListener('click', async () => { try { await browser.tabs.create({ url: 'https://example.com' }); setTimeout(loadTabs, 300); } catch {} });
    this.shadowRoot?.querySelector('#tabs-list')?.addEventListener('click', async (e: Event) => {
      const btn = (e.target as HTMLElement).closest('[data-close-tab]') as HTMLElement | null;
      if (!btn) return;
      const id = Number.parseInt(btn.getAttribute('data-close-tab') || '0');
      try { await browser.tabs.remove(id); setTimeout(loadTabs, 200); } catch {}
    });
    loadTabs();
  }

  /* ══ STORAGE EXPLORER ══ */
  private renderStorageDemo(c: HTMLElement, header: string) {
    c.innerHTML = `<div class="detail-panel">${header}
      <div class="demo-section"><div class="demo-label">Set Key-Value</div><div class="demo-row" style="margin-bottom:8px;gap:6px"><input id="stor-key" class="demo-input" placeholder="Key" style="flex:1"><input id="stor-val" class="demo-input" placeholder="Value" style="flex:1"><button class="demo-btn small" id="stor-save">Save</button></div></div>
      <div class="demo-section"><div class="demo-label">Stored Data</div><div class="demo-row" style="margin-bottom:8px"><button class="demo-btn small" id="stor-load">↻ Load All</button><button class="demo-btn small danger" id="stor-clear">Clear All</button></div><div class="demo-result" id="stor-result">Click Load to inspect storage</div></div></div>`;
    const load = async () => {
      const res = this.shadowRoot?.querySelector('#stor-result');
      if (!res) return;
      try { const data = await browser.storage.local.get(null); res.textContent = JSON.stringify(data, null, 2) || '{}'; } catch { res.textContent = 'storage API not available'; }
    };
    this.shadowRoot?.querySelector('#stor-save')?.addEventListener('click', async () => {
      const key = (this.shadowRoot?.querySelector('#stor-key') as HTMLInputElement)?.value?.trim();
      const val = (this.shadowRoot?.querySelector('#stor-val') as HTMLInputElement)?.value;
      if (key) { try { await browser.storage.local.set({ [key]: val }); load(); } catch {} }
    });
    this.shadowRoot?.querySelector('#stor-load')?.addEventListener('click', load);
    this.shadowRoot?.querySelector('#stor-clear')?.addEventListener('click', async () => { try { await browser.storage.local.clear(); load(); } catch {} });
    load();
  }

  /* ══ NOTIFICATIONS ══ */
  private renderNotificationsDemo(c: HTMLElement, header: string) {
    c.innerHTML = `<div class="detail-panel">${header}
      <div class="demo-section"><div class="demo-label">Send Notification</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <input id="notif-title" class="demo-input" placeholder="Title" value="Hello from EXBA">
          <input id="notif-msg" class="demo-input" placeholder="Message body" value="This notification was fired from the sidebar!">
          <button class="demo-btn" id="notif-send">🔔 Send Notification</button>
        </div>
        <div id="notif-status" style="font-size:11px;color:#64748b;margin-top:8px"></div>
      </div></div>`;
    this.shadowRoot?.querySelector('#notif-send')?.addEventListener('click', () => {
      const title = (this.shadowRoot?.querySelector('#notif-title') as HTMLInputElement)?.value || 'EXBA';
      const msg = (this.shadowRoot?.querySelector('#notif-msg') as HTMLInputElement)?.value || '';
      const status = this.shadowRoot?.querySelector('#notif-status');
      try {
        const chromeObj = (globalThis as any).chrome;
        if (chromeObj?.notifications?.create) {
          chromeObj.notifications.create(`exba-${Date.now()}`, { type: 'basic', iconUrl: chromeObj.runtime.getURL('icon-128.png'), title, message: msg }, () => {
            if (status) status.textContent = `✓ Sent at ${new Date().toLocaleTimeString()}`;
          });
        } else { if (status) status.textContent = '✗ notifications API not available'; }
      } catch { if (status) status.textContent = '✗ Error sending notification'; }
    });
  }

  /* ══ ALARMS ══ */
  private renderAlarmsDemo(c: HTMLElement, header: string) {
    c.innerHTML = `<div class="detail-panel">${header}
      <div class="demo-section"><div class="demo-label">Create Alarm</div>
        <div class="demo-row" style="margin-bottom:8px;gap:6px"><input id="alarm-name" class="demo-input" placeholder="Alarm name" value="my-alarm" style="flex:1"><input id="alarm-mins" class="demo-input" type="number" placeholder="Minutes" value="1" style="width:70px"><button class="demo-btn small" id="alarm-create">Create</button></div>
      </div>
      <div class="demo-section"><div class="demo-label">Active Alarms</div><div class="demo-row" style="margin-bottom:8px"><button class="demo-btn small" id="alarm-refresh">↻ Refresh</button><button class="demo-btn small danger" id="alarm-clear">Clear All</button></div><div class="demo-list" id="alarm-list"><div class="demo-empty">Click Refresh to load alarms</div></div></div></div>`;
    const load = async () => {
      const list = this.shadowRoot?.querySelector('#alarm-list');
      if (!list) return;
      try {
        const alarms = await browser.alarms.getAll();
        if (!alarms.length) { list.innerHTML = '<div class="demo-empty">No active alarms</div>'; return; }
        list.innerHTML = alarms.map((a: any) => {
          const next = a.scheduledTime ? new Date(a.scheduledTime).toLocaleTimeString() : '—';
          const period = a.periodInMinutes ? `every ${a.periodInMinutes}m` : 'one-shot';
          return `<div class="demo-list-item"><span class="title">${a.name}</span><span class="meta">${period} · next ${next}</span></div>`;
        }).join('');
      } catch { list.innerHTML = '<div class="demo-empty">alarms API not available</div>'; }
    };
    this.shadowRoot?.querySelector('#alarm-create')?.addEventListener('click', async () => {
      const name = (this.shadowRoot?.querySelector('#alarm-name') as HTMLInputElement)?.value?.trim() || 'alarm';
      const mins = Number.parseFloat((this.shadowRoot?.querySelector('#alarm-mins') as HTMLInputElement)?.value || '1');
      try { await browser.alarms.create(name, { delayInMinutes: mins, periodInMinutes: mins }); setTimeout(load, 200); } catch {}
    });
    this.shadowRoot?.querySelector('#alarm-refresh')?.addEventListener('click', load);
    this.shadowRoot?.querySelector('#alarm-clear')?.addEventListener('click', async () => { try { await browser.alarms.clearAll(); setTimeout(load, 200); } catch {} });
    load();
  }

  private closeTab(tabId: string) {
    const tabs = this._openTabs.value.filter(t => t.id !== tabId);
    this._openTabs.value = tabs;
    if (this._activeView.value === tabId) {
      if (tabs.length > 0) { const last = tabs[tabs.length - 1]; this._activeView.value = last.id; this.renderDetailForTab(last.id); }
      else { this._activeView.value = 'home'; }
    }
  }
}

defineExba('wasm-dashboard', WasmDashboard);
