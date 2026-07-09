import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  attachSandbox: vi.fn(),
  connect: vi.fn(),
  create: vi.fn(),
  getSandboxForConversation: vi.fn(),
  markSandboxPaused: vi.fn(),
  pause: vi.fn(),
  removeSandbox: vi.fn(),
  touchSandbox: vi.fn(),
}));

vi.mock("e2b", () => ({
  default: {
    connect: mocks.connect,
    create: mocks.create,
    pause: mocks.pause,
  },
  SandboxNotFoundError: class SandboxNotFoundError extends Error {},
}));
vi.mock("../db", () => ({
  attachSandbox: mocks.attachSandbox,
  getSandboxForConversation: mocks.getSandboxForConversation,
  markSandboxPaused: mocks.markSandboxPaused,
  removeSandbox: mocks.removeSandbox,
  touchSandbox: mocks.touchSandbox,
}));

import { SandboxNotFoundError } from "e2b";
import type { User } from "../contracts";
import { getOrCreateSandbox } from "./sandbox";

const user: User = {
  id: "user",
  name: "demo",
  created_at: "2026-01-01T00:00:00.000Z",
};
const endAt = new Date("2026-01-01T00:05:00.000Z");

function sandbox(sandboxId: string) {
  return {
    sandboxId,
    getInfo: vi.fn().mockResolvedValue({ endAt }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pause.mockResolvedValue(undefined);
});

describe("getOrCreateSandbox", () => {
  it("reconnects to the persisted sandbox", async () => {
    const existing = sandbox("existing");
    mocks.getSandboxForConversation.mockReturnValue({
      e2b_sandbox_id: "existing",
    });
    mocks.connect.mockResolvedValue(existing);

    await expect(getOrCreateSandbox("conversation", user)).resolves.toBe(
      existing,
    );
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.touchSandbox).toHaveBeenCalledWith("conversation", endAt);
  });

  it("does not replace a sandbox after a transient connect error", async () => {
    mocks.getSandboxForConversation.mockReturnValue({
      e2b_sandbox_id: "existing",
    });
    mocks.connect.mockRejectedValue(new Error("network unavailable"));

    await expect(getOrCreateSandbox("conversation", user)).rejects.toThrow(
      "network unavailable",
    );
    expect(mocks.removeSandbox).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("replaces a sandbox only when E2B reports it missing", async () => {
    const replacement = sandbox("replacement");
    mocks.getSandboxForConversation.mockReturnValue({
      e2b_sandbox_id: "existing",
    });
    mocks.connect.mockRejectedValue(new SandboxNotFoundError("missing"));
    mocks.create.mockResolvedValue(replacement);

    await expect(getOrCreateSandbox("conversation", user)).resolves.toBe(
      replacement,
    );
    expect(mocks.removeSandbox).toHaveBeenCalledWith("conversation");
    expect(mocks.attachSandbox).toHaveBeenCalledWith(
      "conversation",
      "replacement",
      "base",
      expect.any(Date),
    );
  });

  it("pauses a new sandbox when local tracking fails", async () => {
    const created = sandbox("created");
    mocks.getSandboxForConversation.mockReturnValue(undefined);
    mocks.create.mockResolvedValue(created);
    mocks.attachSandbox.mockImplementation(() => {
      throw new Error("database unavailable");
    });

    await expect(getOrCreateSandbox("conversation", user)).rejects.toEqual(
      expect.objectContaining({ sandboxId: "created" }),
    );
    expect(mocks.pause).toHaveBeenCalledWith("created");
  });
});
