"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import TerminalPanel, { TerminalPanelHandle } from "./terminal-panel";

type Config = {
  hasE2bApiKey: boolean;
  template: string;
};

type User = {
  id: string;
  name: string;
  created_at: string;
};

type Conversation = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  e2b_sandbox_id?: string | null;
  sandbox_status?: "running" | "paused" | "unknown" | null;
  last_message?: string | null;
};

type SandboxRecord = {
  e2b_sandbox_id: string;
  template: string;
  status?: "running" | "paused" | "unknown";
};

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  command: string | null;
  exit_code: number | null;
  stdout: string | null;
  stderr: string | null;
};

type CommandResponse = {
  conversationId: string;
  sandboxId: string;
  command: string;
  result: {
    exitCode: number;
    stdout: string;
    stderr: string;
    error?: string;
  };
  error?: string;
};

const DEFAULT_COMMAND = "python3 --version && pwd";
const DEFAULT_USER_NAME = "demo";

function commandOutput(command: string, response: CommandResponse) {
  const stdout = response.result.stdout.replace(/\n/g, "\r\n");
  const stderr = response.result.stderr.replace(/\n/g, "\r\n");
  const exitSummary =
    response.result.exitCode === 0
      ? ""
      : `\r\n[exit ${response.result.exitCode}]\r\n`;

  return `\r\n$ ${command}\r\n${stdout}${stderr}${exitSummary}`;
}

function messagesOutput(messages: Message[], sandbox?: SandboxRecord | null) {
  if (messages.length === 0) {
    return sandbox?.e2b_sandbox_id
      ? `Connected to sandbox ${sandbox.e2b_sandbox_id}\r\n`
      : "";
  }

  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => {
      if (message.role === "user") {
        return `\r\n$ ${message.command || message.content}\r\n`;
      }

      const stdout = (message.stdout || "").replace(/\n/g, "\r\n");
      const stderr = (message.stderr || "").replace(/\n/g, "\r\n");
      const exitSummary =
        message.exit_code && message.exit_code !== 0
          ? `\r\n[exit ${message.exit_code}]\r\n`
          : "";

      return `${stdout}${stderr}${exitSummary}`;
    })
    .join("");
}

