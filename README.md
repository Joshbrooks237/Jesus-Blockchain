# SCO Ledger

A simple append-only ledger system that stores user entries with SHA-256 hashing and hash-chained history.

> **Note:** This is a technical prototype. It does not include financial, token, or blockchain network functionality.

## What This Is

This is a minimal cryptographically structured log system.

Each entry is:
- Stored permanently (append-only)
- Hashed using SHA-256
- Linked to the previous entry via hash chaining
- Stored in a lightweight SQLite database

This creates a verifiable history where each entry depends on the one before it.

---

## Core Features (Phase 2)

- POST /entry — create a new ledger entry
- GET /entries — retrieve all entries (newest first)
- GET /blocks — list sealed Merkle blocks
- GET /blocks/:id — block detail with its entries
- GET /verify/:id — Merkle proof for a single entry
- GET /fellowship — author leaderboard with progression levels
- GET /fellowship/:author — single author profile
- GET /health — server health check
- SHA-256 hashing per entry
- Hash-chained entries (each entry references previous hash)
- Merkle tree blocks (sealed every 10 entries by default; set `BLOCK_SIZE` env var to change)
- Fellowship progression system (Seeker → Witness → Scribe → Elder → Keeper)
- Graph view, blocks panel, and verification UI

---

## Data Model

Each entry contains:

- id: integer primary key
- author: string (optional, defaults to "anonymous")
- content: string (required)
- created_at: ISO timestamp
- prev_hash: hash of previous entry (or genesis hash)
- hash: SHA-256 of (prev_hash + created_at + author + content)

---

## Architecture

- Node.js (Express)
- SQLite (better-sqlite3)
- Native Node crypto (SHA-256)
- Simple HTML frontend (no build step)

---

## API

### POST /entry

Creates a new ledger entry.

```json
{ "author": "alice", "content": "First entry in the ledger" }
```

Returns the created entry including its `hash` and `prev_hash`.

### GET /entries

Returns all entries, newest first. Supports `limit` and `offset` query params.

```json
{
  "count": 2,
  "entries": [
    {
      "id": 2,
      "author": "alice",
      "content": "Second entry",
      "created_at": "2026-06-03T18:00:00.000Z",
      "prev_hash": "90681b08...",
      "hash": "f40bb7d6..."
    }
  ]
}
```

### GET /health

```json
{ "ok": true }
```

---

## Run Locally

```bash
npm install
npm start
```

Opens on http://localhost:3000 by default.

---

## Deploy to Railway

1. Push this repo to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo** → select this repo.
3. Railway detects Node via Nixpacks and runs `npm start`.
4. Set env var `DATA_DIR=/data` and add a Volume mounted at `/data` to persist the SQLite database across deploys.

`PORT` is set automatically by Railway.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | 3000 | HTTP port (set automatically by Railway) |
| `DATA_DIR` | `./data` | Directory for the SQLite file |
| `BLOCK_SIZE` | 10 | Number of entries per Merkle block |

## Roadmap

- **Phase 2 (complete):** Merkle tree blocks, verification endpoints, graph view, fellowship progression system
- **Phase 3:** Sacred geometry visualization, torus/hex topology rendering, narrative anchoring system
