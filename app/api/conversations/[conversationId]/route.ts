import { NextResponse } from "next/server";
import {
  getConversation,
  getSandboxForConversation,
  listMessages,
} from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;
  const conversation = getConversation(conversationId);

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  return NextResponse.json({
    conversation,
    sandbox: getSandboxForConversation(conversationId) || null,
    messages: listMessages(conversationId),
  });
}
