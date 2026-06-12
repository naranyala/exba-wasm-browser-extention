import browser from './lib/browser';

browser.runtime.onMessage.addListener((message) => {
  if (message.action === 'offscreen_copy') {
    const textArea = document.createElement('textarea');
    textArea.value = message.text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return Promise.resolve({ success: true });
    } catch (err) {
      document.body.removeChild(textArea);
      return Promise.resolve({
        success: false,
        error: (err as any).toString(),
      });
    }
  }
  return false;
});
