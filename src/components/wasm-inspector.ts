/**
 * <wasm-inspector> — Developer inspection panel for WASM modules.
 *
 * Auto-displays:
 * - All registered modules with their state keys and action schema
 * - Live state values (polling)
 * - Recent events from the event bus
 * - Schema validation results
 *
 * Usage (dev only):
 * ```html
 * <wasm-inspector></wasm-inspector>
 * ```
 */

import init, { CoreEngine } from '../../wasm/pkg/wasm_unified_core';
import { defineExba, ExbaElement } from '../lib/framework';
import { WasmClient } from '../lib/wasm-client';
import { WasmEventBus } from '../lib/wasm-event-bus';
import type { WasmModuleEvent, WasmModuleManifest } from '../wasm-types';

interface InspectorState {
  manifests: WasmModuleManifest[];
  liveState: Record<string, unknown>;
  recentEvents: WasmModuleEvent[];
  validationResults: string;
  selectedTab: 'modules' | 'state' | 'events' | 'validation';
}

export class WasmInspector extends ExbaElement<InspectorState> {
  private eventDispose: (() => void) | null = null;

  constructor() {
    super(init as any, CoreEngine as any, ['Inspector']);
  }

  onMounted(): void {
    // Subscribe to WASM events for the events tab
    if (this.wasm) {
      this.eventDispose = this.wasm.events.subscribe((event) => {
        const events = this.state.value.recentEvents || [];
        events.unshift(event);
        if (events.length > 50) events.pop();
        this.state.value = { ...this.state.value, recentEvents: events };
      });
    }

    // Refresh live state periodically
    this._disposables.add(
      setInterval(() => {
        if (this.wasm) {
          this.wasm.pullState();
          this.state.value = {
            ...this.state.value,
            liveState: { ...this.wasm.state.value },
          };
        }
      }, 1000) as any,
    );

    this.refresh();
  }

  onUnmounted(): void {
    if (this.eventDispose) {
      this.eventDispose();
      this.eventDispose = null;
    }
  }

