document.addEventListener('DOMContentLoaded', () => {
  const clipInput = document.getElementById('clip-text');
  const btnCopy = document.getElementById('btn-copy');
  const clipStatus = document.getElementById('clip-status');
  const alarmList = document.getElementById('alarm-list');

  let alarmCount = 0;

  // 1. Copy Action via Background Service Worker
  btnCopy.addEventListener('click', () => {
    const text = clipInput.value;
    if (!text) return;

    chrome.runtime.sendMessage({
      action: 'write_clipboard',
      text: text
    }, (response) => {
      if (response && response.success) {
        clipStatus.textContent = 'Copied to clipboard!';
        clipStatus.style.color = '#10b981';
      } else {
        clipStatus.textContent = `Error: ${response ? response.error : 'unknown'}`;
        clipStatus.style.color = '#ef4444';
      }
      setTimeout(() => {
        clipStatus.textContent = '';
      }, 2000);
    });
  });

  // 2. Alarm Events Listeners
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'alarm_fired') {
      if (alarmCount === 0) {
        alarmList.innerHTML = ''; // Clear placeholder
      }
      alarmCount++;
      const li = document.createElement('li');
      li.textContent = `[Alarm #${alarmCount}] Fired at ${message.time}`;
      li.style.marginBottom = '4px';
      alarmList.appendChild(li);
      alarmList.scrollTop = alarmList.scrollHeight; // Auto-scroll
    }
  });
});
