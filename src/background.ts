// Unified Extension Service Worker

chrome.runtime.onInstalled.addListener(() => {
  // 1. Set Sidepanel Behavior to true so action clicks open the Side Panel directly
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }

  // 2. Set default values in storage
  chrome.storage.local.get(['favoriteColor'], (result) => {
    if (!result.favoriteColor) {
      chrome.storage.local.set({
        favoriteColor: '#60a5fa',
        autoApply: false,
      });
    }
  });

  // 3. Create a background Alarm
  console.log('[Background] Initializing alarms...');
  chrome.alarms.create('unified-alarm', {
    periodInMinutes: 1,
  });

  // 4. Create Context Menu item to Toggle EXBA Panel
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'toggle-exba-panel',
      title: 'Toggle EXBA Panel',
      contexts: ['all'],
    });
  });
});

// 4. Listen for Alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'unified-alarm') {
    const timeString = new Date().toLocaleTimeString();
    console.log('[Background] Alarm event triggered at:', timeString);

    // Dispatch messages to other extension pages (e.g. Sidepanel)
    chrome.runtime
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
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'write_clipboard') {
    handleClipboardWrite(message.text)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.toString() }));
    return true; // Keep channel open
  }
  if (message.action === 'open_options') {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return true;
  }
  return false;
});

async function handleClipboardWrite(text: string) {
  const OFFSCREEN_PATH = 'offscreen.html';

  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });

  if (contexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_PATH,
      reasons: ['CLIPBOARD'],
      justification: 'Copying generated text to the clipboard',
    });
  }

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'offscreen_copy',
      text: text,
    });

    if (!response || !response.success) {
      throw new Error(
        response ? response.error : 'Unknown offscreen copy error',
      );
    }
  } finally {
    await chrome.offscreen.closeDocument();
  }
}

// 6. Listen for Keyboard Command to Toggle EXBA Panel
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-exba-panel') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab && activeTab.id) {
        chrome.tabs.sendMessage(activeTab.id, { action: 'toggle_sidebar' }).catch(() => {
          // Ignore errors for tabs where content script isn't loaded (e.g. chrome:// tabs)
        });
      }
    });
  }
});

// 7. Listen for Browser Action Icon Click (Command Bar Button) to Toggle EXBA Panel
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'toggle_sidebar' }).catch(() => {
      // Ignore errors for tabs where content script isn't loaded (e.g. chrome:// pages)
    });
  }
});

// 8. Listen for Context Menu Clicks to Toggle EXBA Panel
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'toggle-exba-panel' && tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'toggle_sidebar' }).catch(() => {
      // Ignore errors for tabs where content script isn't loaded
    });
  }
});

