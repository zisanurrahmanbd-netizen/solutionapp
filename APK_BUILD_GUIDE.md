# 📱 Turn RecoveryCORE into an Android APK

The app is now a **PWA** (installable web app). One codebase, two targets:

| Where | How users get it |
|---|---|
| **Chrome / any browser** | Just open the URL — or click **Install App** in the sidebar to get a standalone app window |
| **Android APK** | Wrap the PWA with one of the options below — no code changes needed |

> ✅ Prerequisite: deploy the site over **HTTPS** (the Freebuff Deploy button does this automatically). PWAs and APK wrapping require HTTPS.

---

## Option A — PWABuilder (easiest, no tools to install)

1. Open **https://www.pwabuilder.com**
2. Paste your deployed URL (e.g. `https://your-app.freebuff.app`) → **Start**
3. Wait for the analysis (manifest + service worker will show green ✓)
4. Click **Package for stores → Android**
5. Options:
   - **Package ID**: `com.recoverycore.app` (must be unique on Play Store)
   - **App name**: `RecoveryCORE`
   - **Signing**: let PWABuilder generate a signing key — **download and keep the .keystore + password safe** (you need the same key for every future Play Store update)
6. Click **Generate** → download the ZIP
7. Inside you get:
   - `app-release-signed.apk` → **share this directly** (WhatsApp, Drive, sideload)
   - `app-release-bundle.aab` → upload to **Google Play Store**
   - `assetlinks.json` → see step 8
8. *(Optional, enables the address-bar-less full-screen app when opened from the APK)*: host the `assetlinks.json` file at
   `https://your-domain/.well-known/assetlinks.json`
   — the Freebuff `public/` folder works: put the file at `public/.well-known/assetlinks.json` and redeploy.

## Option B — Bubblewrap CLI (official Google tool)

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://your-domain/manifest.webmanifest
bubblewrap build
```

- First run installs JDK + Android SDK automatically (accept licenses).
- Output: `app-release-signed.apk` + `app-release-bundle.aab` in the project folder.
- Keep the generated `android.keystore` + passwords — losing them means you can never update the same Play Store listing.

## Installing the APK on a phone (for testing / direct distribution)

1. Copy `app-release-signed.apk` to the phone (Drive/WhatsApp/USB)
2. Tap it → allow "Install unknown apps" for that source → Install
3. RecoveryCORE opens full-screen with your black icon, splash screen and offline support

## Notes

- The APK is a **Trusted Web Activity (TWA)** — it renders your live website in full-screen with zero UI chrome. App updates go live the moment you redeploy the site; no new APK needed (unless you change manifest basics like the app name or icons).
- **iOS users**: open the site in Safari → Share → **Add to Home Screen** (the sidebar button shows this tip on iPhone/iPad). Apple doesn't support APKs/Play Store.
- Play Store publishing needs a one-time **$25 Google developer account**; direct APK sharing is free.
- Your data, auth, GPS tracking and Excel uploads all work identically in the APK — it's the same app.
