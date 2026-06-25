import Sandbox from "e2b";
import { NextResponse } from "next/server";
import {
  attachSandbox,
  createConversation,
  getConversation,
  getSandboxForConversation,
  getUser,
  recordCommand,
  touchSandbox,
} from "@/lib/db";

export const runtime = "nodejs";

type CommandBody = {
  command?: unknown;
  userId?: unknown;
  conversationId?: unknown;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getTimeoutMs() {
  const timeout = Number(process.env.E2B_TIMEOUT_MS);
  return Number.isFinite(timeout) && timeout > 0 ? timeout : 300_000;
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

  const user = getUser(userId);
  if (!user) {
    return jsonError("User not found.", 404);
  }

  const sandboxOptions = {
    timeoutMs: getTimeoutMs(),
    metadata: {
      user_id: userId,
      user_name: user.name,
      starter: "e2b-terminal-starter",
    },
  };

  try {
    const conversation = conversationId
      ? getConversation(conversationId)
      : createConversation(userId);

    if (!conversation || conversation.user_id !== userId) {
      return jsonError("Conversation not found.", 404);
    }

    const template = process.env.E2B_TEMPLATE || "base";
    const persistedSandbox = getSandboxForConversation(conversation.id);
    const sandbox = persistedSandbox
      ? await Sandbox.connect(persistedSandbox.e2b_sandbox_id, {
          timeoutMs: getTimeoutMs(),
        })
      : await Sandbox.create(template, sandboxOptions);

    if (persistedSandbox) {
      touchSandbox(conversation.id);
    } else {
      attachSandbox(conversation.id, sandbox.sandboxId, template);
    }

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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonError(message, 500);
  }
}
