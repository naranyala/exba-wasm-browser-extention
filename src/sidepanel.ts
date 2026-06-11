import './components/wasm-dashboard';
import browser from './lib/browser';

// Connect to background to track open state per window
(async () => {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    try {
      const currentWindow = await browser.windows.getCurrent();
      const port = browser.runtime.connect({ name: `sidepanel-${currentWindow.id}` });
      
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
