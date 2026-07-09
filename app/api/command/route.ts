import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getE2bConfig, MAX_COMMAND_CHARS } from "@/lib/config";
import { getConversation } from "@/lib/db";
import { jsonError, readJson } from "@/lib/http";
import { CommandExecutionError, runCommand } from "@/lib/run-command";

export const runtime = "nodejs";

type CommandBody = {
  command?: unknown;
  conversationId?: unknown;
};

export async function POST(request: Request) {
  if (!getE2bConfig().apiKey) {
    return jsonError(
      "Missing E2B_API_KEY. Run `stripe projects env --pull` or copy .env.example to .env.local.",
      500,
    );
  }

  const parsed = await readJson<CommandBody>(request);
  if (parsed.error) return parsed.error;

  const command =
    typeof parsed.data.command === "string" ? parsed.data.command.trim() : "";
  const conversationId =
    typeof parsed.data.conversationId === "string"
      ? parsed.data.conversationId.trim()
      : "";
  if (!command) return jsonError("Command is required.");
  if (command.length > MAX_COMMAND_CHARS) {
    return jsonError("Command must be 16,000 characters or fewer.", 413);
  }
  if (!conversationId) return jsonError("Conversation is required.");

  const user = await getCurrentUser();
  const conversation = getConversation(conversationId);
  if (!user || !conversation || conversation.user_id !== user.id) {
    return jsonError("Conversation not found.", 404);
  }

  try {
    return NextResponse.json(await runCommand({ conversation, command, user }));
  } catch (error) {
    const executionError =
      error instanceof CommandExecutionError
        ? error
        : new CommandExecutionError(
            error instanceof Error ? error.message : "Unknown error",
          );
    return jsonError(executionError.message, 500, {
      conversationId,
      sandboxId: executionError.sandboxId,
    });
  }
}
