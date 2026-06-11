import browser from './lib/browser';

// Unified Extension Content Script

(() => {
  console.log('[Unified Extension] Content script active.');

  // Initialize features
  if (document.body) {
    initColorApplier();
    initSidebar();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      initColorApplier();
      initSidebar();
    });
  }

  function initColorApplier() {
    // Fetch configs
    browser.storage.local.get(['favoriteColor', 'autoApply']).then((result) => {
      if (result.autoApply && typeof result.favoriteColor === 'string') {
        console.log(
          '[Unified Extension] Auto-applying color:',
          result.favoriteColor,
        );
        applyColor(result.favoriteColor);
      }
    });

    function applyColor(color: string) {
      if (document.body) {
        document.body.style.backgroundColor = color;
      }
    }
  }

  function initSidebar() {
    if (document.getElementById('exba-sidebar-host')) return; // Avoid double injection

    const host = document.createElement('div');
    host.id = 'exba-sidebar-host';
    Object.assign(host.style, {
      position: 'fixed',
      top: '0',
      right: '0',
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: '2147483647',
    });

    // Create Shadow DOM
    const shadow = host.attachShadow({ mode: 'open' });

    // Create styles for Shadow DOM elements
    const style = document.createElement('style');
    style.textContent = `
      .exba-command-bar {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        height: 48px;
        background: rgba(9, 13, 22, 0.85);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 24px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        display: flex;
        align-items: center;
        padding: 0 8px 0 16px;
        gap: 8px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 2147483645;
        font-family: system-ui, -apple-system, sans-serif;
        pointer-events: auto;
      }
      
      .brand {
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.1em;
        background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-right: 4px;
      }
      
      .divider {
        width: 1px;
        height: 20px;
        background: rgba(255, 255, 255, 0.08);
      }
      
      .bar-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        padding: 0 12px;
        border-radius: 16px;
        height: 32px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s;
      }
      
      .bar-btn:hover {
        color: #f8fafc;
        background: rgba(255, 255, 255, 0.06);
      }
      
      .close-bar-btn {
        color: #64748b;
        font-size: 16px;
        padding: 0;
        width: 32px;
        justify-content: center;
        display: flex;
        align-items: center;
      }
      
      .close-bar-btn:hover {
        color: #ef4444;
        background: rgba(239, 68, 68, 0.1);
      }

      .exba-pinned-badge {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 48px;
        height: 48px;
        background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 50%;
        box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 2147483645;
        color: white;
        font-family: system-ui, -apple-system, sans-serif;
        font-weight: 800;
        font-size: 11px;
        letter-spacing: 0.05em;
        opacity: 0.9;
        pointer-events: auto;
      }
      
      .exba-pinned-badge:hover {
        transform: scale(1.05) translateY(-2px);
        box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
        opacity: 1;
      }

      .sidebar-panel {
        position: fixed;
        right: -450px;
        top: 0;
        width: 440px;
        height: 100vh;
        background: linear-gradient(135deg, #090d16 0%, #111625 100%);
        box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5);
        border-left: 1px solid rgba(255, 255, 255, 0.08);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 2147483646;
        display: flex;
        flex-direction: column;
        pointer-events: auto;
      }
      
      .sidebar-panel.open {
        right: 0;
      }
      
      iframe {
        width: 100%;
        height: 100%;
        border: none;
        margin: 0;
        padding: 0;
      }
      
      .close-btn {
        position: absolute;
        top: 12px;
        left: 12px;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #94a3b8;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        transition: all 0.2s;
        z-index: 10;
      }
      
      .close-btn:hover {
        background: rgba(255, 255, 255, 0.12);
        color: #f8fafc;
      }

      .hidden {
        display: none !important;
      }
    `;

    // Create elements
    const commandBar = document.createElement('div');
    commandBar.className = 'exba-command-bar hidden';
    commandBar.innerHTML = `
      <div class="brand">EXBA</div>
      <div class="divider"></div>
      <button class="bar-btn" id="btn-toggle-dashboard" title="Toggle EXBA Panel">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
        <span>EXBA Panel</span>
      </button>
      <button class="bar-btn" id="btn-open-settings" title="Open Settings">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        <span>Settings</span>
      </button>
      <div class="divider"></div>
      <button class="bar-btn close-bar-btn" id="btn-minimize-bar" title="Minimize Command Bar">
        &times;
      </button>
    `;

    const pinnedBadge = document.createElement('div');
    pinnedBadge.className = 'exba-pinned-badge';
    pinnedBadge.textContent = 'EXBA';

    const panel = document.createElement('div');
    panel.className = 'sidebar-panel';

    const closeBtn = document.createElement('div');
    closeBtn.className = 'close-btn';
    closeBtn.innerHTML = `&times;`;

    const iframe = document.createElement('iframe');
    iframe.src = browser.runtime.getURL('popup.html?embed=true');

    panel.appendChild(closeBtn);
    panel.appendChild(iframe);

    shadow.appendChild(style);
    shadow.appendChild(commandBar);
    shadow.appendChild(pinnedBadge);
    shadow.appendChild(panel);

    document.body.appendChild(host);

    // Try to open the sidepanel automatically on first load (might be blocked without gesture)
    browser.runtime.sendMessage({ action: 'open_side_panel' }).catch(() => {});

    function toggleSidebar() {
      panel.classList.toggle('open');
    }

    // Toggle button triggers
    commandBar.querySelector('#btn-toggle-dashboard')?.addEventListener('click', () => {
      browser.runtime.sendMessage({ action: 'toggle_side_panel' }).catch(() => {
        toggleSidebar();
      });
    });
    closeBtn.addEventListener('click', toggleSidebar);

    // Settings trigger (through messaging to background)
    commandBar.querySelector('#btn-open-settings')?.addEventListener('click', () => {
      browser.runtime.sendMessage({ action: 'open_options' });
    });

    // Minimize / Restore triggers
    commandBar.querySelector('#btn-minimize-bar')?.addEventListener('click', () => {
      commandBar.classList.add('hidden');
      pinnedBadge.classList.remove('hidden');
    });

    pinnedBadge.addEventListener('click', () => {
      pinnedBadge.classList.add('hidden');
      commandBar.classList.remove('hidden');
      
      // Try to open the native side panel
      browser.runtime.sendMessage({ action: 'open_side_panel' }).catch(() => {
        // Fallback to injected sidebar if side panel fails or message isn't handled
        if (!panel.classList.contains('open')) {
          toggleSidebar();
        }
      });
    });

    // Listen for events from background worker
    browser.runtime.onMessage.addListener((message) => {
      if (message.action === 'toggle_sidebar') {
        toggleSidebar();
      }
    });
  }
})();
