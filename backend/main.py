"""TransSoft Voice — FastAPI backend.

Accepts a voice recording describing a logistics consignment (spoken in mixed
Hindi/English), transcribes and extracts structured fields via Gemini 2.5 Flash,
then fuzzy-matches station and company names against a mock database before
returning clean JSON.
"""

import json
import os
from difflib import get_close_matches
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel, field_validator

import db

load_dotenv()

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
MODEL_NAME = "gemini-2.5-flash"

# Fuzzy-match cutoff (0..1). Below this we keep the raw LLM value.
FUZZY_CUTOFF = 0.6

# The consignor / consignee / place reference lists now live in SQLite (db.py)
# and are read at request time so newly-added values improve matching instantly.

PAYMENT_TYPES = {"ToPay", "Paid", "FOC", "ToBeBilled"}

SYSTEM_PROMPT = """You are a data-extraction engine for an Indian logistics \
(transport / "bilty") company. You will receive an audio clip in which an \
operator dictates the details of a single consignment in mixed Hindi and \
English (Hinglish).

Your job: listen for ANCHOR LABELS and extract ONLY the value spoken \
immediately AFTER each label. Do not guess or hallucinate. If a value is not \
spoken, use an empty string for text fields, 0 for pkg_no, and 0.0 for weight.

ANCHOR LABELS (a label may be spoken in any of these variants):
- consignor_name  -> "consignor", "kansigner", "kansignor", "sender", "bhejne wala", "from party"
- consignee_name  -> "consignee", "kansinee", "receiver", "lene wala", "to party", "party"
- from_station    -> "from", "se", "origin", "booking station"
- to_station      -> "to", "tak", "ko", "destination", "delivery station"
- pkg_no          -> "nag", "package", "packages", "quantity", "pieces", "number of packages"
- pkg_type        -> "type", "packing", "carton", "bag", "bora", "box", "bundle", "loose"
- weight          -> "vazan", "wazan", "weight", "kg", "kilo", "tol"
- payment_type    -> "payment", "bhugtan", "topay", "to pay", "paid", "foc", "to be billed"

RULES:
1. Extract the value that comes AFTER the anchor label, not before.
2. pkg_no must be an integer. weight must be a number (float).
3. payment_type must be EXACTLY one of: "ToPay", "Paid", "FOC", "ToBeBilled".
   Map spoken forms: "to pay"/"topay" -> "ToPay"; "paid"/"cash" -> "Paid";
   "free"/"foc" -> "FOC"; "to be billed"/"credit"/"billing" -> "ToBeBilled".
   If unclear, default to "ToPay".
4. Return ONLY raw JSON. No markdown, no code fences, no commentary.

Output JSON with EXACTLY these keys:
{"consignor_name": str, "consignee_name": str, "from_station": str, \
"to_station": str, "pkg_no": int, "pkg_type": str, "weight": float, \
"payment_type": str}
"""

# --------------------------------------------------------------------------- #
# App setup
# --------------------------------------------------------------------------- #

