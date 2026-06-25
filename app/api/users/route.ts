import { NextResponse } from "next/server";
import { upsertUser } from "@/lib/db";
import { setSessionUser } from "@/lib/session";

export const runtime = "nodejs";

function localAuthEnabled() {
  if (process.env.APP_ENABLE_LOCAL_AUTH) {
    return process.env.APP_ENABLE_LOCAL_AUTH === "true";
  }

  return process.env.NODE_ENV !== "production";
}

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
