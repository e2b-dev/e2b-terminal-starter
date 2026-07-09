import type { CommandResponse, Message, SandboxRecord } from "@/lib/contracts";

function terminalText(text: string) {
  return text.replace(/\n/g, "\r\n");
}

export function formatCommandResult(response: CommandResponse) {
  if (!response.result) return "";
  const exitSummary =
    response.result.exitCode === 0
      ? ""
      : `\r\n[exit ${response.result.exitCode}]\r\n`;
  return `${terminalText(response.result.stdout)}${terminalText(
    response.result.stderr,
  )}${exitSummary}`;
}

export function formatConversationHistory(
  messages: Message[],
  sandbox?: SandboxRecord | null,
) {
  if (messages.length === 0) {
    return sandbox?.e2b_sandbox_id
      ? `Connected to sandbox ${sandbox.e2b_sandbox_id}\r\n`
      : "";
  }

  return messages
    .filter(
      (message) => message.role === "user" || message.role === "assistant",
    )
    .map((message) => {
      if (message.role === "user") {
        return `\r\n$ ${message.command || message.content}\r\n`;
      }
      const exitSummary =
        message.exit_code && message.exit_code !== 0
          ? `\r\n[exit ${message.exit_code}]\r\n`
          : "";
      return `${terminalText(message.stdout || "")}${terminalText(
        message.stderr || "",
      )}${exitSummary}`;
    })
    .join("");
}

export function sandboxLabel(sandboxId?: string | null) {
  return sandboxId
    ? `Sandbox ${sandboxId.slice(-8)}`
    : "Starts on first command";
}
