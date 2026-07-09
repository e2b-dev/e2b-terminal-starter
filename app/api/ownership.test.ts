import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getConversation: vi.fn(),
  getCurrentUser: vi.fn(),
  getSandboxForConversation: vi.fn(),
  markSandboxPaused: vi.fn(),
  pauseSandbox: vi.fn(),
  runCommand: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/db", () => ({
  getConversation: mocks.getConversation,
  getSandboxForConversation: mocks.getSandboxForConversation,
  markSandboxPaused: mocks.markSandboxPaused,
}));
vi.mock("@/lib/run-command", () => ({
  CommandExecutionError: class CommandExecutionError extends Error {},
  runCommand: mocks.runCommand,
}));
vi.mock("@/lib/e2b/sandbox", () => ({ pauseSandbox: mocks.pauseSandbox }));

import { POST as runCommandRoute } from "./command/route";
import { POST as pauseConversationRoute } from "./conversations/[conversationId]/pause/route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.E2B_API_KEY = "test-key";
  mocks.getCurrentUser.mockResolvedValue({ id: "current-user" });
  mocks.getConversation.mockReturnValue({
    id: "conversation",
    user_id: "different-user",
  });
});

describe("conversation ownership", () => {
  it("does not run commands for another user's conversation", async () => {
    const response = await runCommandRoute(
      new Request("http://localhost/api/command", {
        method: "POST",
        body: JSON.stringify({
          command: "echo hello",
          conversationId: "conversation",
        }),
      }),
    );

    expect(response.status).toBe(404);
    expect(mocks.runCommand).not.toHaveBeenCalled();
  });

  it("does not pause another user's sandbox", async () => {
    const response = await pauseConversationRoute(
      new Request("http://localhost", { method: "POST" }),
      { params: Promise.resolve({ conversationId: "conversation" }) },
    );

    expect(response.status).toBe(404);
    expect(mocks.pauseSandbox).not.toHaveBeenCalled();
  });
});
