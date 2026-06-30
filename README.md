# Tizfon Desktop

Open-source **Windows desktop client** for [Tizfon](https://tizfon.com) — a cloud
phone that gives you a real Tehran 021 line you can answer anywhere.

This app is a lightweight [Electron](https://www.electronjs.org/) shell around the
Tizfon web app (`app.tizfon.com`). Running it on the desktop keeps your SIP line
registered 24/7, so incoming calls ring **instantly and reliably** — no browser
tab to keep open, no mobile battery/Doze problems.

## Features

- 📞 **Always-on line** — stays registered in the background (system tray), so calls ring immediately.
- 🔔 **Never miss a call** — the window pops to the front and the taskbar flashes on an incoming call.
- 🔄 **Silent auto-update** — the app updates itself in the background; you install once.
- 🎙️ **WebRTC audio** — microphone is granted automatically for the softphone.
- 🔒 **Encrypted** — TLS + SRTP, the same secure line as the browser client.

## Install (users)

Download the latest installer from **<https://tizfon.com/download>**.

## Build from source (developers)

Requires Node.js 20+.

```bash
npm install
npm run pack    # builds the unpacked app into dist/win-unpacked
```

To produce the installer, build the unpacked app (above) and run the bundled
NSIS script from the repo root:

```bash
makensis installer.nsi   # → dist/Tizfon-Setup-<version>.exe
```

The installer is a per-user setup (no admin/UAC needed): Start-menu + desktop
shortcuts, an uninstaller, and an entry in *Add/Remove Programs*.

## How updates work

The app polls a small JSON manifest (`/desktop/latest.json`), and when a newer
version is published it downloads + checksum-verifies the installer and applies
it on the user's confirmation. Because the update is fetched and run
programmatically, it installs silently and seamlessly.

## Code signing

Release installers are code-signed via [SignPath.io](https://signpath.io)'s free
program for open-source projects, so Windows SmartScreen recognizes the
publisher. See [`SIGNING-SETUP.md`](./SIGNING-SETUP.md).

## License

[MIT](./LICENSE) © Tizfon
