/**
 * db.js — Aurora Home Datenbank (SQLite)
 * Erstellt und initialisiert die lokale Datenbank.
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs   = require('fs');

const ROOT    = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT, 'aurora.db');

function getDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema(db);
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      cat        TEXT,
      cat_key    TEXT,
      price      REAL NOT NULL,
      desc       TEXT,
      img        TEXT,
      images     TEXT DEFAULT '[]',
      badge      TEXT,
      active     INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS scents (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      no      TEXT NOT NULL,
      season  TEXT,
      name    TEXT NOT NULL,
      notes   TEXT,
      grad    TEXT,
      bs      INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS resin_tiers (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      stufe       TEXT NOT NULL,
      label       TEXT,
      price_from  REAL,
      weeks       TEXT,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS changelog (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp  TEXT DEFAULT (datetime('now','localtime')),
      action     TEXT NOT NULL,
      entity     TEXT,
      entity_id  INTEGER,
      details    TEXT,
      commit_sha TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at  TEXT DEFAULT (datetime('now','localtime')),
      priority    TEXT DEFAULT 'normal',
      status      TEXT DEFAULT 'open',
      title       TEXT NOT NULL,
      description TEXT,
      due_date    TEXT,
      closed_at   TEXT
    );

    CREATE TABLE IF NOT EXISTS config (
      key        TEXT PRIMARY KEY,
      value      TEXT,
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER REFERENCES products(id),
      old_price  REAL,
      new_price  REAL,
      reason     TEXT,
      changed_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TRIGGER IF NOT EXISTS products_updated
      AFTER UPDATE ON products
      BEGIN
        UPDATE products SET updated_at = datetime('now','localtime') WHERE id = NEW.id;
      END;
  `);
}

module.exports = { getDb, DB_PATH };
