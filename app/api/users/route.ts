import { NextResponse } from "next/server";
import { setCurrentUser } from "@/lib/auth";
import { localAuthEnabled } from "@/lib/config";
import { upsertUser } from "@/lib/db";
import { readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!localAuthEnabled()) {
    return NextResponse.json(
      {
        error:
          "Local starter auth is disabled. Add real auth or set APP_ENABLE_LOCAL_AUTH=true to opt in.",
      },
      { status: 403 },
    );
  }

  const parsed = await readJson<{ name?: unknown }>(request);
  if (parsed.error) return parsed.error;
  const name = typeof parsed.data.name === "string" ? parsed.data.name : "";

  try {
    const user = upsertUser(name);
    const response = NextResponse.json({ user });
    setCurrentUser(response, user.id);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
