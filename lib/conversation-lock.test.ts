import { describe, expect, it } from "vitest";
import { withConversationLock } from "./conversation-lock";

describe("withConversationLock", () => {
  it("serializes work for one conversation", async () => {
    const order: string[] = [];
    let releaseFirst!: () => void;
    let markFirstStarted!: () => void;
    const firstCanFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });

    const first = withConversationLock("conversation", async () => {
      order.push("first:start");
      markFirstStarted();
      await firstCanFinish;
      order.push("first:end");
    });
    const second = withConversationLock("conversation", async () => {
      order.push("second:start");
    });

    await firstStarted;
    expect(order).toEqual(["first:start"]);
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(["first:start", "first:end", "second:start"]);
  });
});
