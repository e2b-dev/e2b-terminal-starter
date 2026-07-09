import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { getDatabasePath } from "@/lib/config";

let database: Database.Database | undefined;

export function now() {
  return new Date().toISOString();
}

export function getDatabase() {
  if (database) return database;

  const databasePath = getDatabasePath();
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  database = new Database(databasePath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sandboxes (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE CASCADE,
      e2b_sandbox_id TEXT NOT NULL UNIQUE,
      template TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('running', 'paused', 'unknown')),
      created_at TEXT NOT NULL,
      last_used_at TEXT NOT NULL,
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      command TEXT,
      exit_code INTEGER,
      stdout TEXT,
      stderr TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_conversations_user_updated
      ON conversations(user_id, updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
      ON messages(conversation_id, created_at ASC);
  `);

  const sandboxColumns = database
    .prepare("PRAGMA table_info(sandboxes)")
    .all() as Array<{ name: string }>;
  if (!sandboxColumns.some((column) => column.name === "status")) {
    database
      .prepare(
        "ALTER TABLE sandboxes ADD COLUMN status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('running', 'paused', 'unknown'))",
      )
      .run();
  }
  if (!sandboxColumns.some((column) => column.name === "expires_at")) {
    database.prepare("ALTER TABLE sandboxes ADD COLUMN expires_at TEXT").run();
  }

  return database;
}

export function closeDatabase() {
  database?.close();
  database = undefined;
}
