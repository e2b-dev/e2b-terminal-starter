import Sandbox, { SandboxNotFoundError } from "e2b";
import type { User } from "@/lib/contracts";
import { getE2bConfig } from "@/lib/config";
import {
  attachSandbox,
  getSandboxForConversation,
  markSandboxPaused,
  removeSandbox,
  touchSandbox,
} from "@/lib/db";

export class SandboxTrackingError extends Error {
  constructor(
    message: string,
    readonly sandboxId: string,
  ) {
    super(message);
  }
}

async function pauseAfterTrackingFailure(sandboxId: string) {
  await Sandbox.pause(sandboxId).catch(() => undefined);
}

function fallbackExpiry() {
  return new Date(Date.now() + getE2bConfig().timeoutMs);
}

function sandboxOptions(user: User) {
  const { timeoutMs } = getE2bConfig();
  return {
    timeoutMs,
    lifecycle: {
      onTimeout: "pause" as const,
      autoResume: true,
    },
    metadata: {
      user_id: user.id,
      user_name: user.name,
      starter: "e2b-terminal-starter",
    },
  };
}

async function trackSandbox(
  conversationId: string,
  sandbox: Sandbox,
  template: string,
) {
  try {
    attachSandbox(
      conversationId,
      sandbox.sandboxId,
      template,
      fallbackExpiry(),
    );
    const info = await sandbox.getInfo().catch(() => null);
    if (info) touchSandbox(conversationId, info.endAt);
    return sandbox;
  } catch (error) {
    await pauseAfterTrackingFailure(sandbox.sandboxId);
    try {
      markSandboxPaused(conversationId);
    } catch {}
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new SandboxTrackingError(message, sandbox.sandboxId);
  }
}

export async function getOrCreateSandbox(conversationId: string, user: User) {
  const { template, timeoutMs } = getE2bConfig();
  const persisted = getSandboxForConversation(conversationId);
  if (!persisted) {
    const sandbox = await Sandbox.create(template, sandboxOptions(user));
    return trackSandbox(conversationId, sandbox, template);
  }

  try {
    const sandbox = await Sandbox.connect(persisted.e2b_sandbox_id, {
      timeoutMs,
    });
    const info = await sandbox.getInfo().catch(() => null);
    try {
      touchSandbox(conversationId, info?.endAt || fallbackExpiry());
    } catch (error) {
      await pauseAfterTrackingFailure(sandbox.sandboxId);
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new SandboxTrackingError(message, sandbox.sandboxId);
    }
    return sandbox;
  } catch (error) {
    if (!(error instanceof SandboxNotFoundError)) throw error;

    await Sandbox.pause(persisted.e2b_sandbox_id).catch(() => undefined);
    removeSandbox(conversationId);
    const sandbox = await Sandbox.create(template, sandboxOptions(user));
    return trackSandbox(conversationId, sandbox, template);
  }
}

export function pauseSandbox(sandboxId: string) {
  return Sandbox.pause(sandboxId);
}
