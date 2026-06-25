import Sandbox from "e2b";
import { NextResponse } from "next/server";
import {
  attachSandbox,
  createConversation,
  getConversation,
  getSandboxForConversation,
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

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getTimeoutMs() {
  const timeout = Number(process.env.E2B_TIMEOUT_MS);
  return Number.isFinite(timeout) && timeout > 0 ? timeout : 300_000;
}

async function withConversationLock<T>(conversationId: string, run: () => Promise<T>) {
  const previous = conversationLocks.get(conversationId) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const next = previous.then(() => current, () => current);
  conversationLocks.set(conversationId, next);

  await previous.catch(() => undefined);
  try {
    return await run();
  } finally {
    release();
    if (conversationLocks.get(conversationId) === next) {
      conversationLocks.delete(conversationId);
    }
  }
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
  } catch {
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
      const sandbox = await Sandbox.create(template, sandboxOptions);
      let result: Awaited<ReturnType<typeof sandbox.commands.run>>;
      try {
        result = await sandbox.commands.run(command, {
          timeoutMs: 60_000,
        });
      } catch (error) {
        await Sandbox.pause(sandbox.sandboxId).catch(() => undefined);
        throw error;
      }

      const conversation = createConversation(userId);
      attachSandbox(conversation.id, sandbox.sandboxId, template);
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
    }

    const conversation = getConversation(conversationId);
    if (!conversation || conversation.user_id !== userId) {
      return jsonError("Conversation not found.", 404);
    }

    return await withConversationLock(conversation.id, async () => {
      const sandbox = await getOrCreateSandbox(conversation.id, template, sandboxOptions);
      const result = await sandbox.commands.run(command, {
        timeoutMs: 60_000,
      });
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
