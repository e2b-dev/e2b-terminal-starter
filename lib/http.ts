import { NextResponse } from "next/server";

export function jsonError(
  message: string,
  status = 400,
  details: Record<string, unknown> = {},
) {
  return NextResponse.json({ error: message, ...details }, { status });
}

export async function readJson<T>(request: Request) {
  try {
    const data = await request.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return {
        data: null,
        error: jsonError("Request body must be a JSON object."),
      };
    }
    return { data: data as T, error: null };
  } catch {
    return {
      data: null,
      error: jsonError("Request body must be valid JSON."),
    };
  }
}
