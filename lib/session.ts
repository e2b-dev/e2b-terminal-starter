import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/db";

const SESSION_COOKIE = "e2b_terminal_starter_user";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function sessionSecret() {
  return process.env.APP_SESSION_SECRET || process.env.E2B_API_KEY || "local-dev-session-secret";
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function sealUserId(userId: string) {
  return `${userId}.${sign(userId)}`;
}

function openUserId(value: string | undefined) {
  if (!value) return null;

  const separator = value.lastIndexOf(".");
  if (separator <= 0) return null;

  const userId = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const expected = sign(userId);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  return userId;
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const userId = openUserId(cookieStore.get(SESSION_COOKIE)?.value);
  return userId ? getUser(userId) || null : null;
}

export function setSessionUser(response: NextResponse, userId: string) {
  response.cookies.set(SESSION_COOKIE, sealUserId(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}
