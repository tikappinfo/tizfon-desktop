# Publishing Tizfon to the Microsoft Store (removes SmartScreen — your brand, ~$19 once)

Store apps are trusted by Windows: **no "Windows protected your PC" screen**, the
publisher shown is **your own name**, and the Store delivers updates for free. The
only cost is a **one-time ~$19** individual developer registration.

## Step 1 — Register on Partner Center (~$19, one-time)

1. Go to <https://partner.microsoft.com/dashboard/registration> and sign in with a
   Microsoft account.
2. Choose the **Individual** account type (≈ $19 one-time; Company is $99 and only
   needed for a company-verified publisher name).
3. Complete the profile + pay. Verification can take a little while.

## Step 2 — Reserve the app name

1. In Partner Center → **Apps and games** → **New product** → **MSIX or PWA app**.
2. Reserve the name **`Tizfon`** (or another available name).

## Step 3 — Send me 3 identity values

Open your product → **Product management → Product identity**. Copy these three and
send them to me:

| Value in Partner Center | Goes into |
| --- | --- |
| **Package/Identity Name** (e.g. `1234Publisher.Tizfon`) | `appx.identityName` |
| **Publisher** (e.g. `CN=ABCD1234-....`) | `appx.publisher` |
| **Publisher display name** (e.g. `Tizfon`) | `appx.publisherDisplayName` |

I'll fill them into `package.json` and build the `.appx`.

## Step 4 — I build the Store package

I run the **"Build Microsoft Store package (.appx)"** GitHub Action (Windows
runner — no wine, no local Windows needed). It produces `dist/*.appx` as a
downloadable artifact.

## Step 5 — Upload + submit

1. Download the `.appx` artifact from the Actions run.
2. In your Partner Center submission → **Packages** → upload the `.appx`.
3. Fill Store listing (description, screenshots, category = *Productivity*), set
   pricing to **Free**, and **Submit for certification**.
4. Certification typically takes 1–3 days.

## Step 6 — Go live

Once approved, the app is in the Store. I'll add a **"Get it from Microsoft Store"**
button to <https://tizfon.com/download> pointing at your Store link
(`ms-windows-store://pdp/?productid=...`). Customers install with one click — no
SmartScreen, updates handled by the Store.

---

### Notes
- The direct `Tizfon-Setup.exe` download + custom auto-updater keep working for
  users who prefer a plain installer; the Store build simply disables the
  self-updater (Electron sets `process.windowsStore`, and `main.js` skips updates
  in that case).
- Individual accounts show the publisher you set during registration/verification.
  A company account ($99) is only needed if you want a company-verified name.