  renderInitial(): void {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace;
          font-size: 12px;
          color: #e2e8f0;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 8px;
          overflow: hidden;
        }
        .inspector-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: #1e293b;
          border-bottom: 1px solid #334155;
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #94a3b8;
        }
        .inspector-header .badge {
          background: #334155;
          padding: 2px 8px;
          border-radius: 99px;
          font-size: 10px;
        }
        .tabs {
          display: flex;
          gap: 0;
          background: #1e293b;
          border-bottom: 1px solid #334155;
        }
        .tab {
          padding: 6px 14px;
          cursor: pointer;
          font-size: 11px;
          color: #64748b;
          border-bottom: 2px solid transparent;
          transition: all 0.15s;
        }
        .tab.active {
          color: #38bdf8;
          border-bottom-color: #38bdf8;
          background: rgba(56, 189, 248, 0.08);
        }
        .tab:hover {
          color: #94a3b8;
        }
        .panel {
          padding: 8px 12px;
          max-height: 400px;
          overflow-y: auto;
        }
        .panel::-webkit-scrollbar {
          width: 4px;
        }
        .panel::-webkit-scrollbar-track {
          background: transparent;
        }
        .panel::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 2px;
        }
        .module-card {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 6px;
          padding: 8px 10px;
          margin-bottom: 6px;
        }
        .module-name {
          color: #38bdf8;
          font-weight: 600;
          font-size: 12px;
        }
        .module-meta {
          color: #64748b;
          font-size: 10px;
          margin-top: 2px;
        }
        .state-key {
          display: inline-block;
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 4px;
          padding: 1px 6px;
          margin: 2px 2px 0 0;
          font-size: 10px;
          color: #a5b4fc;
        }
        .state-val {
          color: #34d399;
        }
        .event-item {
          padding: 4px 0;
          border-bottom: 1px solid #1e293b;
          font-size: 11px;
        }
        .event-module {
          color: #f472b6;
        }
        .event-name {
          color: #fbbf24;
        }
        .event-data {
          color: #64748b;
          font-size: 10px;
        }
        .validation-pass {
          color: #34d399;
        }
        .validation-fail {
          color: #f87171;
        }
        .empty {
          color: #64748b;
          font-style: italic;
          padding: 12px 0;
          text-align: center;
        }
        .refresh-btn {
          background: #334155;
          border: none;
          color: #94a3b8;
          padding: 2px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 10px;
        }
        .refresh-btn:hover {
          background: #475569;
          color: #e2e8f0;
        }
        .error-badge {
          color: #f87171;
          font-size: 10px;
        }
      </style>
      <div class="inspector-header">
        <span>WASM Inspector</span>
        <span class="badge" id="moduleCount">0 modules</span>
      </div>
      <div class="tabs">
        <div class="tab active" data-tab="modules">Modules</div>
        <div class="tab" data-tab="state">State</div>
        <div class="tab" data-tab="events">Events</div>
        <div class="tab" data-tab="validation">Validate</div>
      </div>
      <div class="panel" id="panel">
        <div class="empty">Initializing...</div>
      </div>
    `;

    // Tab switching
    const tabs = this.shadowRoot.querySelectorAll('.tab');
    for (const tab of tabs) {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        this.state.value = {
          ...this.state.value,
          selectedTab: (tab as HTMLElement).dataset
            .tab as InspectorState['selectedTab'],
        };
        this.renderPanel();
      });
    }

    this.state.value = {
      manifests: [],
      liveState: {},
      recentEvents: [],
      validationResults: '',
      selectedTab: 'modules',
    };

    // Reactive render on state change
    this.effect(() => {
      this.renderPanel();
      const badge = this.shadowRoot?.querySelector('#moduleCount');
      if (badge) {
        badge.textContent = `${this.state.value.manifests.length} modules`;
      }
    });
  }

  refresh(): void {
    if (!this.wasm) return;

    this.wasm.refreshManifests();
    this.wasm.pullState();

    const manifests = this.wasm.manifests;
    const liveState = { ...this.wasm.state.value };
    const validation = this.wasm.validate();

    let validationText = '';
    if (validation.length === 0) {
      validationText = 'All modules have their expected state keys.';
    } else {
      validationText = validation
        .map((v) => `${v.module}: missing [${v.missing.join(', ')}]`)
        .join('\n');
    }

    this.state.value = {
      ...this.state.value,
      manifests,
      liveState,
      validationResults: validationText,
    };
  }

  private renderPanel(): void {
    const panel = this.shadowRoot?.querySelector('#panel');
    if (!panel) return;

    const tab = this.state.value.selectedTab || 'modules';

    switch (tab) {
      case 'modules':
        panel.innerHTML = this.renderModules();
        break;
      case 'state':
        panel.innerHTML = this.renderState();
        break;
      case 'events':
        panel.innerHTML = this.renderEvents();
        break;
      case 'validation':
        panel.innerHTML = this.renderValidation();
        break;
    }
  }

  private renderModules(): string {
    const manifests = this.state.value.manifests;
    if (!manifests || manifests.length === 0) {
      return '<div class="empty">No modules registered</div>';
    }
    return manifests
      .map(
        (m) => `
      <div class="module-card">
        <div class="module-name">${m.name}</div>
        <div class="module-meta">${m.description || 'No description'}</div>
        <div style="margin-top: 4px;">
          ${m.state_keys
            .map((key) => `<span class="state-key">${key}</span>`)
            .join('')}
        </div>
      </div>
    `,
      )
      .join('');
  }

  private renderState(): string {
    const liveState = this.state.value.liveState;
    const keys = Object.keys(liveState);
    if (keys.length === 0) {
      return '<div class="empty">No state keys synced yet</div>';
    }
    return keys
      .map(
        (key) => `
      <div class="event-item">
        <span class="state-key">${key}</span>
        <span class="state-val">${JSON.stringify(liveState[key])}</span>
      </div>
    `,
      )
      .join('');
  }

  private renderEvents(): string {
    const events = this.state.value.recentEvents;
    if (!events || events.length === 0) {
      return '<div class="empty">No events yet. Dispatch some actions to see events.</div>';
    }
    return events
      .map(
        (e) => `
      <div class="event-item">
        <span class="event-module">${e.module}</span>
        .
        <span class="event-name">${e.name}</span>
        <span class="event-data">${JSON.stringify(e.data)}</span>
      </div>
    `,
      )
      .join('');
  }

  private renderValidation(): string {
    const text = this.state.value.validationResults;
    if (!text) {
      return '<div class="empty">Click refresh to validate</div>';
    }
    const isOk = text.includes('All modules');
    return `<div class="${isOk ? 'validation-pass' : 'validation-fail'}">${text}</div>`;
  }
}

defineExba('wasm-inspector', WasmInspector);
