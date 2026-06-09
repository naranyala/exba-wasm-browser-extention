// Offscreen Document script running DOM-level tasks

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'offscreen_copy') {
    try {
      copyToClipboard(message.text);
      sendResponse({ success: true });
    } catch (err) {
      console.error('[Offscreen] Copy failed:', err);
      sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return true;
});

function copyToClipboard(text: string) {
  const textArea = document.createElement('textarea');
  textArea.value = text;

  // Hide element
  textArea.style.position = 'absolute';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);

  textArea.select();
  const success = document.execCommand('copy');

  document.body.removeChild(textArea);

  if (!success) {
    throw new Error('document.execCommand(copy) failed');
  }
}
