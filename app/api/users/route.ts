import { NextResponse } from "next/server";
import { upsertUser } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { name?: unknown };
  const name = typeof body.name === "string" ? body.name : "";

  try {
    return NextResponse.json({ user: upsertUser(name) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
