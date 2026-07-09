import type Sandbox from "e2b";
import type { CommandResult } from "e2b";
import { MAX_PTY_OUTPUT_CHARS } from "@/lib/config";

const PTY_START_MARKER = "__E2B_TERMINAL_START__";
const ANSI_PATTERN =
  // eslint-disable-next-line no-control-regex
  /[\u001b\u009b][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function cleanPtyOutput(output: string) {
  const markerIndex = output.indexOf(PTY_START_MARKER);
  const commandOutput =
    markerIndex >= 0
      ? output.slice(markerIndex + PTY_START_MARKER.length)
      : output;
  const lines = commandOutput
    .replace(ANSI_PATTERN, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => !/^[^@\s]+@[^:\s]+:.*[$#]\s*$/.test(line.trim()))
    .filter((line) => line.trim() !== "logout");

  while (lines[0]?.trim() === "") lines.shift();
  while (lines.at(-1)?.trim() === "") lines.pop();
  return lines.length ? `${lines.join("\n")}\n` : "";
}

export async function runPtyCommand(
  sandbox: Sandbox,
  command: string,
  timeoutMs: number,
): Promise<CommandResult> {
  const decoder = new TextDecoder();
  let ptyOutput = "";
  let outputTruncated = false;

  function appendOutput(chunk: string) {
    const remaining = MAX_PTY_OUTPUT_CHARS - ptyOutput.length;
    if (remaining > 0) ptyOutput += chunk.slice(0, remaining);
    if (chunk.length > remaining) outputTruncated = true;
  }

  const handle = await sandbox.pty.create({
    cols: 120,
    rows: 32,
    timeoutMs,
    onData(data) {
      appendOutput(decoder.decode(data, { stream: true }));
    },
  });
  await sandbox.pty.sendInput(
    handle.pid,
    new TextEncoder().encode(
      `stty -echo\nprintf '\\n${PTY_START_MARKER}\\n'\nexec bash -lc ${shellQuote(command)}\n`,
    ),
  );

  try {
    const result = await handle.wait();
    appendOutput(decoder.decode());
    const stdout = cleanPtyOutput(ptyOutput);
    return {
      ...result,
      stdout: outputTruncated ? `${stdout}[output truncated]\n` : stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    appendOutput(decoder.decode());
    if (error instanceof Error && "exitCode" in error) {
      const exitCode = Number((error as { exitCode?: unknown }).exitCode);
      const stdout = cleanPtyOutput(ptyOutput);
      return {
        exitCode: Number.isFinite(exitCode) ? exitCode : 1,
        error: error.message,
        stdout: outputTruncated ? `${stdout}[output truncated]\n` : stdout,
        stderr:
          "stderr" in error
            ? String((error as { stderr?: unknown }).stderr || "")
            : "",
      };
    }
    throw error;
  }
}
