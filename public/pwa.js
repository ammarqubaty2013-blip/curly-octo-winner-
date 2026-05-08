let installPromptEvent = null;
const installButton = document.getElementById('installBtn');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js');
  });
}

window.addEventListener('beforeinstallprompt', function (event) {
  event.preventDefault();
  installPromptEvent = event;
  if (installButton) installButton.hidden = false;
});

if (installButton) {
  installButton.addEventListener('click', async function () {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    await installPromptEvent.userChoice;
    installPromptEvent = null;
    installButton.hidden = true;
  });
}
