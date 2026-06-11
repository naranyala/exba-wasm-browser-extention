import browser from './lib/browser';

// Unified Extension Service Worker

browser.runtime.onInstalled.addListener(async () => {
  // 1. Set Sidepanel Behavior to true so action clicks open the Side Panel directly
  // Note: browser.sidePanel is Chrome-specific, but we use feature detection for cross-browser safety.
  if ((browser as any).sidePanel && (browser as any).sidePanel.setPanelBehavior) {
    try {
      await (browser as any).sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } catch (e) {
      console.warn('SidePanel.setPanelBehavior not supported or failed:', e);
    }
  }

  // 2. Set default values in storage
  const result = await browser.storage.local.get(['favoriteColor']);
  if (!result.favoriteColor) {
    await browser.storage.local.set({
      favoriteColor: '#60a5fa',
      autoApply: false,
    });
  }

  // 3. Create a background Alarm
  console.log('[Background] Initializing alarms...');
  browser.alarms.create('unified-alarm', {
    periodInMinutes: 1,
  });

  // 4. Create Context Menu item to Toggle EXBA Panel
  try {
    await browser.contextMenus.removeAll();
    browser.contextMenus.create({
      id: 'toggle-exba-panel',
      title: 'Toggle EXBA Panel',
      contexts: ['all'],
    });
  } catch (e) {
    console.error('Error creating context menu:', e);
  }
});

// 4. Listen for Alarms
browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'unified-alarm') {
    const timeString = new Date().toLocaleTimeString();
    console.log('[Background] Alarm event triggered at:', timeString);

    // Dispatch messages to other extension pages (e.g. Sidepanel)
    browser.runtime
      .sendMessage({
        action: 'alarm_fired',
        time: timeString,
      })
      .catch(() => {
        // Catch error if listeners aren't currently open
      });
  }
});

// 5. Manage Offscreen Clipboard Operations & App Navigation
browser.runtime.onMessage.addListener((message, sender) => {
  if (message.action === 'write_clipboard') {
    return handleClipboardWrite(message.text)
      .then(() => ({ success: true }))
      .catch((err) => ({ success: false, error: err.toString() }));
  }
  if (message.action === 'open_options') {
    browser.runtime.openOptionsPage();
    return Promise.resolve({ success: true });
  }
  if (message.action === 'open_side_panel') {
    if (sender.tab && sender.tab.id) {
      openSidePanel(sender.tab.id);
      return Promise.resolve({ success: true });
    }
    return Promise.resolve({ success: false, error: 'No tab ID found' });
  }
  return false;
});

async function openSidePanel(tabId: number) {
  if ((browser as any).sidePanel && (browser as any).sidePanel.open) {
    await (browser as any).sidePanel.open({ tabId });
  } else if ((browser as any).sidebarAction && (browser as any).sidebarAction.open) {
    // Firefox fallback
    await (browser as any).sidebarAction.open();
  } else {
    // Final fallback to injected sidebar
    await browser.tabs.sendMessage(tabId, { action: 'toggle_sidebar' }).catch(() => {});
  }
}

async function handleClipboardWrite(text: string) {
  const OFFSCREEN_PATH = 'offscreen.html';

  // Feature detection for Offscreen Document (Chrome only currently)
  if (!(browser as any).offscreen) {
    // Fallback for Firefox/Safari: use navigator.clipboard if possible or other hacks
    // For now, we try to use the modern clipboard API directly if in a secure context
    try {
      // Note: This often fails in background scripts without user gesture or specific focus
      // A more robust fallback would be an injected script.
      console.warn('Offscreen API not supported. Attempting fallback clipboard write.');
    } catch (e) {
      throw new Error('Clipboard write not supported on this browser.');
    }
    return;
  }

  const contexts = await (browser as any).runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });

  if (contexts.length === 0) {
    await (browser as any).offscreen.createDocument({
      url: OFFSCREEN_PATH,
      reasons: ['CLIPBOARD'],
      justification: 'Copying generated text to the clipboard',
    });
  }

  try {
    const response = await browser.runtime.sendMessage({
      action: 'offscreen_copy',
      text: text,
    });

    if (!response || !response.success) {
      throw new Error(
        response ? response.error : 'Unknown offscreen copy error',
      );
    }
  } finally {
    await (browser as any).offscreen.closeDocument();
  }
}

// 6. Listen for Keyboard Command to Toggle EXBA Panel
browser.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-exba-panel') {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    if (activeTab && activeTab.id) {
      await openSidePanel(activeTab.id);
    }
  }
});

// 7. Listen for Browser Action Icon Click (Command Bar Button) to Toggle EXBA Panel
browser.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await openSidePanel(tab.id);
  }
});

// 8. Listen for Context Menu Clicks to Toggle EXBA Panel
browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'toggle-exba-panel' && tab && tab.id) {
    await openSidePanel(tab.id);
  }
});
