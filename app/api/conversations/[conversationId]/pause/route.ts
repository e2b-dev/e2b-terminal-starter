import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getE2bConfig } from "@/lib/config";
import {
  getConversation,
  getSandboxForConversation,
  markSandboxPaused,
} from "@/lib/db";
import { pauseSandbox } from "@/lib/e2b/sandbox";
import { jsonError } from "@/lib/http";
import { withConversationLock } from "@/lib/conversation-lock";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  if (!getE2bConfig().apiKey) {
    return jsonError("Missing E2B_API_KEY.", 500);
  }

  const { conversationId } = await params;
  const user = await getCurrentUser();
  const conversation = getConversation(conversationId);

  if (!user || !conversation || conversation.user_id !== user.id) {
    return jsonError("Conversation not found.", 404);
  }

  return withConversationLock(conversationId, async () => {
    const sandbox = getSandboxForConversation(conversationId);
    if (!sandbox) {
      return jsonError("Conversation has no sandbox yet.", 409);
    }

    try {
      await pauseSandbox(sandbox.e2b_sandbox_id);
      let warning: string | undefined;
      try {
        markSandboxPaused(conversationId);
      } catch {
        warning = "Sandbox paused, but its local status could not be saved.";
      }

      return NextResponse.json({
        sandbox: {
          ...sandbox,
          status: "paused",
        },
        warning,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return jsonError(message, 500);
    }
  });
}
