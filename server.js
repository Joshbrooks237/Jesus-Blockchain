"use strict";

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const db = require("./db");
const { buildTree, getProof, verifyProof } = require("./merkle");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const GENESIS_HASH = "0".repeat(64);
const BLOCK_SIZE = parseInt(process.env.BLOCK_SIZE, 10) || 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function hashEntry({ author, content, created_at, prev_hash }) {
  return sha256(`${prev_hash}|${created_at}|${author}|${content}`);
}

// Fellowship levels based on total entry count per author.
const LEVELS = [
  { min: 0,   title: "Seeker",    badge: "○" },
  { min: 5,   title: "Witness",   badge: "◎" },
  { min: 20,  title: "Scribe",    badge: "◉" },
  { min: 50,  title: "Elder",     badge: "⬡" },
  { min: 100, title: "Keeper",    badge: "✦" },
];

function getLevel(count) {
  let level = LEVELS[0];
  for (const l of LEVELS) {
    if (count >= l.min) level = l;
  }
  return level;
}

// ---------------------------------------------------------------------------
// Prepared statements
// ---------------------------------------------------------------------------

const getLastEntry     = db.prepare("SELECT hash FROM entries ORDER BY id DESC LIMIT 1");
const insertEntry      = db.prepare(`
  INSERT INTO entries (author, content, created_at, prev_hash, hash)
  VALUES (@author, @content, @created_at, @prev_hash, @hash)
`);
const setEntryBlock    = db.prepare("UPDATE entries SET block_id = ? WHERE id = ?");
const getEntryById     = db.prepare("SELECT * FROM entries WHERE id = ?");
const listEntries      = db.prepare("SELECT * FROM entries ORDER BY id DESC LIMIT ? OFFSET ?");
const countUnblocked   = db.prepare("SELECT COUNT(*) AS n FROM entries WHERE block_id IS NULL");
const getUnblocked     = db.prepare("SELECT * FROM entries WHERE block_id IS NULL ORDER BY id ASC");
const insertBlock      = db.prepare(`
  INSERT INTO blocks (merkle_root, entry_count, first_entry, last_entry, created_at)
  VALUES (@merkle_root, @entry_count, @first_entry, @last_entry, @created_at)
`);
const getBlockById     = db.prepare("SELECT * FROM blocks WHERE id = ?");
const listBlocks       = db.prepare("SELECT * FROM blocks ORDER BY id DESC LIMIT ? OFFSET ?");
const getEntriesByBlock = db.prepare("SELECT * FROM entries WHERE block_id = ? ORDER BY id ASC");

const getAuthorStats   = db.prepare(`
  SELECT author, COUNT(*) AS entry_count, MIN(created_at) AS first_seen, MAX(created_at) AS last_seen
  FROM entries GROUP BY author ORDER BY entry_count DESC LIMIT ? OFFSET ?
`);
const getOneAuthorStats = db.prepare(`
  SELECT author, COUNT(*) AS entry_count, MIN(created_at) AS first_seen, MAX(created_at) AS last_seen
  FROM entries WHERE author = ?
`);

// ---------------------------------------------------------------------------
// Block sealing (called after every new entry if threshold is met)
// ---------------------------------------------------------------------------

function maybeSealBlock() {
  const { n } = countUnblocked.get();
  if (n < BLOCK_SIZE) return null;

  const pending = getUnblocked.all();
  const hashes = pending.map((e) => e.hash);
  const { root } = buildTree(hashes);

  const blockInfo = {
    merkle_root: root,
    entry_count: pending.length,
    first_entry: pending[0].id,
    last_entry: pending[pending.length - 1].id,
    created_at: new Date().toISOString(),
  };

  const sealBlock = db.transaction(() => {
    const info = insertBlock.run(blockInfo);
    const blockId = info.lastInsertRowid;
    for (const e of pending) setEntryBlock.run(blockId, e.id);
    return blockId;
  });

  const blockId = sealBlock();
  return getBlockById.get(blockId);
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get("/health", (_req, res) => res.json({ ok: true }));

// POST /entry
app.post("/entry", (req, res) => {
  const { author, content } = req.body || {};

  if (typeof content !== "string" || content.trim() === "") {
    return res.status(400).json({ error: "content is required" });
  }

  const cleanAuthor = typeof author === "string" && author.trim() ? author.trim() : "anonymous";
  const created_at = new Date().toISOString();
  const last = getLastEntry.get();
  const prev_hash = last ? last.hash : GENESIS_HASH;

  const record = { author: cleanAuthor, content: content.trim(), created_at, prev_hash };
  record.hash = hashEntry(record);

  const info = insertEntry.run(record);
  const created = getEntryById.get(info.lastInsertRowid);
  const newBlock = maybeSealBlock();

  res.status(201).json({ entry: created, block_sealed: newBlock || null });
});

// GET /entries
app.get("/entries", (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit, 10)  || 100, 500);
  const offset = parseInt(req.query.offset, 10) || 0;
  const entries = listEntries.all(limit, offset);
  res.json({ count: entries.length, entries });
});

// GET /blocks
app.get("/blocks", (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit, 10)  || 50, 200);
  const offset = parseInt(req.query.offset, 10) || 0;
  const blocks = listBlocks.all(limit, offset);
  res.json({ count: blocks.length, blocks });
});

// GET /blocks/:id — block detail with its entries
app.get("/blocks/:id", (req, res) => {
  const block = getBlockById.get(parseInt(req.params.id, 10));
  if (!block) return res.status(404).json({ error: "block not found" });
  const entries = getEntriesByBlock.all(block.id);
  res.json({ block, entries });
});

// GET /verify/:id — Merkle proof for a single entry
app.get("/verify/:id", (req, res) => {
  const entry = getEntryById.get(parseInt(req.params.id, 10));
  if (!entry) return res.status(404).json({ error: "entry not found" });

  if (!entry.block_id) {
    return res.json({
      entry_id: entry.id,
      verified: false,
      reason: "entry has not been sealed into a block yet",
      entry,
    });
  }

  const block = getBlockById.get(entry.block_id);
  const entries = getEntriesByBlock.all(block.id);
  const hashes = entries.map((e) => e.hash);
  const leafIndex = entries.findIndex((e) => e.id === entry.id);
  const proof = getProof(hashes, leafIndex);
  const valid = verifyProof(entry.hash, proof, block.merkle_root);

  res.json({
    entry_id: entry.id,
    block_id: block.id,
    merkle_root: block.merkle_root,
    leaf_index: leafIndex,
    proof,
    verified: valid,
    entry,
  });
});

// GET /fellowship — author leaderboard with levels
app.get("/fellowship", (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit, 10)  || 50, 200);
  const offset = parseInt(req.query.offset, 10) || 0;
  const rows = getAuthorStats.all(limit, offset);
  const authors = rows.map((r) => ({ ...r, level: getLevel(r.entry_count) }));
  res.json({ count: authors.length, authors });
});

// GET /fellowship/:author — single author profile
app.get("/fellowship/:author", (req, res) => {
  const row = getOneAuthorStats.get(req.params.author);
  if (!row || row.entry_count === 0) return res.status(404).json({ error: "author not found" });
  res.json({ ...row, level: getLevel(row.entry_count) });
});

app.listen(PORT, () => {
  console.log(`SCO Ledger (Phase 2) listening on port ${PORT}`);
});
