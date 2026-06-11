import browser from './lib/browser';
import './components/wasm-dashboard';

// Apply embedded layout styles if requested in the URL
if (new URLSearchParams(window.location.search).get('embed') === 'true') {
  document.body.classList.add('embedded');
}

// Bind the options link in the popup footer
document.addEventListener('DOMContentLoaded', () => {
  const openOptionsBtn = document.getElementById('open-options');
  openOptionsBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    if (browser.runtime.openOptionsPage) {
      browser.runtime.openOptionsPage();
    } else {
      window.open(browser.runtime.getURL('options.html'));
    }
  });
});
