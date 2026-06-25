import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    hasE2bApiKey: Boolean(process.env.E2B_API_KEY),
    template: process.env.E2B_TEMPLATE || "base",
    apiUrl: process.env.E2B_API_URL || "https://api.e2b.dev",
  });
}