export default function Home() {
  const [config, setConfig] = useState<Config | null>(null);
  const [name, setName] = useState(DEFAULT_USER_NAME);
  const [user, setUser] = useState<User | null>(null);
  const [command, setCommand] = useState(DEFAULT_COMMAND);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [activeSandboxId, setActiveSandboxId] = useState("");
  const [runningSandboxCount, setRunningSandboxCount] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pausingConversationId, setPausingConversationId] = useState("");
  const terminalRef = useRef<TerminalPanelHandle>(null);
  const defaultUserLoadedRef = useRef(false);

  useEffect(() => {
    fetch("/api/config")
      .then((response) => response.json())
      .then(setConfig)
      .catch(() =>
        setConfig({
          hasE2bApiKey: false,
          template: "base",
        }),
      );
  }, []);

  useEffect(() => {
    if (defaultUserLoadedRef.current) return;

    defaultUserLoadedRef.current = true;
    void useLocalUser(DEFAULT_USER_NAME);
  }, []);

  async function loadConversations(userId: string, nextActiveId?: string) {
    const response = await fetch(
      `/api/conversations?userId=${encodeURIComponent(userId)}`,
    );
    const data = (await response.json()) as {
      conversations?: Conversation[];
      runningSandboxCount?: number;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error || "Could not load conversations");
    }

    const nextConversations = data.conversations || [];
    setConversations(nextConversations);
    setRunningSandboxCount(data.runningSandboxCount || 0);

    const activeId = nextActiveId || activeConversationId;
    if (activeId && nextConversations.some((item) => item.id === activeId)) {
      return activeId;
    }

    return nextConversations[0]?.id || "";
  }

  async function selectConversation(conversationId: string, ownerUserId = user?.id || "") {
    if (!conversationId) {
      setActiveConversationId("");
      setActiveSandboxId("");
      terminalRef.current?.reset();
      return;
    }

    setActiveConversationId(conversationId);
    setActiveSandboxId("");
    terminalRef.current?.reset();
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/conversations/${conversationId}?userId=${encodeURIComponent(ownerUserId)}`,
      );
      const data = (await response.json()) as {
        conversation?: Conversation;
        sandbox?: SandboxRecord | null;
        messages?: Message[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Could not load conversation");
      }

      setActiveSandboxId(data.sandbox?.e2b_sandbox_id || "");
      terminalRef.current?.write(
        messagesOutput(data.messages || [], data.sandbox || null),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      terminalRef.current?.write(`\r\nERROR: ${message}\r\n`);
    } finally {
      setIsLoading(false);
    }
  }

  async function useLocalUser(nextName: string) {
    setIsLoading(true);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });
      const data = (await response.json()) as { user?: User; error?: string };

      if (!response.ok || !data.user) {
        throw new Error(data.error || "Could not create user");
      }

      setUser(data.user);
      setName(data.user.name);
      const activeId = await loadConversations(data.user.id);
      await selectConversation(activeId, data.user.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      terminalRef.current?.write(`\r\nERROR: ${message}\r\n`);
    } finally {
      setIsLoading(false);
    }
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await useLocalUser(name);
  }

  async function createNewConversation() {
    if (!user) return;

    setActiveConversationId("");
    setActiveSandboxId("");
    terminalRef.current?.reset();
    setIsLoading(true);
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = (await response.json()) as {
        conversation?: Conversation;
        error?: string;
      };

      if (!response.ok || !data.conversation) {
        throw new Error(data.error || "Could not create conversation");
      }

      await loadConversations(user.id, data.conversation.id);
      await selectConversation(data.conversation.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      terminalRef.current?.write(`\r\nERROR: ${message}\r\n`);
    } finally {
      setIsLoading(false);
    }
  }

  async function pauseConversation(conversation: Conversation) {
    if (!user || !conversation.e2b_sandbox_id) return;

    setPausingConversationId(conversation.id);
    try {
      const response = await fetch(
        `/api/conversations/${conversation.id}/pause`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        },
      );
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Could not pause sandbox");
      }

      await loadConversations(user.id, activeConversationId);
      if (activeConversationId === conversation.id) {
        terminalRef.current?.write(
          `\r\n[paused sandbox ${conversation.e2b_sandbox_id}]\r\n`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      terminalRef.current?.write(`\r\nERROR: ${message}\r\n`);
    } finally {
      setPausingConversationId("");
    }
  }

  async function runCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    setIsRunning(true);
    terminalRef.current?.write(`\r\n$ ${command}\r\n`);

    try {
      const response = await fetch("/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command,
          userId: user.id,
          conversationId: activeConversationId || undefined,
        }),
      });
      const data = (await response.json()) as CommandResponse;

      if (!response.ok) {
        throw new Error(data.error || "Command failed");
      }

      setActiveConversationId(data.conversationId);
      setActiveSandboxId(data.sandboxId);
      terminalRef.current?.write(commandOutput(command, data).replace(`\r\n$ ${command}\r\n`, ""));
      await loadConversations(user.id, data.conversationId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      terminalRef.current?.write(`\r\nERROR: ${message}\r\n`);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="mark">E2B</div>
          <div>
            <h1>E2B Terminal Starter</h1>
            <p>Persistent users, conversations, and E2B sandbox sessions.</p>
          </div>
        </div>
        <div className="status">
          <span className={`dot ${config?.hasE2bApiKey ? "ready" : ""}`} />
          {config?.hasE2bApiKey ? "E2B_API_KEY loaded" : "E2B_API_KEY missing"}
        </div>
      </header>

      <section className="workspace">
        <aside className="sidebar">
          <form className="field" onSubmit={signIn}>
            <label htmlFor="name">Local user</label>
            <div className="inline-form">
              <input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Name"
              />
              <button className="compact-button" disabled={isLoading} type="submit">
                Change
              </button>
            </div>
          </form>

          <div className="identity">
            <span>User uuid</span>
            <code>{user?.id || "not signed in"}</code>
          </div>

          <div className="identity">
            <span>Template</span>
            <code>{config?.template || "base"}</code>
          </div>

          <div className="identity">
            <span>Running sandboxes</span>
            <code>{runningSandboxCount}</code>
          </div>

          <div className="history">
            <div className="history-heading">
              <span className="history-title">Conversations</span>
              <button
                className="new-button"
                disabled={!user || isLoading}
                onClick={createNewConversation}
                type="button"
              >
                New
              </button>
            </div>
            <div className="history-list">
              {!user ? (
                <div className="identity">
                  <span>No user selected</span>
                  <code>Enter a name to create a user.</code>
                </div>
              ) : conversations.length === 0 ? (
                <div className="identity">
                  <span>No conversations yet</span>
                  <code>Run a command to create one.</code>
                </div>
              ) : (
                conversations.map((conversation) => (
                  <div
                    className={`history-item ${
                      activeConversationId === conversation.id ? "active" : ""
                    }`}
                    key={conversation.id}
                  >
                    <button
                      className="history-select"
                      onClick={() => selectConversation(conversation.id)}
                      type="button"
                    >
                      <strong>{conversation.title}</strong>
                      <small>
                        {conversation.e2b_sandbox_id || "sandbox on first run"}
                      </small>
                      <small>{conversation.sandbox_status || "not started"}</small>
                    </button>
                    <button
                      aria-label={`Pause ${conversation.title}`}
                      className="pause-button"
                      disabled={
                        !conversation.e2b_sandbox_id ||
                        conversation.sandbox_status === "paused" ||
                        pausingConversationId === conversation.id
                      }
                      onClick={() => pauseConversation(conversation)}
                      title="Pause sandbox"
                      type="button"
                    >
                      {pausingConversationId === conversation.id ? "..." : "Pause"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        <section className="main">
          <div className="terminal">
            <TerminalPanel
              ref={terminalRef}
              sandboxId={activeSandboxId || undefined}
              template={config?.template || "base"}
              title={activeConversationId ? "Conversation sandbox" : "New conversation"}
            />

            <form className="command-row" onSubmit={runCommand}>
              <textarea
                className="command"
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                rows={2}
                spellCheck={false}
              />
              <button
                className="run"
                disabled={isRunning || isLoading || !config?.hasE2bApiKey || !user}
                type="submit"
              >
                {isRunning ? "Running" : "Run"}
              </button>
            </form>
          </div>
        </section>
      </section>
    </main>
  );
}
