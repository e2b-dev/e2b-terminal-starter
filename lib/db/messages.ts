import { randomUUID } from "node:crypto";
import type { Message } from "@/lib/contracts";
import { getDatabase, now } from "./client";
import { getConversation } from "./conversations";

function titleFromCommand(command: string) {
  return command.trim().replace(/\s+/g, " ").slice(0, 80) || "New conversation";
}

export function listMessages(conversationId: string) {
  return getDatabase()
    .prepare(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
    )
    .all(conversationId) as Message[];
}

export function recordCommand(params: {
  conversationId: string;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}) {
  const db = getDatabase();
  const conversation = getConversation(params.conversationId);
  if (!conversation) throw new Error("Conversation not found.");

  const userMessage: Message = {
    id: randomUUID(),
    conversation_id: params.conversationId,
    role: "user",
    content: params.command,
    command: params.command,
    exit_code: null,
    stdout: null,
    stderr: null,
    created_at: now(),
  };
  const assistantMessage: Message = {
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

  const insertMessage = db.prepare(
    `
    INSERT INTO messages
      (id, conversation_id, role, content, command, exit_code, stdout, stderr, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  );
  db.transaction(() => {
    for (const message of [userMessage, assistantMessage]) {
      insertMessage.run(
        message.id,
        message.conversation_id,
        message.role,
        message.content,
        message.command,
        message.exit_code,
        message.stdout,
        message.stderr,
        message.created_at,
      );
    }
    db.prepare(
      "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
    ).run(
      conversation.title === "New conversation"
        ? titleFromCommand(params.command)
        : conversation.title,
      now(),
      params.conversationId,
    );
    db.prepare(
      "UPDATE sandboxes SET last_used_at = ? WHERE conversation_id = ?",
    ).run(now(), params.conversationId);
  })();

  return { userMessage, assistantMessage };
}
