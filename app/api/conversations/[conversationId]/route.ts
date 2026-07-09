import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getConversation,
  getSandboxForConversation,
  listMessages,
  reconcileExpiredSandboxes,
} from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;
  const user = await getCurrentUser();
  const conversation = getConversation(conversationId);

  if (!user || !conversation || conversation.user_id !== user.id) {
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 },
    );
  }

  reconcileExpiredSandboxes();

  return NextResponse.json({
    conversation,
    sandbox: getSandboxForConversation(conversationId) || null,
    messages: listMessages(conversationId),
  });
}
