import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  countRunningSandboxes,
  createConversation,
  getOrCreateInitialConversation,
  listConversations,
  reconcileExpiredSandboxes,
} from "@/lib/db";
import { jsonError, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return jsonError("User not found.", 404);
  }

  reconcileExpiredSandboxes();

  return NextResponse.json({
    conversations: listConversations(user.id),
    runningSandboxCount: countRunningSandboxes(user.id),
  });
}

export async function POST(request: Request) {
  const parsed = await readJson<{ initial?: unknown; title?: unknown }>(
    request,
  );
  if (parsed.error) return parsed.error;
  const title =
    typeof parsed.data.title === "string" ? parsed.data.title : undefined;
  const user = await getCurrentUser();

  if (!user) {
    return jsonError("User not found.", 404);
  }

  return NextResponse.json({
    conversation:
      parsed.data.initial === true
        ? getOrCreateInitialConversation(user.id)
        : createConversation(user.id, title),
  });
}
