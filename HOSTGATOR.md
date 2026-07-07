# Hosting TransSoft Voice on HostGator (Windows)

Your setup: **HostGator Windows shared hosting** (IIS). This hosts the **web app**
(static files). It does **NOT** run the Python backend — that goes on Render (free).

```
Browser  →  Web app on HostGator (https://yourdomain.com)
                     │  API calls
                     ▼
              Backend on Render (https://...onrender.com)
                     │
                     ▼
                 Gemini API
```

---

## Step 1 — Deploy the backend to Render (free)

HostGator can't run FastAPI, so the backend lives on Render. Follow **DEPLOY.md →
Part 1 & 2** (push to GitHub, create a Render Web Service, set `GEMINI_API_KEY`).

You'll end up with a URL like `https://transsoft-voice-api.onrender.com`.
Test it in a browser — it should return `{"status":"ok",...}`.

---

## Step 2 — Point the web app at that backend

Edit `frontend/app.json` → `extra.apiBaseUrl`:

```json
"extra": {
  "apiBaseUrl": "https://transsoft-voice-api.onrender.com",
  "eas": {}
}
```

⚠️ It MUST be `https://` (not http). The web app itself runs on HTTPS, and
browsers block calls from an HTTPS page to an HTTP backend ("mixed content").

---

## Step 3 — Build the static site

```bash
cd ~/transsoft/frontend
nvm use 20
npm run build:web
```

This produces `frontend/web-build/` containing:
- `index.html`
- `_expo/` (JS/CSS assets)
- `web.config`  ← IIS routing rules (already included)

---

## Step 4 — Upload to HostGator

1. Log in to your HostGator **Plesk** (Windows) or the File Manager.
2. Open your domain's document root — usually `httpdocs/` (Plesk) or `wwwroot/`.
3. Upload the **contents** of `web-build/` (not the folder itself) — so that
   `index.html` and `web.config` sit directly in the document root.
   - Easiest: zip `web-build`'s contents, upload the zip, extract in place.
4. Confirm `web.config` is in the same folder as `index.html`.

---

## Step 5 — Enable HTTPS (required for the microphone)

Browsers only allow microphone access over HTTPS.

1. In HostGator Plesk → your domain → **SSL/TLS Certificates**.
2. Install the free **Let's Encrypt** certificate for the domain.
3. Turn on **"Redirect HTTP to HTTPS"** (Plesk → Hosting Settings, or via the
   SSL screen).

Without this, the record button will silently do nothing.

---

## Step 6 — Test

Open `https://yourdomain.com`:
- The dashboard loads.
- Click-and-hold the mic → browser asks for microphone permission → **Allow**.
- Speak a consignment, release → the review form fills in.
- Save → tap a row → bilty preview → **Share / Print PDF** opens the print dialog.

> First recording after the backend has been idle may take ~50s (Render free tier
> cold-start). Just retry once it wakes.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Record button does nothing | Site not on HTTPS | Enable Let's Encrypt (Step 5) |
| "Network request failed" | Wrong/HTTP backend URL | Fix `apiBaseUrl` (Step 2), rebuild, re-upload |
| Refresh gives 404 | `web.config` missing/misplaced | Ensure it's beside `index.html` |
| First request hangs ~50s | Render cold-start | Normal on free tier; retry |
| Mic works locally, not on host | Browser needs HTTPS + permission | Check the padlock + allow mic |

---

## Updating the app later

Re-run `npm run build:web`, then re-upload the new `web-build/` contents,
overwriting the old files. (Backend changes redeploy on Render via a git push.)
