// Unified Extension Content Script
import { chromeAPI } from '../lib/chrome';

(() => {
  console.log('[Unified Extension] Content script active.');

  // Fetch configs
  chromeAPI.storage.local.get<any>(['favoriteColor', 'autoApply']).then((result) => {
    if (result.autoApply && typeof result.favoriteColor === 'string') {
      console.log(
        '[Unified Extension] Auto-applying color:',
        result.favoriteColor,
      );
      applyColor(result.favoriteColor);
    }
  });

  function applyColor(color: string) {
    if (document.body) {
      document.body.style.backgroundColor = color;
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        if (document.body) {
          document.body.style.backgroundColor = color;
        }
      });
    }
  }
})();
