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
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  });
});
