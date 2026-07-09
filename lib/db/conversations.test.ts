import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  closeDatabase,
  attachSandbox,
  createConversation,
  getOrCreateInitialConversation,
  getSandboxForConversation,
  listConversations,
  reconcileExpiredSandboxes,
  upsertUser,
} from ".";

let testDirectory: string;

beforeEach(() => {
  testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "e2b-starter-"));
  process.env.APP_DATABASE_PATH = path.join(testDirectory, "app.db");
});

afterEach(() => {
  closeDatabase();
  delete process.env.APP_DATABASE_PATH;
  fs.rmSync(testDirectory, { recursive: true, force: true });
});

describe("initial conversations", () => {
  it("reuses the same initial conversation", () => {
    const user = upsertUser("demo");
    const first = getOrCreateInitialConversation(user.id);
    const second = getOrCreateInitialConversation(user.id);

    expect(second.id).toBe(first.id);
    expect(listConversations(user.id)).toHaveLength(1);
  });
});

describe("sandbox reconciliation", () => {
  it("marks expired sandboxes as paused when reconciliation runs", () => {
    const user = upsertUser("demo");
    const conversation = createConversation(user.id);
    attachSandbox(
      conversation.id,
      "sandbox",
      "base",
      new Date("2000-01-01T00:00:00.000Z"),
    );

    reconcileExpiredSandboxes();

    expect(getSandboxForConversation(conversation.id)?.status).toBe("paused");
  });
});
