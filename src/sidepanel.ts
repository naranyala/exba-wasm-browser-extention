import './components/wasm-dashboard';
import browser from './lib/browser';

// Connect to background to track open state per window with automatic reconnection on SW suspension
(async () => {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    try {
      const currentWindow = await browser.windows.getCurrent();
      
      const connectToBackground = () => {
        try {
          const port = browser.runtime.connect({ name: `sidepanel-${currentWindow.id}` });
          port.onDisconnect.addListener(() => {
            // Reconnect if the side panel is still open
            setTimeout(connectToBackground, 1000);
          });
        } catch (e) {
          console.warn('[SidePanel] Connection failed, retrying...', e);
          setTimeout(connectToBackground, 5000);
        }
      };

      connectToBackground();
      
      // Listen for programmatic close signals
      browser.runtime.onMessage.addListener(async (message) => {
        if (message.action === 'close_side_panel') {
          if (message.windowId === currentWindow.id) {
            window.close();
          }
        }
      });
    } catch (e) {
      console.warn('[SidePanel] Failed to initialize state tracking:', e);
    }
  }
})();
