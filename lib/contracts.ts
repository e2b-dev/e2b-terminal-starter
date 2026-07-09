export type SandboxStatus = "running" | "paused" | "unknown";

export type User = {
  id: string;
  name: string;
  created_at: string;
};

export type Conversation = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type ConversationListItem = Conversation & {
  e2b_sandbox_id: string | null;
  sandbox_status: SandboxStatus | null;
};

export type SandboxRecord = {
  id: string;
  conversation_id: string;
  e2b_sandbox_id: string;
  template: string;
  status: SandboxStatus;
  created_at: string;
  last_used_at: string;
  expires_at: string | null;
};

export type Message = {
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

export type CommandOutput = {
  exitCode: number;
  stdout: string;
  stderr: string;
  error?: string;
};

export type CommandResponse = {
  conversationId: string;
  sandboxId?: string;
  command?: string;
  result?: CommandOutput;
  messages?: {
    userMessage: Message;
    assistantMessage: Message;
  };
  warning?: string;
  error?: string;
};

export type ConfigResponse = {
  hasE2bApiKey: boolean;
  template: string;
};

export type ConversationsResponse = {
  conversations: ConversationListItem[];
  runningSandboxCount: number;
};

export type ConversationResponse = {
  conversation: Conversation;
  sandbox: SandboxRecord | null;
  messages: Message[];
};

export type UserResponse = {
  user: User;
};

export type ErrorResponse = {
  error: string;
};
