import Sandbox from "e2b";
import { NextResponse } from "next/server";
import {
  getConversation,
  getSandboxForConversation,
  getUser,
  markSandboxPaused,
} from "@/lib/db";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  if (!process.env.E2B_API_KEY) {
    return jsonError("Missing E2B_API_KEY.", 500);
  }

  const body = (await request.json()) as { userId?: unknown };
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const { conversationId } = await params;
  const user = getUser(userId);
  const conversation = getConversation(conversationId);

  if (!user || !conversation || conversation.user_id !== user.id) {
    return jsonError("Conversation not found.", 404);
  }

  const sandbox = getSandboxForConversation(conversationId);
  if (!sandbox) {
    return jsonError("Conversation has no sandbox yet.", 409);
  }

  try {
    await Sandbox.pause(sandbox.e2b_sandbox_id);
    markSandboxPaused(conversationId);

    return NextResponse.json({
      sandbox: {
        ...sandbox,
        status: "paused",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonError(message, 500);
  }
}
