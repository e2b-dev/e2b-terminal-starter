import { NextResponse } from "next/server";
import { upsertUser } from "@/lib/db";
import { setSessionUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { name?: unknown };
  const name = typeof body.name === "string" ? body.name : "";

  try {
    const user = upsertUser(name);
    const response = NextResponse.json({ user });
    setSessionUser(response, user.id);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
