import { randomUUID } from "node:crypto";
import type { Conversation, ConversationListItem } from "@/lib/contracts";
import { getDatabase, now } from "./client";

export function listConversations(userId: string) {
  return getDatabase()
    .prepare(
      `
      SELECT
        conversations.*,
        sandboxes.e2b_sandbox_id,
        sandboxes.status AS sandbox_status
      FROM conversations
      LEFT JOIN sandboxes ON sandboxes.conversation_id = conversations.id
      WHERE conversations.user_id = ?
      ORDER BY conversations.updated_at DESC
    `,
    )
    .all(userId) as ConversationListItem[];
}

export function createConversation(userId: string, title = "New conversation") {
  const timestamp = now();
  const conversation: Conversation = {
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

export function getOrCreateInitialConversation(userId: string) {
  const db = getDatabase();
  const getOrCreate = db.transaction(() => {
    const existing = db
      .prepare(
        "SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1",
      )
      .get(userId) as Conversation | undefined;
    return existing || createConversation(userId);
  });
  return getOrCreate.immediate();
}

export function getConversation(conversationId: string) {
  return getDatabase()
    .prepare("SELECT * FROM conversations WHERE id = ?")
    .get(conversationId) as Conversation | undefined;
}
