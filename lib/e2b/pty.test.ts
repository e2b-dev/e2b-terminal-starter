import { describe, expect, it } from "vitest";
import { cleanPtyOutput } from "./pty";

describe("cleanPtyOutput", () => {
  it("removes setup output, prompts, and ANSI sequences", () => {
    const output = [
      "setup noise",
      "__E2B_TERMINAL_START__",
      "user@sandbox:~$ ",
      "\u001b[32mhello\u001b[0m",
      "logout",
      "",
    ].join("\r\n");

    expect(cleanPtyOutput(output)).toBe("hello\n");
  });

  it("returns an empty string for commands without output", () => {
    expect(cleanPtyOutput("__E2B_TERMINAL_START__\r\n\r\n")).toBe("");
  });
});
