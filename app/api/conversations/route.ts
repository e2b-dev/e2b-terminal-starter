import { NextResponse } from "next/server";
import {
  countRunningSandboxes,
  createConversation,
  getUser,
  listConversations,
} from "@/lib/db";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") || "";

  if (!getUser(userId)) {
    return jsonError("User not found.", 404);
  }

  return NextResponse.json({
    conversations: listConversations(userId),
    runningSandboxCount: countRunningSandboxes(userId),
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { userId?: unknown; title?: unknown };
  const userId = typeof body.userId === "string" ? body.userId : "";
  const title = typeof body.title === "string" ? body.title : undefined;

  if (!getUser(userId)) {
    return jsonError("User not found.", 404);
  }

  return NextResponse.json({ conversation: createConversation(userId, title) });
}
