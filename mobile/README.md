# Ledger Mobile — Phase 2 (infrastructure proving)

This is not a real app yet. It's one screen that proves the pipeline works:
**Expo project → EAS Build → installed on a physical iPhone → calls the
Phase 1 API → shows the response.** No navigation, no login screen, no
styling beyond legibility.

Everything below this line is a checklist of things only you can do,
since they require your own Expo and Apple accounts and your own phone.

## 1. Prerequisites

- **Expo account** — free. Sign up at https://expo.dev/signup if you don't
  have one.
- **Apple Developer Program membership** — $99/year. Required for
  installing a build on a physical iPhone by any method (ad-hoc or
  TestFlight). Enroll at https://developer.apple.com/programs/ if you
  haven't already. This can take a little while to process if you're
  enrolling for the first time.
- Node.js already installed at the repo root (this project reuses it —
  see step 2).

## 2. Install dependencies

```
cd mobile
npm install
```

This installs only `mobile/`'s own dependencies into `mobile/node_modules`
— it does not touch or depend on the root Next.js app's `node_modules`.

## 3. Get an API token

The test screen needs a token issued by the Phase 1 API. Easiest path:
run the web app locally (`npm run dev` from the repo root) and open
**Settings** in the browser — there's a token-management UI there that
issues one for you. Alternatively, call the endpoint directly:

```
curl -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"your-password","name":"phone test"}'
```

Either way, copy the `token` value — you'll paste it into the app.

## 4. Make your dev server reachable from your phone

Your iPhone can't reach `localhost:3000` on your PC — it needs a URL that
resolves from the phone's network. Two options:

**Option A — ngrok tunnel (recommended, simplest):**
1. `npm run dev` at the repo root (starts the Next.js app on port 3000).
2. In another terminal: `npx ngrok http 3000` (installs on first run if
   you don't have it, or install from https://ngrok.com/download).
3. ngrok prints a URL like `https://abcd-1234.ngrok-free.app` — that's
   your API Base URL. Works over cellular or WiFi, no firewall/LAN setup.

**Option B — LAN IP (fallback, needs same WiFi):**
1. `npm run dev` at the repo root.
2. Find your PC's LAN IP (`ipconfig` → look for IPv4 Address, e.g.
   `192.168.1.42`).
3. Your API Base URL is `http://192.168.1.42:3000`.
4. Make sure Windows Firewall allows inbound connections to port 3000
   (it may prompt you the first time something connects).
5. Your phone must be on the same WiFi network as your PC.
6. The app already requests the iOS "Local Network" permission and
   relaxes App Transport Security for plain HTTP (see
   `app.config.ts` → `ios.infoPlist`) specifically so this option works —
   you'll get a one-time permission prompt on first use.

Option A avoids all of the firewall/LAN/ATS complexity, so start there.

## 5. (Optional, fast iteration) Expo Go

While you're only running the app on your own dev machine's Metro
bundler — not the point of this phase, but useful if you want to eyeball
the screen quickly before doing a real device build — you can install the
free **Expo Go** app from the App Store and run:

```
npx expo start
```

then scan the QR code. This is **not** the deliverable for Phase 2 (Expo
Go doesn't prove the EAS Build pipeline works), just a shortcut for
iterating on the screen itself if you want to.

## 6. The real deliverable: build via EAS and install on your phone

This is the part that actually proves the pipeline.

1. Install the EAS CLI (or just use `npx eas-cli` each time below):
   ```
   npm install -g eas-cli
   ```
2. Log in with your Expo account:
   ```
   eas login
   ```
3. From `mobile/`, link this project to your Expo account:
   ```
   eas build:configure
   ```
   This will ask which platforms — choose iOS — and will write your
   Expo project ID into `app.config.ts` under `extra.eas.projectId`
   (currently `undefined` as a placeholder).
4. Register your iPhone for ad-hoc distribution:
   ```
   eas device:create
   ```
   This gives you a link to open **on your iPhone** — opening it
   installs a small profile that registers your device's UDID with your
   Apple Developer account via Expo. Do this once per device.
5. Run the build:
   ```
   eas build --platform ios --profile development
   ```
   - First time, this will prompt you to log in with your Apple ID and
     will ask permission to manage credentials (certificates,
     provisioning profiles) on your behalf — let EAS handle this
     automatically rather than doing it manually in the Apple Developer
     portal. It's the simplest path for a solo developer.
   - The build runs on Expo's servers (free tier has a monthly build
     quota) and takes several minutes.
6. When it finishes, EAS prints an install link (and shows one on
   https://expo.dev under your project's Builds tab) along with a QR
   code. Open that link **on your iPhone** (e.g. by texting/emailing it
   to yourself, or scanning the QR with the Camera app) and tap Install.
7. The first time you open the installed app, iOS will refuse to run it
   ("Untrusted Developer"). Go to **Settings → General → VPN & Device
   Management**, find your Apple ID/developer profile under "Developer
   App", and tap **Trust**. Then open the app normally.
8. In the app: paste your API Base URL (from step 4) and API token (from
   step 3) into the two fields, tap **Fetch Dashboard**, and confirm you
   see a `HTTP 200` response with real JSON from your Ledger data. That's
   the whole milestone.

### Why ad-hoc/internal distribution instead of TestFlight

Ad-hoc (what `distribution: "internal"` + `eas device:create` gets you)
needs no App Store Connect app record and no Apple review/processing
wait — just your device's UDID registered, which `eas device:create`
does interactively. That's the fastest path to "does the pipeline work"
for a single developer testing on their own phone.

TestFlight is a reasonable next step later if you want to test on
multiple devices without registering each UDID, or share a build with
someone else — it requires creating an App Store Connect record for the
app and waiting for Apple's (usually short, but not instant) build
processing before it's installable. Not needed for this phase.

## What you don't need to do

- No CORS changes were needed on the Next.js side. CORS is a *browser*
  enforcement mechanism — React Native's `fetch()` on a physical device
  isn't a browser and isn't subject to it. (The one exception would be
  running `expo start --web`, which this phase doesn't use.)
- No changes to the existing Next.js app's structure, dependencies, or
  routes were required for this milestone.

## Bundle identifier

`app.config.ts` currently uses `com.ebundw.ledgermobile` as a
placeholder `ios.bundleIdentifier`/`android.package`. If `eas
build:configure` or Apple's system reports it's already taken by a
different Apple Developer account, just change it to something else
under your control (e.g. swap in your own domain reversed, or add a
suffix) — it has no other significance.
