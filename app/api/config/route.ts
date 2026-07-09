import { NextResponse } from "next/server";
import { getE2bConfig } from "@/lib/config";

export const runtime = "nodejs";

export async function GET() {
  const config = getE2bConfig();
  return NextResponse.json({
    hasE2bApiKey: Boolean(config.apiKey),
    template: config.template,
  });
}
