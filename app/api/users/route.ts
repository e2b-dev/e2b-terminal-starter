import { NextResponse } from "next/server";
import { upsertUser } from "@/lib/db";
import { setSessionUser } from "@/lib/session";

export const runtime = "nodejs";

function isLocalRequest(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = (forwardedHost || request.headers.get("host") || new URL(request.url).host)
    .split(",")[0]
    .trim();
  const hostname = host.startsWith("[")
    ? host.slice(1, host.indexOf("]"))
    : host.split(":")[0];

  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function localAuthEnabled(request: Request) {
  return isLocalRequest(request) || process.env.APP_ENABLE_LOCAL_AUTH === "true";
}

export async function POST(request: Request) {
  if (!localAuthEnabled(request)) {
    return NextResponse.json(
      {
        error:
          "Local starter auth is disabled outside localhost. Add real auth or set APP_ENABLE_LOCAL_AUTH=true to opt in.",
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
