// Tizfon desktop softphone (Windows) — an Electron shell around the live web app
// (https://app.tizfon.com). A desktop app can hold the SIP registration open 24/7
// (no mobile Doze/push needed), so incoming calls ring instantly and reliably.
//
// Desktop niceties: system tray (close = hide, not quit, so the phone keeps
// ringing), auto-granted microphone for WebRTC, auto-start on login, single
// instance, external links open in the real browser, and the window pops to the
// front + flashes when a call comes in (via the preload bridge).

const { app, BrowserWindow, Tray, Menu, shell, nativeImage, session, ipcMain, dialog } = require('electron');
const path = require('path');
const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');

const APP_URL = process.env.TIZFON_URL || 'https://app.tizfon.com';
const ICON_ICO = path.join(__dirname, 'assets', 'icon.ico');
const ICON_PNG = path.join(__dirname, 'assets', 'icon.png');

// Auto-update feed. The shell (this Electron wrapper) silently updates itself;
// the UI/features live in the web app and refresh on their own. We ship a new
// .exe only when the native shell changes — and existing installs then pick it
// up here, so nobody is ever told to "go download it again". Because the updater
// fetches + runs the installer programmatically (no browser → no Mark-of-the-Web),
// SmartScreen never appears for updates — only, at worst, the very first install.
const UPDATE_MANIFEST = process.env.TIZFON_UPDATE_URL || 'https://tizfon.com/desktop/latest.json';
const UPDATE_INTERVAL_MS = 4 * 60 * 60 * 1000; // re-check every 4h

let mainWindow = null;
let tray = null;
let isQuitting = false;
let pendingInstaller = null;  // path to a downloaded+verified newer setup .exe
let pendingVersion = null;
let updateChecking = false;

// ── Single instance — a second launch just focuses the existing window ────────
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());

  app.whenReady().then(() => {
    // WebRTC needs the microphone; auto-grant media/notifications so the softphone
    // works without a permission prompt every launch.
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
      cb(['media', 'audioCapture', 'microphone', 'notifications', 'fullscreen'].includes(permission));
    });
    session.defaultSession.setPermissionCheckHandler(() => true);

    createWindow();
    createTray();

    // Launch on Windows login (hidden to tray) so calls are reachable after a reboot.
    try { app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true, args: ['--hidden'] }); } catch {}

    // Auto-update: first check shortly after launch, then every few hours.
    setTimeout(() => checkForUpdates(false), 20 * 1000);
    setInterval(() => checkForUpdates(false), UPDATE_INTERVAL_MS);

    app.on('activate', () => { if (!mainWindow) createWindow(); else showWindow(); });
  });
}

// ── Auto-updater ──────────────────────────────────────────────────────────────
// Pure-Node, no external deps: fetch a tiny JSON manifest, and if it names a
// newer version, download + checksum-verify the setup .exe, then offer to apply
// it (silent install relaunches the app). All failures are swallowed — a missing
// network or feed must never break the phone.

function semverGt(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
}

function httpGet(url, asJson) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'TizfonUpdater/' + app.getVersion() } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        res.resume();
        return httpGet(res.headers.location, asJson).then(resolve, reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolve(asJson ? JSON.parse(body) : body); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function downloadVerify(url, dest, expectSha) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const hash = crypto.createHash('sha256');
    const req = https.get(url, { headers: { 'User-Agent': 'TizfonUpdater/' + app.getVersion() } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        res.resume(); file.close(); fs.unlink(dest, () => {});
        return downloadVerify(res.headers.location, dest, expectSha).then(resolve, reject);
      }
      if (res.statusCode !== 200) { res.resume(); file.close(); fs.unlink(dest, () => {}); return reject(new Error('HTTP ' + res.statusCode)); }
      res.on('data', (d) => hash.update(d));
      res.pipe(file);
      file.on('finish', () => file.close(() => {
        const got = hash.digest('hex').toLowerCase();
        if (expectSha && got !== String(expectSha).toLowerCase()) {
          fs.unlink(dest, () => {});
          return reject(new Error('checksum mismatch'));
        }
        resolve(dest);
      }));
    });
    req.on('error', (e) => { file.close(); fs.unlink(dest, () => {}); reject(e); });
  });
}

async function checkForUpdates(manual) {
  if (updateChecking) return;
  if (pendingInstaller) { if (manual) promptAndApply(); return; }
  updateChecking = true;
  try {
    const m = await httpGet(UPDATE_MANIFEST + '?t=' + Date.now(), true);
    if (!m || !m.version || !m.url) throw new Error('bad manifest');
    if (!semverGt(m.version, app.getVersion())) {
      if (manual) dialog.showMessageBox(mainWindow, { type: 'info', title: 'Tizfon', message: 'You’re up to date.', detail: 'Version ' + app.getVersion() });
      return;
    }
    const dest = path.join(app.getPath('temp'), 'Tizfon-Setup-' + m.version + '.exe');
    await downloadVerify(m.url, dest, m.sha256);
    pendingInstaller = dest;
    pendingVersion = m.version;
    refreshTray();
    promptAndApply(m.notes);
  } catch (e) {
    if (manual) dialog.showMessageBox(mainWindow, { type: 'error', title: 'Tizfon', message: 'Could not check for updates.', detail: String(e && e.message || e) });
  } finally {
    updateChecking = false;
  }
}

