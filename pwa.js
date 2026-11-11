(() => {
  'use strict';
  const installButton = document.querySelector('#install-button');
  const status = document.querySelector('#pwa-message');
  let installPrompt;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });
  installButton.addEventListener('click', async () => {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    installButton.hidden = true;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      status.textContent = '請使用瀏覽器選單的安裝或加入主畫面選項。';
      status.hidden = false;
    }
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    installButton.hidden = true;
  });

  if ('serviceWorker' in navigator && window.isSecureContext) {
    // Relative URLs keep the app inside its GitHub Pages project directory.
    navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
      .catch(() => {
        status.textContent = '離線功能準備失敗；連線時仍可使用，請稍後重新載入再試。';
        status.hidden = false;
      });
  } else {
    status.textContent = '目前瀏覽器或連線方式不支援離線安裝；請使用 HTTPS 或 localhost 開啟。';
    status.hidden = false;
  }
})();
