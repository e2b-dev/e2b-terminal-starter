import Sandbox, { SandboxNotFoundError, type CommandResult } from "e2b";
import { NextResponse } from "next/server";
import {
  attachSandbox,
  createConversation,
  getConversation,
  getSandboxForConversation,
  markSandboxPaused,
  recordCommand,
  removeSandbox,
  touchSandbox,
} from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

type CommandBody = {
  command?: unknown;
  userId?: unknown;
  conversationId?: unknown;
};

type SandboxOptions = Parameters<typeof Sandbox.create>[1];

const conversationLocks = new Map<string, Promise<unknown>>();
const PTY_START_MARKER = "__E2B_TERMINAL_START__";
const ANSI_PATTERN =
  // eslint-disable-next-line no-control-regex
  /[\u001b\u009b][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

function jsonError(message: string, status = 400, details: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...details }, { status });
}

function getTimeoutMs() {
  const timeout = Number(process.env.E2B_TIMEOUT_MS);
  return Number.isFinite(timeout) && timeout > 0 ? timeout : 300_000;
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function cleanPtyOutput(output: string) {
  const markerIndex = output.indexOf(PTY_START_MARKER);
  const commandOutput =
    markerIndex >= 0 ? output.slice(markerIndex + PTY_START_MARKER.length) : output;
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

async function runPtyCommand(
  sandbox: Awaited<ReturnType<typeof Sandbox.create>>,
  command: string,
): Promise<CommandResult> {
  const decoder = new TextDecoder();
  let ptyOutput = "";
  const handle = await sandbox.pty.create({
    cols: 120,
    rows: 32,
    timeoutMs: 60_000,
    onData(data) {
      ptyOutput += decoder.decode(data, { stream: true });
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
    ptyOutput += decoder.decode();
    return {
      ...result,
      stdout: cleanPtyOutput(ptyOutput),
      stderr: result.stderr,
    };
  } catch (error) {
    ptyOutput += decoder.decode();
    if (error instanceof Error && "exitCode" in error) {
      const exitCode = Number((error as { exitCode?: unknown }).exitCode);
      return {
        exitCode: Number.isFinite(exitCode) ? exitCode : 1,
        error: error.message,
        stdout: cleanPtyOutput(ptyOutput),
        stderr: "stderr" in error ? String((error as { stderr?: unknown }).stderr || "") : "",
      };
    }

    throw error;
  }
}

async function withConversationLock<T>(lockKey: string, run: () => Promise<T>) {
  const previous = conversationLocks.get(lockKey) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const next = previous.then(() => current, () => current);
  conversationLocks.set(lockKey, next);

  await previous.catch(() => undefined);
  try {
    return await run();
  } finally {
    release();
    if (conversationLocks.get(lockKey) === next) {
      conversationLocks.delete(lockKey);
    }
  }
}

function runFirstCommand(
  userId: string,
  command: string,
  template: string,
  sandboxOptions: SandboxOptions,
) {
  return withConversationLock(`user:${userId}:new`, async () => {
    const conversation = createConversation(userId);
    let sandbox: Awaited<ReturnType<typeof Sandbox.create>> | undefined;
    let sandboxAttached = false;
    try {
      sandbox = await Sandbox.create(template, sandboxOptions);
      attachSandbox(conversation.id, sandbox.sandboxId, template);
      sandboxAttached = true;
      const result = await runPtyCommand(sandbox, command);
      const messages = recordCommand({
        conversationId: conversation.id,
        command,
        sandboxId: sandbox.sandboxId,
        template,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
      });

      return NextResponse.json({
        conversationId: conversation.id,
        sandboxId: sandbox.sandboxId,
        command,
        result,
        messages,
      });
    } catch (error) {
      if (sandbox) {
        await Sandbox.pause(sandbox.sandboxId).catch(() => undefined);
        if (sandboxAttached) {
          markSandboxPaused(conversation.id);
        }
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      return jsonError(message, 500, {
        conversationId: conversation.id,
        sandboxId: sandbox?.sandboxId,
      });
    }
  });
}

async function getOrCreateSandbox(
  conversationId: string,
  template: string,
  sandboxOptions: SandboxOptions,
) {
  const persistedSandbox = getSandboxForConversation(conversationId);
  if (!persistedSandbox) {
    const sandbox = await Sandbox.create(template, sandboxOptions);
    attachSandbox(conversationId, sandbox.sandboxId, template);
    return sandbox;
  }

  try {
    const sandbox = await Sandbox.connect(persistedSandbox.e2b_sandbox_id, {
      timeoutMs: getTimeoutMs(),
    });
    touchSandbox(conversationId);
    return sandbox;
  } catch (error) {
    if (!(error instanceof SandboxNotFoundError)) {
      throw error;
    }

    await Sandbox.pause(persistedSandbox.e2b_sandbox_id).catch(() => undefined);
    removeSandbox(conversationId);
    const sandbox = await Sandbox.create(template, sandboxOptions);
    attachSandbox(conversationId, sandbox.sandboxId, template);
    return sandbox;
  }
}

export async function POST(request: Request) {
  if (!process.env.E2B_API_KEY) {
    return jsonError(
      "Missing E2B_API_KEY. Run `stripe projects env --pull` or copy .env.example to .env.local.",
      500,
    );
  }

  const body = (await request.json()) as CommandBody;
  const command = typeof body.command === "string" ? body.command.trim() : "";
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const conversationId =
    typeof body.conversationId === "string" ? body.conversationId.trim() : "";

  if (!command) {
    return jsonError("Command is required.");
  }

  const user = await getSessionUser();
  if (!user || user.id !== userId) {
    return jsonError("User not found.", 404);
  }

  const sandboxOptions = {
    timeoutMs: getTimeoutMs(),
    lifecycle: {
      onTimeout: "pause" as const,
      autoResume: true,
    },
    metadata: {
      user_id: userId,
      user_name: user.name,
      starter: "e2b-terminal-starter",
    },
  };

  try {
    const template = process.env.E2B_TEMPLATE || "base";

    if (!conversationId) {
      return await runFirstCommand(userId, command, template, sandboxOptions);
    }

    const conversation = getConversation(conversationId);
    if (!conversation || conversation.user_id !== userId) {
      return jsonError("Conversation not found.", 404);
    }

    return await withConversationLock(conversation.id, async () => {
      const sandbox = await getOrCreateSandbox(conversation.id, template, sandboxOptions);
      const result = await runPtyCommand(sandbox, command);
      const messages = recordCommand({
        conversationId: conversation.id,
        command,
        sandboxId: sandbox.sandboxId,
        template,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
      });

      return NextResponse.json({
        conversationId: conversation.id,
        sandboxId: sandbox.sandboxId,
        command,
        result,
        messages,
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonError(message, 500);
  }
}
