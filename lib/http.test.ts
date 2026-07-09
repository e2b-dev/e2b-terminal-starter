import { describe, expect, it } from "vitest";
import { readJson } from "./http";

describe("readJson", () => {
  it("accepts JSON objects", async () => {
    const result = await readJson<{ name: string }>(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ name: "demo" }),
      }),
    );

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ name: "demo" });
  });

  it.each(["null", "[]", '"demo"', "42"])(
    "rejects a non-object body: %s",
    async (body) => {
      const result = await readJson(
        new Request("http://localhost", { method: "POST", body }),
      );

      expect(result.data).toBeNull();
      expect(result.error?.status).toBe(400);
    },
  );
});
