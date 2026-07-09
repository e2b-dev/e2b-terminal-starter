"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ConfigResponse,
  ConversationListItem,
  User,
} from "@/lib/contracts";
import {
  createConversation as createConversationRequest,
  getConfig,
  getConversation,
  getConversations,
  pauseConversation as pauseConversationRequest,
  runCommand as runCommandRequest,
  selectLocalUser,
} from "./api-client";
import {
  formatCommandResult,
  formatConversationHistory,
} from "./terminal-format";
import type { TerminalPanelHandle } from "./components/terminal-panel";

const DEFAULT_COMMAND = "python3 --version && pwd";
const DEFAULT_USER_NAME = "demo";

export function useTerminalApp() {
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [name, setName] = useState(DEFAULT_USER_NAME);
  const [user, setUser] = useState<User | null>(null);
  const [command, setCommand] = useState(DEFAULT_COMMAND);
  const [conversations, setConversations] = useState<ConversationListItem[]>(
    [],
  );
  const [activeConversationId, setActiveConversationId] = useState("");
  const [activeSandboxId, setActiveSandboxId] = useState("");
  const [runningSandboxCount, setRunningSandboxCount] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pausingConversationId, setPausingConversationId] = useState("");

  const terminalRef = useRef<TerminalPanelHandle>(null);
  const defaultUserLoadedRef = useRef(false);
  const activeConversationIdRef = useRef("");
  const selectionRequestRef = useRef(0);
  const commandInFlightRef = useRef(false);

  const isBusy = isLoading || isRunning || Boolean(pausingConversationId);
  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  );

  function setActiveConversation(conversationId: string) {
    activeConversationIdRef.current = conversationId;
    setActiveConversationId(conversationId);
  }

  useEffect(() => {
    getConfig()
      .then(setConfig)
      .catch(() => setConfig({ hasE2bApiKey: false, template: "base" }));
  }, []);

  useEffect(() => {
    if (defaultUserLoadedRef.current) return;
    defaultUserLoadedRef.current = true;
    void selectUser(DEFAULT_USER_NAME);
  }, []);

  async function refreshConversations(nextActiveId?: string) {
    const data = await getConversations();
    setConversations(data.conversations);
    setRunningSandboxCount(data.runningSandboxCount);

    const activeId = nextActiveId || activeConversationIdRef.current;
    if (activeId && data.conversations.some((item) => item.id === activeId)) {
      return activeId;
    }
    return data.conversations[0]?.id || "";
  }

  async function loadConversation(conversationId: string, requestId: number) {
    const data = await getConversation(conversationId);
    if (selectionRequestRef.current !== requestId) return;
    setActiveSandboxId(data.sandbox?.e2b_sandbox_id || "");
    terminalRef.current?.write(
      formatConversationHistory(data.messages, data.sandbox),
    );
  }

  async function selectConversation(conversationId: string) {
    const requestId = ++selectionRequestRef.current;
    setActiveConversation(conversationId);
    setActiveSandboxId("");
    terminalRef.current?.reset();
    if (!conversationId) return;

    setIsLoading(true);
    try {
      await loadConversation(conversationId, requestId);
    } catch (error) {
      if (selectionRequestRef.current !== requestId) return;
      writeError(error);
    } finally {
      if (selectionRequestRef.current === requestId) setIsLoading(false);
    }
  }

  async function selectUser(nextName: string) {
    const requestId = ++selectionRequestRef.current;
    setIsLoading(true);
    setUser(null);
    setActiveConversation("");
    setActiveSandboxId("");
    setConversations([]);
    terminalRef.current?.reset();

    try {
      const data = await selectLocalUser(nextName);
      setUser(data.user);
      setName(data.user.name);

      let activeId = await refreshConversations();
      if (!activeId) {
        const conversation = await createConversationRequest(true);
        activeId = conversation.id;
        await refreshConversations(activeId);
      }
      if (selectionRequestRef.current !== requestId) return;
      setActiveConversation(activeId);
      await loadConversation(activeId, requestId);
    } catch (error) {
      if (selectionRequestRef.current !== requestId) return;
      writeError(error);
    } finally {
      if (selectionRequestRef.current === requestId) setIsLoading(false);
    }
  }

  async function createConversation() {
    if (!user) return;
    const requestId = ++selectionRequestRef.current;
    setIsLoading(true);
    try {
      const conversation = await createConversationRequest();
      if (selectionRequestRef.current !== requestId) return;
      const conversationItem: ConversationListItem = {
        ...conversation,
        e2b_sandbox_id: null,
        sandbox_status: null,
      };
      setConversations((current) => [
        conversationItem,
        ...current.filter((item) => item.id !== conversation.id),
      ]);
      setActiveConversation(conversation.id);
      setActiveSandboxId("");
      terminalRef.current?.reset();

      try {
        await refreshConversations(conversation.id);
      } catch {
        terminalRef.current?.write(
          "\r\nWARNING: Conversation created, but the list could not be refreshed.\r\n",
        );
      }
      await loadConversation(conversation.id, requestId);
    } catch (error) {
      if (selectionRequestRef.current !== requestId) return;
      writeError(error);
    } finally {
      if (selectionRequestRef.current === requestId) setIsLoading(false);
    }
  }

  async function pauseConversation(conversation: ConversationListItem) {
    if (!conversation.e2b_sandbox_id) return;
    setPausingConversationId(conversation.id);
    try {
      const data = await pauseConversationRequest(conversation.id);
      setConversations((current) =>
        current.map((item) =>
          item.id === conversation.id
            ? { ...item, sandbox_status: "paused" }
            : item,
        ),
      );
      setRunningSandboxCount((current) => Math.max(0, current - 1));
      if (data.warning) {
        terminalRef.current?.write(`\r\nWARNING: ${data.warning}\r\n`);
      }
      try {
        await refreshConversations(activeConversationIdRef.current);
      } catch {
        terminalRef.current?.write(
          "\r\nWARNING: Sandbox paused, but the conversation list could not be refreshed.\r\n",
        );
      }
    } catch (error) {
      writeError(error);
    } finally {
      setPausingConversationId("");
    }
  }

  async function runCommand() {
    const commandToRun = command.trim();
    const conversationId = activeConversationIdRef.current;
    if (
      !user ||
      !conversationId ||
      !commandToRun ||
      !config?.hasE2bApiKey ||
      commandInFlightRef.current ||
      isLoading ||
      pausingConversationId
    ) {
      return;
    }

    commandInFlightRef.current = true;
    setCommand("");
    setIsRunning(true);
    terminalRef.current?.write(`\r\n$ ${commandToRun}\r\n`);
    try {
      const data = await runCommandRequest(conversationId, commandToRun);
      if (activeConversationIdRef.current !== conversationId) return;

      setActiveSandboxId(data.sandboxId || "");
      terminalRef.current?.write(formatCommandResult(data));
      if (data.warning) {
        terminalRef.current?.write(`\r\nWARNING: ${data.warning}\r\n`);
      }
      try {
        await refreshConversations(conversationId);
      } catch {
        terminalRef.current?.write(
          "\r\nWARNING: Command ran, but the conversation list could not be refreshed.\r\n",
        );
      }
    } catch (error) {
      if (activeConversationIdRef.current !== conversationId) return;
      await refreshConversations(conversationId).catch(() => undefined);
      writeError(error);
    } finally {
      commandInFlightRef.current = false;
      setIsRunning(false);
    }
  }

  function writeError(error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    terminalRef.current?.write(`\r\nERROR: ${message}\r\n`);
  }

  return {
    activeConversation,
    activeConversationId,
    activeSandboxId,
    command,
    config,
    conversations,
    createConversation,
    isBusy,
    isLoading,
    isRunning,
    name,
    pauseConversation,
    pausingConversationId,
    runCommand,
    runningSandboxCount,
    selectConversation,
    selectUser,
    setCommand,
    setName,
    terminalRef,
    user,
  };
}