function promptAndApply(notes) {
  if (!pendingInstaller) return;
  const r = dialog.showMessageBoxSync(mainWindow, {
    type: 'question',
    buttons: ['Restart & update now', 'Later'],
    defaultId: 0,
    cancelId: 1,
    title: 'Update available',
    message: 'Tizfon ' + pendingVersion + ' is ready to install.',
    detail: notes || 'Tizfon will restart to finish updating. It only takes a few seconds.',
  });
  if (r === 0) applyUpdate();
}

function applyUpdate() {
  if (!pendingInstaller) return;
  try {
    // Silent install: the installer closes the running app, replaces files, then
    // relaunches Tizfon (see installer.nsi ${If} ${Silent}).
    spawn(pendingInstaller, ['/S'], { detached: true, stdio: 'ignore' }).unref();
    isQuitting = true;
    setTimeout(() => app.quit(), 400);
  } catch (e) {
    dialog.showMessageBox(mainWindow, { type: 'error', title: 'Tizfon', message: 'Update could not start.', detail: String(e && e.message || e) });
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 920,
    minHeight: 600,
    title: 'Tizfon',
    icon: ICON_ICO,
    backgroundColor: '#0b0b0d',
    autoHideMenuBar: true,
    show: !process.argv.includes('--hidden'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,   // keep the SIP WebSocket + ringtone alive when hidden/minimized
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  mainWindow.loadURL(APP_URL);

  // Inject a tiny page-world detector that signals incoming calls (the web app
  // shows a Notification / sets a ringing title when a call arrives) so we can
  // surface the window even when it's hidden in the tray.
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`(function(){
      if (window.__tizfonHook) return; window.__tizfonHook = true;
      try {
        var N = window.Notification;
        if (N) {
          var W = function(title, opts){ try{ window.postMessage({__tizfon:'incoming'},'*'); }catch(e){} return new N(title, opts); };
          W.permission = N.permission; W.requestPermission = N.requestPermission ? N.requestPermission.bind(N) : function(){return Promise.resolve('granted');};
          try { Object.defineProperty(window,'Notification',{value:W,writable:true,configurable:true}); } catch(e){}
        }
      } catch(e){}
      try {
        var check=function(){ var t=(document.title||'').toLowerCase(); if(/incoming|ringing|calling/.test(t)) window.postMessage({__tizfon:'incoming'},'*'); };
        var el=document.querySelector('title')||document.head;
        if (el) new MutationObserver(check).observe(el,{subtree:true,childList:true,characterData:true});
      } catch(e){}
    })();`).catch(function(){});
  });

  // Links to other sites open in the user's real browser, not inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try { if (!url.startsWith(APP_URL)) { shell.openExternal(url); return { action: 'deny' }; } } catch {}
    return { action: 'allow' };
  });

  // Closing the window HIDES it to the tray (the phone must keep running to ring).
  mainWindow.on('close', (e) => {
    if (!isQuitting) { e.preventDefault(); mainWindow.hide(); }
  });
}

function createTray() {
  const img = nativeImage.createFromPath(ICON_PNG).resize({ width: 18, height: 18 });
  tray = new Tray(img.isEmpty() ? ICON_ICO : img);
  tray.setToolTip('Tizfon');
  tray.on('click', () => showWindow());
  tray.on('double-click', () => showWindow());
  refreshTray();
}

function refreshTray() {
  if (!tray) return;
  const items = [{ label: 'Open Tizfon', click: () => showWindow() }, { type: 'separator' }];
  if (pendingInstaller) {
    items.push({ label: 'Restart to update (v' + pendingVersion + ')', click: () => applyUpdate() });
  } else {
    items.push({ label: 'Check for updates…', click: () => checkForUpdates(true) });
  }
  items.push({ type: 'separator' });
  items.push({ label: 'Quit Tizfon', click: () => { isQuitting = true; app.quit(); } });
  tray.setContextMenu(Menu.buildFromTemplate(items));
}

function showWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

// The preload posts 'incoming-call' when it detects a ringing call in the web app →
// surface the window and flash the taskbar so the user never misses it.
ipcMain.on('tizfon:incoming', () => {
  showWindow();
  try { mainWindow.flashFrame(true); } catch {}
});
ipcMain.on('tizfon:call-ended', () => { try { mainWindow.flashFrame(false); } catch {} });

app.on('before-quit', () => { isQuitting = true; });
// Don't auto-quit when the window "closes" — we hide to tray and keep the phone alive.
app.on('window-all-closed', () => {});
