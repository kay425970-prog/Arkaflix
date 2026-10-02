# Shipping a real `.exe` and `.apk`

This is the missing manual for getting Arkaflix onto people's devices as an
installed app. There is no way for the web build to emit these binaries itself —
an APK needs the Android SDK and a signing key, and a Windows EXE needs a
packager that only runs on Windows. So the answer is automation: let GitHub
build them for you, for free, every time you tag a version.

**The short version:** push a git tag → GitHub Actions builds both installers →
anyone downloads them from your repo's Releases page.

Your account is already wired into the config:

| Where | Value |
|---|---|
| GitHub user | `kay425970-prog` |
| Repository | `arkaflix` *(rename it and change `REPO` in `src/release.ts`)* |
| Repo URL | <https://github.com/kay425970-prog/arkaflix> |
| Releases page | <https://github.com/kay425970-prog/arkaflix/releases> |
| Pages URL (assumed) | <https://kay425970-prog.github.io/arkaflix/> |

---

## Quick start — copy these in order

```bash
# 1. Create the empty repo on github.com first (no README), then:
git remote add origin https://github.com/kay425970-prog/arkaflix.git
git push -u origin main

# 2. Turn on GitHub Pages: Settings → Pages → Source: "GitHub Actions"

# 3. Make your Android signing key (one time — back this file up forever)
keytool -genkeypair -v -keystore arkaflix.keystore -alias arkaflix \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 arkaflix.keystore > ks.txt      # Windows: certutil -encode arkaflix.keystore ks.txt

# 4. Add the secrets (see §2), then ship:
git tag v1.0.0
git push origin v1.0.0
```

Your installers appear at
**<https://github.com/kay425970-prog/arkaflix/releases/latest>**

---

## 0. Prerequisites

1. **Deploy the site to a public HTTPS domain.**
   The Android app is a *Trusted Web Activity* — a thin native shell around your
   live site. It genuinely needs your real URL, so this comes first. Vercel,
   Netlify, Cloudflare Pages and GitHub Pages all work and are free.

2. **Push this repo to GitHub** and enable Actions.

---

## 1. Make a signing key (Android)

A keystore is the private key that proves updates come from you. Keep it safe —
if you lose it, you can never ship an update to people who installed v1.

```bash
keytool -genkeypair -v -keystore arkaflix.keystore -alias arkaflix \
  -keyalg RSA -keysize 2048 -validity 10000
```

`keytool` ships with the JDK. Then base64 the file so it can live in a secret:

```bash
base64 -w0 arkaflix.keystore          # Linux / macOS
certutil -encode arkaflix.keystore ks.txt   # Windows — copy the body
```

## 2. Add your secrets

In **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the base64 string from step 1 |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | `arkaflix` |
| `ANDROID_KEY_PASSWORD` | key password |
| `WIN_CSC_LINK` *(optional)* | base64 Windows code-signing certificate |
| `WIN_CSC_KEY_PASSWORD` *(optional)* | its password |

## 3. Point the workflow at your domain

It's already set for your Pages URL, so skip this if you use GitHub Pages with a
repo named `arkaflix`:

```yaml
# .github/workflows/release.yml
env:
  APK_MANIFEST: https://kay425970-prog.github.io/arkaflix/manifest.webmanifest
```

### ⚠️ GitHub Pages needs one Vite change

Pages serves your site from a subfolder (`/arkaflix/`), but Vite writes absolute
paths (`/icon-512.png`) by default, which would 404 the icon and manifest.
**`vite.config.ts` is the one file I never edit myself**, so open it and add:

```ts
export default defineConfig({
  base: "./",        // ← makes every asset path relative
  plugins: [/* existing plugins */],
});
```

Then rebuild. `manifest.webmanifest`, `sw.js` and `icon-512.png` are all
referenced relatively already, so this single line is the whole fix.

Deploying to Vercel or Netlify instead? Skip this — they serve from the domain
root, and `APK_MANIFEST` should become
`https://your-app.vercel.app/manifest.webmanifest`.

## 4. Add the electron-builder config to `package.json`

The Windows job reads this block. Add it at the top level (this is the one part
that must go in `package.json` — I deliberately never edit that file myself):

```json
{
  "main": "electron/main.cjs",
  "build": {
    "appId": "app.arkaflix",
    "productName": "Arkaflix",
    "directories": { "output": "release" },
    "files": ["dist/**/*", "electron/**/*", "package.json"],
    "win": { "target": ["nsis"], "icon": "public/icon-512.png" },
    "publish": [{ "provider": "github" }]
  }
}
```

## 5. Build and publish

```bash
git tag v1.0.0
git push origin v1.0.0
```

About twenty minutes later, your repo's **Releases** page holds:

- `Arkaflix Setup <version>.exe` — the Windows installer
- `app-release-signed.apk` — installs on any Android phone
- `app-release-bundle.aab` — the Play Store upload format

## 6. Tell the app where the files are

**Already done.** `src/release.ts` now points at your Releases page, and the
download URLs are built from it:

```ts
export const GITHUB_USER = "kay425970-prog";
export const REPO = "arkaflix";              // ← change this if you rename the repo
```

The Downloads page HEAD-requests those addresses on load and lights the buttons
up only when the files really exist. So after your first tag push, reload the
site and "Download for Android" / "Download for Windows" will simply work —
no config edit needed. The `latest/download/…` form always serves the newest
release, so you never have to bump version numbers in the app.

---

## 7. Getting the APK into Play *(optional)*

`bubblewrap play publish` uploads the `.aab`, or drag it into the Play Console.
Google requires a **fresh app**, an AAB rather than an APK, a privacy policy
URL, and screenshots. First publish takes a few days to review.

To prove to Google that the app owns your domain (which removes the browser URL
bar and gives a true fullscreen app), serve this file at
`https://your-domain.com/.well-known/assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "app.arkaflix",
    "sha256_cert_fingerprints": ["YOUR:SHA256:FINGERPRINT"]
  }
}]
```

Get the fingerprint with `bubblewrap fingerprint list`. Without this the app
still installs and runs — it just shows Chrome's address bar.

---

## Honest limits

- **SmartScreen.** An unsigned EXE installs fine but Windows warns "unknown
  publisher". Making that go away properly needs an EV code-signing certificate
  (roughly US$250–400/year, plus identity verification). There is no free way
  around it; the warning is the point.
- **macOS.** A DMG needs to be *notarised* by Apple, which needs an Apple
  Developer account at US$99/year and can only be done on a Mac. I left it out
  rather than ship something that gets quarantined on install. The installable
  web app covers Mac users today.
- **One machine, one platform.** Signed Windows and macOS builds can only be
  produced on their own OS. That's why the workflow uses a matrix of runners —
  it's the whole reason CI is worth it here.
- **The APK is a wrapper, not a port.** It opens your live site in a native
  window with no browser chrome. That's why it's a ~2 MB download instead of
  ~150 MB, and why it needs the site online. For a fully offline native app
  you'd want Capacitor, which bundles the front-end and adds real native
  storage — a meaningfully bigger job.
