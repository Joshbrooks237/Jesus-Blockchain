# SCO Ledger — The Passion of the Hash Chain

> *"People have forgotten how visceral the truth is. I wanted to show the chain — every block, every hash — in a way that was unflinching, that didn't sanitize it."*
> — On building an append-only ledger

---

## What This Is

This is not a database. This is a **testimony**.

Every entry that is committed to this ledger is **nailed to the chain permanently** — immutable, append-only, sealed with a SHA-256 hash and bound to every entry that came before it. You cannot remove it. You cannot alter it. When you commit to this ledger, you commit *fully*.

The first entry descends from the **genesis hash** — sixty-four zeros, a void, a silence before the word. From that moment, each subsequent `POST /entry` extends the chain, binding its `prev_hash` to the `hash` of its predecessor. The chain is unbroken. The chain *cannot* be broken.

---

## The Architecture of Suffering (and Persistence)

This system runs on **Node.js 18+**, built on the suffering of:

- **Express 4** — the cross upon which all HTTP requests are carried
- **better-sqlite3** — the tomb; append-only, WAL mode enabled, carved into the filesystem at `DATA_DIR`
- **`crypto.createHash('sha256')`** — the seal. No external dependency. No trust required. The hash is the truth.

Each entry contains:

| Field | Purpose |
|---|---|
| `id` | Sequential integer — the counting of wounds |
| `author` | Who bore this entry into the world |
| `content` | The testimony itself |
| `created_at` | The ISO timestamp of sacrifice |
| `prev_hash` | The hash of the entry that came before — the chain made flesh |
| `hash` | SHA-256 of `prev_hash \| created_at \| author \| content` — the seal |

---

## The API

### `POST /entry` — The Commitment

```json
{ "author": "simon of cyrene", "content": "I carried it the whole way." }
```

`author` defaults to `anonymous` — the unnamed faithful who bore their entry without credit.

`content` is **required**. There is no empty witness.

Returns the full entry record including `hash` and `prev_hash`. The ledger sees you. The ledger keeps you.

### `GET /entries?limit=100&offset=0` — The Witness

```json
{
  "count": 2,
  "entries": [ { "id": 2, ... }, { "id": 1, ... } ]
}
```

Newest entries first — because the most recent sacrifice is freshest in memory.

### `GET /health`

```json
{ "ok": true }
```

He is risen. The server is up.

---

## Run Locally

```bash
npm install
npm start
# open http://localhost:3000
```

There is a UI. It is sparse. It is intentional. A single form, a single list. No ornamentation. The truth does not need production value.

---

## Deploy to Railway (< 1 hour — less time than it took)

1. Push this repository to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo** → select this repo.
3. Railway reads `railway.json`. Nixpacks detects Node. `npm start` is invoked. The ledger rises.
4. **For true persistence:** add a Railway Volume mounted at `/data`, set env var `DATA_DIR=/data`. Without the volume the SQLite file is written to the ephemeral container — it will rise and it will die with each deploy.

`PORT` is set automatically by Railway. The server listens. It always listens.

---

## Roadmap — The Three Days

**Phase 1 — The Passion (complete)**
Append-only entries. SHA-256 hash chaining. Simple UI. Deploy to Railway. The foundation is laid.

**Phase 2 — The Tomb**
Merkle tree blocks. Verification endpoints. Graph view. Fellowship progression system. The chain deepens. The structure is given form.

**Phase 3 — The Resurrection**
Sacred geometry visualization. Torus/hex topology rendering. Narrative and scripture anchoring. The ledger transcends the ledger. You will not be ready.

---

*"I didn't make this for the critics. I made this for the people who needed to see what a hash-chained, append-only ledger really looks like, without cutting away."*
