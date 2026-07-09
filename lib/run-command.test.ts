import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Conversation, User } from "./contracts";

const mocks = vi.hoisted(() => ({
  getOrCreateSandbox: vi.fn(),
  recordCommand: vi.fn(),
  runPtyCommand: vi.fn(),
}));

vi.mock("./db", () => ({ recordCommand: mocks.recordCommand }));
vi.mock("./e2b/pty", () => ({ runPtyCommand: mocks.runPtyCommand }));
vi.mock("./e2b/sandbox", () => ({
  getOrCreateSandbox: mocks.getOrCreateSandbox,
  SandboxTrackingError: class SandboxTrackingError extends Error {
    constructor(
      message: string,
      readonly sandboxId: string,
    ) {
      super(message);
    }
  },
}));

import { runCommand } from "./run-command";

const conversation: Conversation = {
  id: "conversation",
  user_id: "user",
  title: "New conversation",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};
const user: User = {
  id: "user",
  name: "demo",
  created_at: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getOrCreateSandbox.mockResolvedValue({ sandboxId: "sandbox" });
  mocks.runPtyCommand.mockResolvedValue({
    exitCode: 0,
    stdout: "hello\n",
    stderr: "",
  });
});

describe("runCommand", () => {
  it("returns persisted messages", async () => {
    const messages = {
      userMessage: { id: "user-message" },
      assistantMessage: { id: "assistant-message" },
    };
    mocks.recordCommand.mockReturnValue(messages);

    await expect(
      runCommand({ conversation, command: "echo hello", user }),
    ).resolves.toMatchObject({ messages, warning: undefined });
  });

  it("returns command output with a warning when history persistence fails", async () => {
    mocks.recordCommand.mockImplementation(() => {
      throw new Error("database unavailable");
    });

    await expect(
      runCommand({ conversation, command: "echo hello", user }),
    ).resolves.toMatchObject({
      result: { stdout: "hello\n" },
      warning: "Command ran, but its history could not be saved.",
    });
  });
});
