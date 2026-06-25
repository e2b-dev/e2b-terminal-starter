import { NextResponse } from "next/server";
import {
  getConversation,
  getSandboxForConversation,
  listMessages,
} from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") || "";
  const { conversationId } = await params;
  const user = await getSessionUser();
  const conversation = getConversation(conversationId);

  if (!user || user.id !== userId || !conversation || conversation.user_id !== user.id) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  return NextResponse.json({
    conversation,
    sandbox: getSandboxForConversation(conversationId) || null,
    messages: listMessages(conversationId),
  });
}
