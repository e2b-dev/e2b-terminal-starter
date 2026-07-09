import path from "node:path";

const DEFAULT_E2B_TEMPLATE = "base";
const DEFAULT_E2B_TIMEOUT_MS = 300_000;

export const MAX_COMMAND_CHARS = 16_000;
export const MAX_PTY_OUTPUT_CHARS = 256_000;

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getE2bConfig() {
  return {
    apiKey: process.env.E2B_API_KEY || "",
    template: process.env.E2B_TEMPLATE || DEFAULT_E2B_TEMPLATE,
    timeoutMs: positiveNumber(
      process.env.E2B_TIMEOUT_MS,
      DEFAULT_E2B_TIMEOUT_MS,
    ),
  };
}

export function getDatabasePath() {
  return (
    process.env.APP_DATABASE_PATH || path.join(process.cwd(), "data", "app.db")
  );
}

export function localAuthEnabled() {
  if (process.env.APP_ENABLE_LOCAL_AUTH) {
    return process.env.APP_ENABLE_LOCAL_AUTH === "true";
  }

  return process.env.NODE_ENV !== "production";
}
