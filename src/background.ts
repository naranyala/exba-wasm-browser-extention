// Unified Extension Service Worker using Native Chrome APIs dynamically

const chromeObj = (globalThis as any).chrome;

// Track open side panels per window
const openSidePanels = new Set<number>();

if (chromeObj) {
  // Configure side panel behavior so that left-clicks open the side panel natively and reliably
  if (chromeObj.sidePanel && chromeObj.sidePanel.setPanelBehavior) {
    chromeObj.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error: any) =>
        console.error('Error setting panel behavior:', error),
      );
  }

  // Allow content scripts to access session storage
  if (
    chromeObj.storage &&
    chromeObj.storage.session &&
    chromeObj.storage.session.setAccessLevel
  ) {
    chromeObj.storage.session
      .setAccessLevel({
        accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS',
      })
      .catch((err: any) =>
        console.error('Error setting storage access level:', err),
      );
  }

  chromeObj.runtime.onConnect.addListener((port: any) => {
    if (port.name.startsWith('sidepanel-')) {
      const windowId = parseInt(port.name.replace('sidepanel-', ''), 10);
      if (!isNaN(windowId)) {
        openSidePanels.add(windowId);
        port.onDisconnect.addListener(() => {
          openSidePanels.delete(windowId);
        });
      }
    }
  });

  chromeObj.runtime.onInstalled.addListener(() => {
    // Set default values in storage
    chromeObj.storage.local.get(
      ['favoriteColor', 'isSidebarOpen'],
      (result: any) => {
        const updates: any = {};
        if (!result.favoriteColor) {
          updates.favoriteColor = '#60a5fa';
          updates.autoApply = false;
        }
        if (result.isSidebarOpen === undefined) {
          updates.isSidebarOpen = true; // Open the custom injected DOM sidebar by default
        }
        if (Object.keys(updates).length > 0) {
          chromeObj.storage.local.set(updates);
        }
      },
    );

    // Create a background Alarm
    console.log('[Background] Initializing alarms...');
    chromeObj.alarms.create('unified-alarm', {
      periodInMinutes: 1,
    });

    // Create Context Menu item to Toggle EXBA Panel
    chromeObj.contextMenus.removeAll(() => {
      chromeObj.contextMenus.create({
        id: 'toggle-exba-panel',
        title: 'Toggle EXBA Panel',
        contexts: ['all'],
      });
    });
  });

  // Listen for Alarms
  chromeObj.alarms.onAlarm.addListener((alarm: any) => {
    if (alarm.name === 'unified-alarm') {
      const timeString = new Date().toLocaleTimeString();
      console.log('[Background] Alarm event triggered at:', timeString);

      // Dispatch messages to other extension pages (e.g. Sidepanel)
      chromeObj.runtime
        .sendMessage({
          action: 'alarm_fired',
          time: timeString,
        })
        .catch(() => {});
    }
  });

  // Toggle the Custom Injected Side Panel via Storage
  const toggleCustomSidePanel = () => {
    chromeObj.storage.local.get(['isSidebarOpen'], (result: any) => {
      chromeObj.storage.local.set({ isSidebarOpen: !result.isSidebarOpen });
    });
  };

  // Check if a side panel is open in a specific window (synchronously to preserve user gesture context)
  const isSidePanelOpenSync = (windowId: number): boolean => {
    return openSidePanels.has(windowId);
  };

  // Open Chrome's native Side Panel
  const openNativeSidePanel = (windowId?: number) => {
    if (chromeObj.sidePanel && typeof chromeObj.sidePanel.open === 'function') {
      if (windowId !== undefined) {
        chromeObj.sidePanel.open({ windowId }).catch(console.error);
      } else {
        chromeObj.windows.getCurrent((currentWindow) => {
          if (currentWindow?.id !== undefined) {
            chromeObj.sidePanel
              .open({ windowId: currentWindow.id })
              .catch(console.error);
          }
        });
      }
    } else {
      console.warn(
        '[Background] sidePanel.open is not supported in this environment.',
      );
    }
  };

  // Manage Messages
  chromeObj.runtime.onMessage.addListener(
    (message: any, sender: any, sendResponse: any) => {
      if (message.action === 'write_clipboard') {
        handleClipboardWrite(message.text)
          .then(() => sendResponse({ success: true }))
          .catch((err) =>
            sendResponse({ success: false, error: err.toString() }),
          );
        return true; // Keep message channel open
      }
      if (message.action === 'open_options') {
        chromeObj.runtime.openOptionsPage();
        sendResponse({ success: true });
        return false;
      }
      if (message.action === 'open_side_panel') {
        openNativeSidePanel();
        sendResponse({ success: true });
        return false;
      }
      if (message.action === 'open_side_panel_on_gesture') {
        const windowId = sender.tab?.windowId;
        if (windowId !== undefined) {
          openNativeSidePanel(windowId);
        }
        sendResponse({ success: true });
        return false;
      }
      if (message.action === 'toggle_side_panel') {
        toggleCustomSidePanel();
        sendResponse({ success: true });
        return false;
      }
      return false;
    },
  );

  const handleClipboardWrite = async (text: string) => {
    const OFFSCREEN_PATH = 'offscreen.html';

    if (!chromeObj.offscreen) {
      console.warn(
        'Offscreen API not supported. Attempting fallback clipboard write.',
      );
      return;
    }

    const contexts = await chromeObj.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
    });

    if (contexts.length === 0) {
      await chromeObj.offscreen.createDocument({
        url: OFFSCREEN_PATH,
        reasons: ['CLIPBOARD'],
        justification: 'Copying generated text to the clipboard',
      });
    }

    try {
      const response = await chromeObj.runtime.sendMessage({
        action: 'offscreen_copy',
        text: text,
      });

      if (!response || !response.success) {
        throw new Error(
          response ? response.error : 'Unknown offscreen copy error',
        );
      }
    } finally {
      await chromeObj.offscreen.closeDocument();
    }
  };

  // Listen for Keyboard Command to Toggle Native Side Panel
  chromeObj.commands.onCommand.addListener((command: string, tab?: any) => {
    if (command === 'toggle-exba-panel') {
      const windowId = tab?.windowId;
      if (windowId !== undefined) {
        if (isSidePanelOpenSync(windowId)) {
          chromeObj.runtime
            .sendMessage({ action: 'close_side_panel', windowId })
            .catch(() => {});
        } else {
          openNativeSidePanel(windowId);
        }
      } else {
        chromeObj.windows.getCurrent((currentWindow) => {
          const wId = currentWindow?.id;
          if (wId !== undefined) {
            if (isSidePanelOpenSync(wId)) {
              chromeObj.runtime
                .sendMessage({ action: 'close_side_panel', windowId: wId })
                .catch(() => {});
            } else {
              openNativeSidePanel(wId);
            }
          }
        });
      }
    }
  });

  // Primary Action Icon click listener: intercepts left-clicks to toggle the side panel
  chromeObj.action.onClicked.addListener((tab: any) => {
    const windowId = tab.windowId;
    const tabId = tab.id;

    // Perform side panel toggle
    if (windowId !== undefined) {
      if (isSidePanelOpenSync(windowId)) {
        chromeObj.runtime
          .sendMessage({ action: 'close_side_panel', windowId })
          .catch(() => {});
      } else {
        openNativeSidePanel(windowId);
      }
    }

    // Execute script injection to display the alert in the page (for testing)
    if (tabId !== undefined && chromeObj.scripting) {
      chromeObj.scripting
        .executeScript({
          target: { tabId },
          func: () => {
            alert('EXBA extension action clicked!');
          },
        })
        .catch((err: any) => {
          console.warn('[Background] Failed to inject alert:', err);
        });
    }
  });

  // Listen for Context Menu Clicks to Toggle Native Side Panel
  chromeObj.contextMenus.onClicked.addListener((info: any, tab: any) => {
    if (info.menuItemId === 'toggle-exba-panel') {
      const windowId = tab?.windowId;
      if (windowId !== undefined) {
        if (isSidePanelOpenSync(windowId)) {
          chromeObj.runtime
            .sendMessage({ action: 'close_side_panel', windowId })
            .catch(() => {});
        } else {
          openNativeSidePanel(windowId);
        }
      }
    }
  });
}
