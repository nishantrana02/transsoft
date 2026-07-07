"""SQLite storage for TransSoft Voice reference lists.

Three independent lists — consignors, consignees, places — used both for the
in-app database screen and for fuzzy-matching voice-extracted values. Stored in
a single SQLite file so data survives restarts with zero external services.
"""

import os
import sqlite3
from threading import Lock

DB_PATH = os.path.join(os.path.dirname(__file__), "transsoft.db")

# The three reference lists this app manages. Keys are the API "kind".
KINDS = ("consignors", "consignees", "places")

# Seed data used only on first run (when a table is empty).
SEED = {
    "consignors": [
        "Reliance Industries", "Tata Steel", "Adani Logistics", "Mahindra Group",
        "Bajaj Auto", "Hero MotoCorp", "Larsen & Toubro", "Ashok Leyland",
        "JSW Steel", "Vedanta Limited", "Godrej Industries", "ITC Limited",
        "Hindustan Unilever", "Asian Paints", "UltraTech Cement",
        "Wipro Enterprises", "Infosys Logistics", "Maruti Suzuki",
        "Bharat Forge", "Apollo Tyres",
    ],
    "consignees": [
        "Reliance Industries", "Tata Steel", "Adani Logistics", "Mahindra Group",
        "Bajaj Auto", "Hero MotoCorp", "Larsen & Toubro", "Ashok Leyland",
        "JSW Steel", "Vedanta Limited", "Godrej Industries", "ITC Limited",
        "Hindustan Unilever", "Asian Paints", "UltraTech Cement",
        "Wipro Enterprises", "Infosys Logistics", "Maruti Suzuki",
        "Bharat Forge", "Apollo Tyres",
    ],
    "places": [
        "Mumbai", "Delhi", "Bangalore", "Chennai", "Kolkata", "Hyderabad",
        "Pune", "Ahmedabad", "Surat", "Jaipur", "Lucknow", "Kanpur", "Nagpur",
        "Indore", "Bhopal", "Ludhiana", "Agra", "Nashik", "Vadodara", "Rajkot",
        "Coimbatore", "Vijayawada", "Guwahati", "Ranchi", "Raipur", "Amritsar",
    ],
}

_lock = Lock()


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create tables if missing and seed any that are empty."""
    with _lock, _connect() as conn:
        for kind in KINDS:
            conn.execute(
                f"""CREATE TABLE IF NOT EXISTS {kind} (
                        id   INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL UNIQUE COLLATE NOCASE
                    )"""
            )
        conn.commit()
        for kind in KINDS:
            count = conn.execute(f"SELECT COUNT(*) AS n FROM {kind}").fetchone()["n"]
            if count == 0:
                conn.executemany(
                    f"INSERT OR IGNORE INTO {kind} (name) VALUES (?)",
                    [(name,) for name in SEED[kind]],
                )
        conn.commit()


def _validate_kind(kind: str) -> None:
    if kind not in KINDS:
        raise ValueError(f"Unknown list '{kind}'. Expected one of {KINDS}.")


def list_names(kind: str) -> list[str]:
    """Return all names for a kind, alphabetically."""
    _validate_kind(kind)
    with _lock, _connect() as conn:
        rows = conn.execute(
            f"SELECT name FROM {kind} ORDER BY name COLLATE NOCASE"
        ).fetchall()
    return [r["name"] for r in rows]


def add_name(kind: str, name: str) -> tuple[bool, str]:
    """Add a name. Returns (created, cleaned_name). created=False if duplicate."""
    _validate_kind(kind)
    cleaned = (name or "").strip()
    if not cleaned:
        raise ValueError("Name cannot be empty.")
    with _lock, _connect() as conn:
        try:
            conn.execute(f"INSERT INTO {kind} (name) VALUES (?)", (cleaned,))
            conn.commit()
            return True, cleaned
        except sqlite3.IntegrityError:
            # Already exists (case-insensitive). Return the stored spelling.
            row = conn.execute(
                f"SELECT name FROM {kind} WHERE name = ? COLLATE NOCASE", (cleaned,)
            ).fetchone()
            return False, (row["name"] if row else cleaned)


def delete_name(kind: str, name: str) -> bool:
    """Delete a name (case-insensitive). Returns True if a row was removed."""
    _validate_kind(kind)
    cleaned = (name or "").strip()
    if not cleaned:
        raise ValueError("Name cannot be empty.")
    with _lock, _connect() as conn:
        cur = conn.execute(
            f"DELETE FROM {kind} WHERE name = ? COLLATE NOCASE", (cleaned,)
        )
        conn.commit()
        return cur.rowcount > 0
