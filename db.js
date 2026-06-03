"use strict";

const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const dbPath = path.join(DATA_DIR, "ledger.sqlite");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    author     TEXT    NOT NULL,
    content    TEXT    NOT NULL,
    created_at TEXT    NOT NULL,
    prev_hash  TEXT    NOT NULL,
    hash       TEXT    NOT NULL,
    block_id   INTEGER
  );

  CREATE TABLE IF NOT EXISTS blocks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    merkle_root  TEXT    NOT NULL,
    entry_count  INTEGER NOT NULL,
    first_entry  INTEGER NOT NULL,
    last_entry   INTEGER NOT NULL,
    created_at   TEXT    NOT NULL
  );

  -- Add block_id column to existing entries table if this is an upgrade.
  -- SQLite ignores this if the column already exists (handled via try/catch in code).
`);

// Migrate: add block_id column for databases created before Phase 2.
try {
  db.exec("ALTER TABLE entries ADD COLUMN block_id INTEGER;");
} catch (_) {
  // Column already exists — safe to ignore.
}

module.exports = db;
