import type {
  CommandResponse,
  ConfigResponse,
  Conversation,
  ConversationResponse,
  ConversationsResponse,
  ErrorResponse,
  SandboxRecord,
  UserResponse,
} from "@/lib/contracts";

async function requestJson<T>(
  url: string,
  options: RequestInit = {},
  fallbackError = "Request failed",
) {
  const response = await fetch(url, options);
  const data = (await response.json().catch(() => ({}))) as T & ErrorResponse;
  if (!response.ok) throw new Error(data.error || fallbackError);
  return data;
}

const jsonHeaders = { "Content-Type": "application/json" };

export function getConfig() {
  return requestJson<ConfigResponse>(
    "/api/config",
    {},
    "Could not load config",
  );
}

export function selectLocalUser(name: string) {
  return requestJson<UserResponse>(
    "/api/users",
    {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ name }),
    },
    "Could not select user",
  );
}

export function getConversations() {
  return requestJson<ConversationsResponse>(
    "/api/conversations",
    {},
    "Could not load conversations",
  );
}

export async function createConversation(initial = false) {
  const data = await requestJson<{ conversation: Conversation }>(
    "/api/conversations",
    {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ initial }),
    },
    "Could not create conversation",
  );
  return data.conversation;
}

export function getConversation(conversationId: string) {
  return requestJson<ConversationResponse>(
    `/api/conversations/${conversationId}`,
    {},
    "Could not load conversation",
  );
}

export function pauseConversation(conversationId: string) {
  return requestJson<{ sandbox: SandboxRecord; warning?: string }>(
    `/api/conversations/${conversationId}/pause`,
    { method: "POST" },
    "Could not pause sandbox",
  );
}

export function runCommand(conversationId: string, command: string) {
  return requestJson<CommandResponse>(
    "/api/command",
    {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ command, conversationId }),
    },
    "Command failed",
  );
}