app = FastAPI(title="TransSoft Voice API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    db.init_db()

_client: Optional[genai.Client] = None


def get_client() -> genai.Client:
    """Lazily create the Gemini client so the app can boot without a key."""
    global _client
    if _client is None:
        if not GEMINI_API_KEY:
            raise HTTPException(
                status_code=500,
                detail="GEMINI_API_KEY environment variable is not set.",
            )
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


# --------------------------------------------------------------------------- #
# Response model
# --------------------------------------------------------------------------- #

class VoiceEntry(BaseModel):
    consignor_name: str = ""
    consignee_name: str = ""
    from_station: str = ""
    to_station: str = ""
    pkg_no: int = 0
    pkg_type: str = ""
    weight: float = 0.0
    payment_type: str = "ToPay"

    @field_validator("payment_type")
    @classmethod
    def validate_payment(cls, v: str) -> str:
        return v if v in PAYMENT_TYPES else "ToPay"


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def _coerce_int(value) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def _coerce_float(value) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def fuzzy_match(value: str, choices: list[str]) -> str:
    """Return the closest known value, or the original if nothing is close."""
    if not value or not value.strip():
        return value
    matches = get_close_matches(value.strip(), choices, n=1, cutoff=FUZZY_CUTOFF)
    return matches[0] if matches else value.strip()


def parse_llm_json(raw: str) -> dict:
    """Parse model output, tolerating stray markdown fences if present."""
    text = raw.strip()
    if text.startswith("```"):
        # Strip ```json ... ``` fencing defensively.
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Last resort: locate the first {...} block.
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(text[start : end + 1])
        raise


def post_process(data: dict) -> VoiceEntry:
    """Coerce types and reconcile names against the SQLite reference lists."""
    consignors = db.list_names("consignors")
    consignees = db.list_names("consignees")
    places = db.list_names("places")
    entry = VoiceEntry(
        consignor_name=fuzzy_match(str(data.get("consignor_name", "")), consignors),
        consignee_name=fuzzy_match(str(data.get("consignee_name", "")), consignees),
        from_station=fuzzy_match(str(data.get("from_station", "")), places),
        to_station=fuzzy_match(str(data.get("to_station", "")), places),
        pkg_no=_coerce_int(data.get("pkg_no", 0)),
        pkg_type=str(data.get("pkg_type", "")).strip(),
        weight=_coerce_float(data.get("weight", 0.0)),
        payment_type=str(data.get("payment_type", "ToPay")).strip(),
    )
    return entry


# --------------------------------------------------------------------------- #
# Routes
# --------------------------------------------------------------------------- #

@app.get("/")
def health():
    return {"status": "ok", "service": "TransSoft Voice API"}


class NameIn(BaseModel):
    name: str


@app.get("/api/db/{kind}")
def db_list(kind: str):
    """List all names for a reference list (consignors / consignees / places)."""
    try:
        return {"kind": kind, "items": db.list_names(kind)}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.post("/api/db/{kind}")
def db_add(kind: str, payload: NameIn):
    """Add a new name to a reference list. Idempotent on duplicates."""
    try:
        created, name = db.add_name(kind, payload.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"kind": kind, "name": name, "created": created, "items": db.list_names(kind)}


@app.delete("/api/db/{kind}")
def db_delete(kind: str, payload: NameIn):
    """Delete a name from a reference list."""
    try:
        removed = db.delete_name(kind, payload.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not removed:
        raise HTTPException(status_code=404, detail=f"'{payload.name}' not found.")
    return {"kind": kind, "name": payload.name, "removed": True, "items": db.list_names(kind)}


@app.post("/api/voice-entry", response_model=VoiceEntry)
async def voice_entry(audio: UploadFile = File(...)):
    """Accept an audio file, extract logistics fields, return clean JSON."""
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio upload.")

    mime_type = audio.content_type or "audio/m4a"
    client = get_client()

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=[
                SYSTEM_PROMPT,
                types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
            ],
            config=types.GenerateContentConfig(
                temperature=0.1,
                response_mime_type="application/json",
            ),
        )
    except Exception as exc:  # noqa: BLE001 — surface upstream errors cleanly
        raise HTTPException(status_code=502, detail=f"Gemini request failed: {exc}")

    raw = (response.text or "").strip()
    if not raw:
        raise HTTPException(status_code=502, detail="Empty response from model.")

    try:
        data = parse_llm_json(raw)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=502,
            detail=f"Could not parse model output as JSON: {raw[:200]}",
        )

    return post_process(data)


if __name__ == "__main__":
    import uvicorn

    # Honor the platform-provided $PORT (Render, Railway, etc.); default to 8000
    # for local dev. reload is off in hosted envs to avoid double workers.
    port = int(os.environ.get("PORT", "8000"))
    reload = os.environ.get("ENV", "dev") == "dev"
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=reload)
