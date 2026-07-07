# Deploying TransSoft Voice (free, global Expo link)

Two pieces go online:
1. **Backend** → Render (free) → public HTTPS URL
2. **App** → EAS Update (free) → global `expo.dev/@you/...` link that opens in Expo Go

You need three free accounts: **GitHub**, **Render**, **Expo**.

---

## Part 1 — Push code to GitHub

From the project root (`~/transsoft`):

```bash
cd ~/transsoft
git init
git add .
git commit -m "TransSoft Voice"
```

Create an empty repo at https://github.com/new (name it `transsoft`), then:

```bash
git remote add origin https://github.com/<your-username>/transsoft.git
git branch -M main
git push -u origin main
```

> `.env` and `*.db` are gitignored — your API key is NOT pushed. Good.

---

## Part 2 — Deploy the backend to Render

1. Go to https://dashboard.render.com → **New → Web Service**.
2. Connect your GitHub, pick the `transsoft` repo.
3. Render auto-detects `backend/render.yaml`. Confirm these (already set in the file):
   - Root directory: `backend`
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Plan: **Free**
4. Under **Environment**, add:
   - `GEMINI_API_KEY` = your key (the one in `backend/.env`)
5. **Create Web Service**. Wait ~3 min for the first build.
6. You get a URL like `https://transsoft-voice-api.onrender.com`.
7. Test it in a browser: opening that URL should show
   `{"status":"ok","service":"TransSoft Voice API"}`.

> ⚠️ Free tier sleeps after 15 min idle — the FIRST request after sleep takes
> ~50 seconds to wake up. And `transsoft.db` resets on each redeploy (expected).

---

## Part 3 — Point the app at the hosted backend

Edit `frontend/app.json` → set `extra.apiBaseUrl` to your Render URL:

```json
"extra": {
  "apiBaseUrl": "https://transsoft-voice-api.onrender.com",
  "eas": {}
}
```

(No trailing slash.)

---

## Part 4 — Publish the global Expo link

```bash
cd ~/transsoft/frontend
nvm use 20

# one-time: log in / create an Expo account
npx expo login          # or: npx expo register

# one-time: link this project to your Expo account (writes owner + projectId)
npx eas update:configure

# publish the JS bundle to Expo's cloud
npx eas update --branch production --message "first release"
```

The last command prints a **QR code and a URL** like:

```
https://expo.dev/@<your-username>/transsoft-voice
```

Anyone with **Expo Go** installed opens that link (or scans the QR) and the app
loads — your computer can be off. Re-run `eas update` any time to push changes.

---

## Recap of what's already configured for you

- `backend/render.yaml` — Render blueprint (port, build, start, env).
- `backend/main.py` — honors `$PORT` / `ENV` for hosted runtimes.
- `frontend/config.js` — reads the backend URL from `app.json` → `extra.apiBaseUrl`.
- `frontend/eas.json` — EAS Update channel + a `preview` profile for building an
  APK later if you ever need one.
- `frontend/app.json` — `runtimeVersion` + `extra` block for EAS Update.

## If you later need a real APK (not Expo Go)

Only needed if you add a native module Expo Go doesn't ship. Your current stack
(expo-audio, expo-print, expo-sharing, react-native-webview) is all supported by
Expo Go, so you do NOT need this yet.

```bash
npx eas build --profile preview --platform android
```

Produces a downloadable `.apk` on Expo's free build tier.

---

# Web app (runs in a browser, host on Plesk)

The same codebase also builds to a **static website**. Recording uses the browser
MediaRecorder API, the bilty preview renders in an iframe, and printing uses the
browser print dialog (Save as PDF). Platform-specific files handle the
differences automatically:

- `recorder.web.js` / `recorder.native.js`
- `BiltyView.web.js` / `BiltyView.native.js`
- `printBilty.web.js` / `printBilty.native.js`

## Build the static site

First point it at your hosted backend (same as the mobile app):
`frontend/app.json` → `extra.apiBaseUrl` = your backend HTTPS URL.

```bash
cd ~/transsoft/frontend
nvm use 20
npm run build:web        # outputs to frontend/web-build/
```

`web-build/` now contains `index.html` + static assets — a complete site.

## Deploy to Plesk

1. In Plesk, create (or pick) a domain/subdomain, e.g. `voice.yourdomain.com`.
2. Enable **Let's Encrypt** SSL for it (Plesk → SSL/TLS Certificates) — HTTPS is
   required for microphone access in browsers.
3. Upload the **contents** of `frontend/web-build/` into the domain's document
   root (`httpdocs/`) — via Plesk File Manager or SFTP.
4. Because it's a single-page app, add a fallback so refreshes work. In Plesk →
   the domain → **Apache & nginx Settings** → *Additional nginx directives*:
   ```nginx
   location / {
     try_files $uri $uri/ /index.html;
   }
   ```
5. Visit `https://voice.yourdomain.com` — the app loads in the browser.

## ⚠️ Browser requirements

- **HTTPS is mandatory** for the microphone (`getUserMedia`). Over plain HTTP the
  record button will fail. Plesk's free Let's Encrypt covers this.
- The **backend must send permissive CORS** (it already does: `allow_origins=["*"]`).
- If the backend is on a different domain, that's fine — CORS is already open.

## Same server, both apps

You can host everything on the one Plesk box:
- `voice.yourdomain.com` → the web app (static `web-build/`)
- `api.yourdomain.com`   → the FastAPI backend (Python app or Docker)
