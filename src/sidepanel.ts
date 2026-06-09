document.addEventListener('DOMContentLoaded', async () => {
  const clipInput = document.getElementById('clip-text') as HTMLInputElement | null;
  const btnCopy = document.getElementById('btn-copy') as HTMLButtonElement | null;
  const clipStatus = document.getElementById('clip-status') as HTMLParagraphElement | null;
  const alarmList = document.getElementById('alarm-list') as HTMLUListElement | null;

  let alarmCount = 0;

  // 1. Copy Action via Background Service Worker
  btnCopy?.addEventListener('click', async () => {
    const text = clipInput?.value;
    if (!text) return;

    try {
      const response = await chromeAPI.runtime.sendMessage({
        action: 'write_clipboard',
        text: text,
      });

      if (clipStatus) {
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
      }
    } catch (err) {
      if (clipStatus) {
        clipStatus.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
        clipStatus.style.color = '#ef4444';
      }
    }
  });

  // 2. Alarm Events Listeners
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'alarm_fired') {
      if (alarmCount === 0 && alarmList) {
        alarmList.innerHTML = ''; // Clear placeholder
      }
      alarmCount++;
      if (alarmList) {
        const li = document.createElement('li');
        li.textContent = `[Alarm #${alarmCount}] Fired at ${message.time}`;
        li.style.marginBottom = '4px';
        alarmList.appendChild(li);
        alarmList.scrollTop = alarmList.scrollHeight; // Auto-scroll
      }
    }
  });
});
