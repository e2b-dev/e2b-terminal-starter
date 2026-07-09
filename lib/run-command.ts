import type { CommandResponse, Conversation, User } from "@/lib/contracts";
import { getE2bConfig } from "@/lib/config";
import { withConversationLock } from "@/lib/conversation-lock";
import { recordCommand } from "@/lib/db";
import { runPtyCommand } from "@/lib/e2b/pty";
import { getOrCreateSandbox, SandboxTrackingError } from "@/lib/e2b/sandbox";

export class CommandExecutionError extends Error {
  constructor(
    message: string,
    readonly sandboxId?: string,
  ) {
    super(message);
  }
}

export function runCommand(params: {
  conversation: Conversation;
  command: string;
  user: User;
}) {
  const { conversation, command, user } = params;
  return withConversationLock(conversation.id, async () => {
    let sandboxId: string | undefined;

    try {
      const sandbox = await getOrCreateSandbox(conversation.id, user);
      sandboxId = sandbox.sandboxId;
      const result = await runPtyCommand(
        sandbox,
        command,
        getE2bConfig().timeoutMs,
      );
      let warning: string | undefined;
      let messages: CommandResponse["messages"];

      try {
        messages = recordCommand({
          conversationId: conversation.id,
          command,
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
        });
      } catch {
        warning = "Command ran, but its history could not be saved.";
      }

      return {
        conversationId: conversation.id,
        sandboxId,
        command,
        result,
        messages,
        warning,
      } satisfies CommandResponse;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new CommandExecutionError(
        message,
        error instanceof SandboxTrackingError ? error.sandboxId : sandboxId,
      );
    }
  });
}
