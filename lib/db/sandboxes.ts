import { randomUUID } from "node:crypto";
import type { SandboxRecord } from "@/lib/contracts";
import { getE2bConfig } from "@/lib/config";
import { getDatabase, now } from "./client";

export function reconcileExpiredSandboxes() {
  const { timeoutMs } = getE2bConfig();
  getDatabase()
    .prepare(
      `
      UPDATE sandboxes
      SET status = 'paused'
      WHERE status = 'running'
        AND (
          (expires_at IS NOT NULL AND expires_at <= ?)
          OR (expires_at IS NULL AND last_used_at <= ?)
        )
    `,
    )
    .run(now(), new Date(Date.now() - timeoutMs).toISOString());
}

export function countRunningSandboxes(userId: string) {
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

export function getSandboxForConversation(conversationId: string) {
  return getDatabase()
    .prepare("SELECT * FROM sandboxes WHERE conversation_id = ?")
    .get(conversationId) as SandboxRecord | undefined;
}

export function removeSandbox(conversationId: string) {
  getDatabase()
    .prepare("DELETE FROM sandboxes WHERE conversation_id = ?")
    .run(conversationId);
}

export function attachSandbox(
  conversationId: string,
  e2bSandboxId: string,
  template: string,
  expiresAt: Date,
) {
  const timestamp = now();
  const sandbox: SandboxRecord = {
    id: randomUUID(),
    conversation_id: conversationId,
    e2b_sandbox_id: e2bSandboxId,
    template,
    status: "running",
    created_at: timestamp,
    last_used_at: timestamp,
    expires_at: expiresAt.toISOString(),
  };

  getDatabase()
    .prepare(
      `
      INSERT INTO sandboxes (id, conversation_id, e2b_sandbox_id, template, status, created_at, last_used_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(conversation_id) DO UPDATE SET
        e2b_sandbox_id = excluded.e2b_sandbox_id,
        template = excluded.template,
        status = excluded.status,
        last_used_at = excluded.last_used_at,
        expires_at = excluded.expires_at
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
      sandbox.expires_at,
    );

  return getSandboxForConversation(conversationId);
}

export function touchSandbox(conversationId: string, expiresAt: Date) {
  getDatabase()
    .prepare(
      "UPDATE sandboxes SET status = 'running', last_used_at = ?, expires_at = ? WHERE conversation_id = ?",
    )
    .run(now(), expiresAt.toISOString(), conversationId);
}

export function markSandboxPaused(conversationId: string) {
  getDatabase()
    .prepare(
      "UPDATE sandboxes SET status = 'paused', last_used_at = ? WHERE conversation_id = ?",
    )
    .run(now(), conversationId);
}
