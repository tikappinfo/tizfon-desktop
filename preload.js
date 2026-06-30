// Isolated-world bridge. The page-world detector (injected from main.js) posts a
// window message when an incoming call rings or ends; we forward it to the main
// process so it can pop the window to the front and flash the taskbar.
const { ipcRenderer } = require('electron');

window.addEventListener('message', (e) => {
  const t = e && e.data && e.data.__tizfon;
  if (t === 'incoming') ipcRenderer.send('tizfon:incoming');
  else if (t === 'ended') ipcRenderer.send('tizfon:call-ended');
});
