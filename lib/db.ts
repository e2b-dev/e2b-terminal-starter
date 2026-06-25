import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const databasePath =
  process.env.APP_DATABASE_PATH || path.join(process.cwd(), "data", "app.db");

type UserRow = {
  id: string;
  name: string;
  created_at: string;
};

type ConversationRow = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type SandboxRow = {
  id: string;
  conversation_id: string;
  e2b_sandbox_id: string;
  template: string;
  status: "running" | "paused" | "unknown";
  created_at: string;
  last_used_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  command: string | null;
  exit_code: number | null;
  stdout: string | null;
  stderr: string | null;
  created_at: string;
};

let database: Database.Database | undefined;

function now() {
  return new Date().toISOString();
}

function getDatabase() {
  if (database) return database;

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
      last_used_at TEXT NOT NULL
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

  return database;
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 80);
}

function titleFromCommand(command: string) {
  return command.trim().replace(/\s+/g, " ").slice(0, 80) || "New conversation";
}

export function upsertUser(name: string) {
  const db = getDatabase();
  const normalizedName = normalizeName(name);
  if (!normalizedName) {
    throw new Error("User name is required.");
  }

  const existing = db
    .prepare("SELECT * FROM users WHERE name = ?")
    .get(normalizedName) as UserRow | undefined;

  if (existing) return existing;

  const user: UserRow = {
    id: randomUUID(),
    name: normalizedName,
    created_at: now(),
  };

  db.prepare("INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)").run(
    user.id,
    user.name,
    user.created_at,
  );

  return user;
}

export function createUser(name: string) {
  const db = getDatabase();
  const normalizedName = normalizeName(name);
  if (!normalizedName) {
    throw new Error("User name is required.");
  }

  const user: UserRow = {
    id: randomUUID(),
    name: normalizedName,
    created_at: now(),
  };

  db.prepare("INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)").run(
    user.id,
    user.name,
    user.created_at,
  );

  return user;
}

export function getUser(userId: string) {
  return getDatabase()
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(userId) as UserRow | undefined;
}

export function getUserByName(name: string) {
  const normalizedName = normalizeName(name);
  if (!normalizedName) return undefined;

  return getDatabase()
    .prepare("SELECT * FROM users WHERE name = ?")
    .get(normalizedName) as UserRow | undefined;
}

export function renameUser(userId: string, name: string) {
  const normalizedName = normalizeName(name);
  if (!normalizedName) {
    throw new Error("User name is required.");
  }

  const db = getDatabase();
  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(normalizedName, userId);
  return getUser(userId);
}

export function reconcileExpiredSandboxes(maxIdleMs: number) {
  if (!Number.isFinite(maxIdleMs) || maxIdleMs <= 0) return;

  getDatabase()
    .prepare(
      `
      UPDATE sandboxes
      SET status = 'unknown'
      WHERE status = 'running'
        AND last_used_at <= ?
    `,
    )
    .run(new Date(Date.now() - maxIdleMs).toISOString());
}

export function listConversations(userId: string) {
  reconcileExpiredSandboxes(getSandboxIdleMs());

  return getDatabase()
    .prepare(
      `
      SELECT
        conversations.*,
        sandboxes.e2b_sandbox_id,
        sandboxes.status AS sandbox_status,
        (
          SELECT content
          FROM messages
          WHERE messages.conversation_id = conversations.id
          ORDER BY created_at DESC
          LIMIT 1
        ) AS last_message
      FROM conversations
      LEFT JOIN sandboxes ON sandboxes.conversation_id = conversations.id
      WHERE conversations.user_id = ?
      ORDER BY conversations.updated_at DESC
    `,
    )
    .all(userId) as Array<
    ConversationRow & {
      e2b_sandbox_id: string | null;
      sandbox_status: SandboxRow["status"] | null;
      last_message: string | null;
    }
  >;
}

export function countRunningSandboxes(userId: string) {
  reconcileExpiredSandboxes(getSandboxIdleMs());

  const row = getDatabase()
    .prepare(
      `
      SELECT COUNT(*) AS count
      FROM sandboxes
      INNER JOIN conversations ON conversations.id = sandboxes.conversation_id
      WHERE conversations.user_id = ? AND sandboxes.status = 'running'
    `,
    )
    .get(userId) as { count: number };

  return row.count;
}

export function listSandboxesForUser(userId: string) {
  return getDatabase()
    .prepare(
      `
      SELECT sandboxes.*
      FROM sandboxes
      INNER JOIN conversations ON conversations.id = sandboxes.conversation_id
      WHERE conversations.user_id = ?
    `,
    )
    .all(userId) as SandboxRow[];
}

export function createConversation(userId: string, title = "New conversation") {
  const timestamp = now();
  const conversation: ConversationRow = {
    id: randomUUID(),
    user_id: userId,
    title,
    created_at: timestamp,
    updated_at: timestamp,
  };

  getDatabase()
    .prepare(
      "INSERT INTO conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(
      conversation.id,
      conversation.user_id,
      conversation.title,
      conversation.created_at,
      conversation.updated_at,
    );

  return conversation;
}

