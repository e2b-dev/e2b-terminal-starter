import Sandbox from "e2b";
import { NextResponse } from "next/server";
import {
  countRunningSandboxes,
  createConversation,
  listSandboxesForUser,
  listConversations,
  markSandboxStatus,
} from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function refreshSandboxStatuses(userId: string) {
  if (!process.env.E2B_API_KEY) return;

  await Promise.all(
    listSandboxesForUser(userId).map(async (sandbox) => {
      try {
        const info = await Sandbox.getInfo(sandbox.e2b_sandbox_id);
        markSandboxStatus(sandbox.conversation_id, info.state);
      } catch {
        markSandboxStatus(sandbox.conversation_id, "unknown");
      }
    }),
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") || "";
  const user = await getSessionUser();

  if (!user || user.id !== userId) {
    return jsonError("User not found.", 404);
  }

  await refreshSandboxStatuses(userId);

  return NextResponse.json({
    conversations: listConversations(userId),
    runningSandboxCount: countRunningSandboxes(userId),
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { userId?: unknown; title?: unknown };
  const userId = typeof body.userId === "string" ? body.userId : "";
  const title = typeof body.title === "string" ? body.title : undefined;
  const user = await getSessionUser();

  if (!user || user.id !== userId) {
    return jsonError("User not found.", 404);
  }

  return NextResponse.json({ conversation: createConversation(userId, title) });
}
