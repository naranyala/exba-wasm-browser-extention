// Unified Extension Content Script
(function () {
  console.log('[Unified Extension] Content script active.');

  // Fetch configs
  chrome.storage.local.get(['favoriteColor', 'autoApply'], (result) => {
    if (result.autoApply && result.favoriteColor) {
      console.log('[Unified Extension] Auto-applying color:', result.favoriteColor);
      applyColor(result.favoriteColor);
    }
  });

  function applyColor(color) {
    if (document.body) {
      document.body.style.backgroundColor = color;
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.style.backgroundColor = color;
      });
    }
  }
})();