export function deleteConversation(conversationId: string) {
  getDatabase().prepare("DELETE FROM conversations WHERE id = ?").run(conversationId);
}

export function getConversation(conversationId: string) {
  return getDatabase()
    .prepare("SELECT * FROM conversations WHERE id = ?")
    .get(conversationId) as ConversationRow | undefined;
}

export function listMessages(conversationId: string) {
  return getDatabase()
    .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC")
    .all(conversationId) as MessageRow[];
}

export function getSandboxForConversation(conversationId: string) {
  return getDatabase()
    .prepare("SELECT * FROM sandboxes WHERE conversation_id = ?")
    .get(conversationId) as SandboxRow | undefined;
}

export function removeSandbox(conversationId: string) {
  getDatabase()
    .prepare("DELETE FROM sandboxes WHERE conversation_id = ?")
    .run(conversationId);
}

export function attachSandbox(conversationId: string, e2bSandboxId: string, template: string) {
  const timestamp = now();
  const sandbox: SandboxRow = {
    id: randomUUID(),
    conversation_id: conversationId,
    e2b_sandbox_id: e2bSandboxId,
    template,
    status: "running",
    created_at: timestamp,
    last_used_at: timestamp,
  };

  getDatabase()
    .prepare(
      `
      INSERT INTO sandboxes (id, conversation_id, e2b_sandbox_id, template, status, created_at, last_used_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(conversation_id) DO UPDATE SET
        e2b_sandbox_id = excluded.e2b_sandbox_id,
        template = excluded.template,
        status = excluded.status,
        last_used_at = excluded.last_used_at
    `,
    )
    .run(
      sandbox.id,
      sandbox.conversation_id,
      sandbox.e2b_sandbox_id,
      sandbox.template,
      sandbox.status,
      sandbox.created_at,
      sandbox.last_used_at,
    );

  return getSandboxForConversation(conversationId);
}

function getSandboxIdleMs() {
  const timeout = Number(process.env.E2B_TIMEOUT_MS);
  return Number.isFinite(timeout) && timeout > 0 ? timeout : 300_000;
}

export function touchSandbox(conversationId: string) {
  getDatabase()
    .prepare("UPDATE sandboxes SET status = 'running', last_used_at = ? WHERE conversation_id = ?")
    .run(now(), conversationId);
}

export function markSandboxPaused(conversationId: string) {
  getDatabase()
    .prepare("UPDATE sandboxes SET status = 'paused', last_used_at = ? WHERE conversation_id = ?")
    .run(now(), conversationId);
}

export function markSandboxStatus(
  conversationId: string,
  status: SandboxRow["status"],
) {
  getDatabase()
    .prepare("UPDATE sandboxes SET status = ?, last_used_at = ? WHERE conversation_id = ?")
    .run(status, now(), conversationId);
}

export function recordCommand(params: {
  conversationId: string;
  command: string;
  sandboxId: string;
  template: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}) {
  const db = getDatabase();
  const timestamp = now();
  const conversation = getConversation(params.conversationId);
  if (!conversation) {
    throw new Error("Conversation not found.");
  }

  const userMessage: MessageRow = {
    id: randomUUID(),
    conversation_id: params.conversationId,
    role: "user",
    content: params.command,
    command: params.command,
    exit_code: null,
    stdout: null,
    stderr: null,
    created_at: timestamp,
  };
  const assistantMessage: MessageRow = {
    id: randomUUID(),
    conversation_id: params.conversationId,
    role: "assistant",
    content: params.stdout || params.stderr || `[exit ${params.exitCode}]`,
    command: params.command,
    exit_code: params.exitCode,
    stdout: params.stdout,
    stderr: params.stderr,
    created_at: now(),
  };

  const transaction = db.transaction(() => {
    const insertMessage = db.prepare(
      `
      INSERT INTO messages
        (id, conversation_id, role, content, command, exit_code, stdout, stderr, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    );
    insertMessage.run(
      userMessage.id,
      userMessage.conversation_id,
      userMessage.role,
      userMessage.content,
      userMessage.command,
      userMessage.exit_code,
      userMessage.stdout,
      userMessage.stderr,
      userMessage.created_at,
    );
    insertMessage.run(
      assistantMessage.id,
      assistantMessage.conversation_id,
      assistantMessage.role,
      assistantMessage.content,
      assistantMessage.command,
      assistantMessage.exit_code,
      assistantMessage.stdout,
      assistantMessage.stderr,
      assistantMessage.created_at,
    );
    db.prepare("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?").run(
      conversation.title === "New conversation"
        ? titleFromCommand(params.command)
        : conversation.title,
      now(),
      params.conversationId,
    );
    db.prepare("UPDATE sandboxes SET last_used_at = ? WHERE conversation_id = ?").run(
      now(),
      params.conversationId,
    );
  });

  transaction();
  return { userMessage, assistantMessage };
}

export type { ConversationRow, MessageRow, SandboxRow, UserRow };
