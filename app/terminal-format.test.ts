import { describe, expect, it } from "vitest";
import type { Message } from "@/lib/contracts";
import {
  formatCommandResult,
  formatConversationHistory,
  sandboxLabel,
} from "./terminal-format";

describe("terminal formatting", () => {
  it("formats command output and non-zero exits", () => {
    expect(
      formatCommandResult({
        conversationId: "conversation",
        result: { exitCode: 7, stdout: "hello\n", stderr: "bad\n" },
      }),
    ).toBe("hello\r\nbad\r\n\r\n[exit 7]\r\n");
  });

  it("replays command history", () => {
    const messages: Message[] = [
      message({ role: "user", content: "pwd", command: "pwd" }),
      message({
        role: "assistant",
        content: "/home/user",
        stdout: "/home/user\n",
      }),
    ];
    expect(formatConversationHistory(messages)).toBe(
      "\r\n$ pwd\r\n/home/user\r\n",
    );
  });

  it("uses a compact sandbox label", () => {
    expect(sandboxLabel("sandbox-12345678")).toBe("Sandbox 12345678");
    expect(sandboxLabel(null)).toBe("Starts on first command");
  });
});

function message(overrides: Partial<Message>): Message {
  return {
    id: crypto.randomUUID(),
    conversation_id: "conversation",
    role: "assistant",
    content: "",
    command: null,
    exit_code: null,
    stdout: null,
    stderr: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}
