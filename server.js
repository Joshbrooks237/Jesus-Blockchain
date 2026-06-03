"use strict";

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const GENESIS_HASH = "0".repeat(64);

function hashEntry({ author, content, created_at, prev_hash }) {
  const payload = `${prev_hash}|${created_at}|${author}|${content}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

const getLastEntry = db.prepare("SELECT hash FROM entries ORDER BY id DESC LIMIT 1");
const insertEntry  = db.prepare(`
  INSERT INTO entries (author, content, created_at, prev_hash, hash)
  VALUES (@author, @content, @created_at, @prev_hash, @hash)
`);
const getEntryById = db.prepare("SELECT * FROM entries WHERE id = ?");
const listEntries  = db.prepare("SELECT * FROM entries ORDER BY id DESC LIMIT ? OFFSET ?");

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/entry", (req, res) => {
  const { author, content } = req.body || {};

  if (typeof content !== "string" || content.trim() === "") {
    return res.status(400).json({ error: "content is required" });
  }

  const cleanAuthor = typeof author === "string" && author.trim() ? author.trim() : "anonymous";
  const created_at  = new Date().toISOString();
  const last        = getLastEntry.get();
  const prev_hash   = last ? last.hash : GENESIS_HASH;

  const record = { author: cleanAuthor, content: content.trim(), created_at, prev_hash };
  record.hash  = hashEntry(record);

  const info    = insertEntry.run(record);
  const created = getEntryById.get(info.lastInsertRowid);

  res.status(201).json(created);
});

app.get("/entries", (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit,  10) || 100, 500);
  const offset = parseInt(req.query.offset, 10) || 0;
  const entries = listEntries.all(limit, offset);
  res.json({ count: entries.length, entries });
});

app.listen(PORT, () => {
  console.log(`SCO Ledger listening on port ${PORT}`);
});
