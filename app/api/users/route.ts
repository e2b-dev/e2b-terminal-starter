import { NextResponse } from "next/server";
import { createUser, renameUser } from "@/lib/db";
import { getSessionUser, setSessionUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { name?: unknown };
  const name = typeof body.name === "string" ? body.name : "";

  try {
    const sessionUser = await getSessionUser();
    const user = sessionUser ? renameUser(sessionUser.id, name) : createUser(name);
    if (!user) {
      return NextResponse.json({ error: "Could not load user." }, { status: 404 });
    }

    const response = NextResponse.json({ user });
    setSessionUser(response, user.id);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
