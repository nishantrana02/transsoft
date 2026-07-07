import Constants from "expo-constants";

// Backend URL resolution order:
//   1. app.json  -> expo.extra.apiBaseUrl   (used for the hosted / EAS build)
//   2. fallback to localhost for quick local dev
//
// For the global/hosted app, set apiBaseUrl in app.json to your Render URL,
// e.g. "https://transsoft-voice-api.onrender.com".
const fromExtra = Constants.expoConfig?.extra?.apiBaseUrl;

export const API_BASE_URL = fromExtra || "http://localhost:8000";
