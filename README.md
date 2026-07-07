# TransSoft Voice

A full-stack logistics data-entry app. Dictate a consignment in mixed
Hindi/English, and it's transcribed, structured, fuzzy-matched against a
station/company database, and rendered as a printable bilty (PDF).

```
transsoft/
├── backend/    FastAPI + Gemini 2.5 Flash
└── frontend/   React Native (Expo)
```

## Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export GEMINI_API_KEY=your_key_here     # see .env.example
python main.py                          # serves on http://0.0.0.0:8000
```

Endpoint: `POST /api/voice-entry` — `multipart/form-data` with an `audio` file.
Returns the 8-field JSON schema (types coerced, names fuzzy-matched, payment
type validated).

## Frontend

```bash
cd frontend
npm install
npm start        # then press i / a, or scan the QR with Expo Go
```

Set the backend URL in [`config.js`](frontend/config.js):

- iOS simulator: `http://localhost:8000`
- Android emulator: `http://10.0.2.2:8000`
- Physical device: `http://<your-LAN-ip>:8000`

## How it works

1. **Hold** the mic button to record (`expo-av`, `.m4a`).
2. On **release**, the clip uploads to the backend.
3. Gemini 2.5 Flash listens for anchor labels (`kansigner`, `consignee`,
   `from`, `tak`, `nag`, `vazan`, …) and extracts the value spoken after each.
4. `difflib.get_close_matches` reconciles station/company names against a mock
   database; types are coerced; `payment_type` is validated to one of
   `ToPay` / `Paid` / `FOC` / `ToBeBilled`.
5. The entry is prepended to the list with a colored payment badge.
6. **Tap** any row to generate a professional bilty PDF (`expo-print`) and
   share it (`expo-sharing`).
