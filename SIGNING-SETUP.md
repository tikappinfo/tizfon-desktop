# Free code signing with SignPath (one-time setup)

Goal: make Windows stop showing the **"Windows protected your PC" / Run anyway**
screen, at **zero cost**, by code-signing every release with a real certificate
from [SignPath.io](https://signpath.io)'s free program for open-source projects.

> ⏱️ This is a one-time setup. Approval by SignPath usually takes a few business
> days. It is not guaranteed for every project — but it costs nothing to apply.

## Step 1 — Put this repo on GitHub (public)

```bash
cd tizfon-desktop
git init
git add -A
git commit -m "Tizfon Desktop — open-source Windows client"
git branch -M main
# create an EMPTY public repo named "tizfon-desktop" on github.com first, then:
git remote add origin https://github.com/<your-username>/tizfon-desktop.git
git push -u origin main
```

Then update `package.json` → replace the two `REPLACE-ME` GitHub URLs with your
real username/repo and commit again.

## Step 2 — Apply to SignPath's OSS program

1. Go to <https://signpath.io/open-source> and sign up (free) with your GitHub account.
2. Submit `https://github.com/<your-username>/tizfon-desktop` for the
   **Foundation (open-source)** plan.
3. SignPath reviews it. When approved you get an **Organization**, a **Project**,
   and a **Signing Policy** in their dashboard.

## Step 3 — Connect SignPath to the build

In the SignPath dashboard:
- Create a project with slug **`tizfon-desktop`** (matches `.github/workflows/release.yml`).
- Create a signing policy with slug **`release-signing`**.
- Link your GitHub repo as the trusted build source (GitHub Actions / OIDC).
- Create an **API token**.

In your GitHub repo → **Settings → Secrets and variables → Actions**, add:
- `SIGNPATH_API_TOKEN` — the token from SignPath.
- `SIGNPATH_ORG_ID` — your SignPath organization id.

## Step 4 — Cut a signed release

```bash
# bump the version in package.json + installer.nsi (VERSION + VIProductVersion) first
git tag v1.0.2
git push origin v1.0.2
```

The workflow builds the installer on a Windows runner, sends it to SignPath to be
signed, and attaches the **signed** `Tizfon-Setup-*.exe` to the GitHub Release.

## Step 5 — Publish it to tizfon.com

Download the signed installer from the GitHub Release and drop it on the server
exactly like the current unsigned one:

```
public/Tizfon-Setup.exe                  (stable download link)
public/desktop/Tizfon-Setup-<version>.exe (versioned, for the auto-updater)
public/desktop/latest.json               (bump "version" + "sha256")
# then: pm2 restart iranline-marketing
```

Existing installs auto-update to the signed build — and **from then on the
SmartScreen warning is gone** (signed publisher + reputation).

---

### Notes & honesty
- SignPath's free certs are **OV** (organization-validated). The "unknown
  publisher" text disappears immediately; the SmartScreen *reputation* warning
  fades after the signed publisher accrues a little download history. It is not
  always literally instant on day one, but it gets there fast and stays clean.
- The only **instant, guaranteed day-one** options cost money: an **EV
  certificate** (~$300/yr) or a one-time **$19 Microsoft Store** developer
  account. Either can be wired into this same pipeline later.
- Until signing is live, the current download page already guides users through
  the one-time "More info → Run anyway", and updates are silent regardless.
