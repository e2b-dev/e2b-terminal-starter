"use client";

import { useState } from "react";
import AppHeader from "./components/app-header";
import CommandComposer from "./components/command-composer";
import ConversationSidebar from "./components/conversation-sidebar";
import TerminalPanel from "./components/terminal-panel";
import styles from "./terminal-app.module.css";
import { useTerminalApp } from "./use-terminal-app";

export default function TerminalApp() {
  const app = useTerminalApp();
  const [terminalReady, setTerminalReady] = useState(false);

  return (
    <main className={styles.shell}>
      <AppHeader config={app.config} />
      <section className={styles.workspace}>
        <ConversationSidebar
          activeConversationId={app.activeConversationId}
          conversations={app.conversations}
          isBusy={app.isBusy}
          isLoading={app.isLoading}
          name={app.name}
          onCreateConversation={app.createConversation}
          onNameChange={app.setName}
          onPauseConversation={app.pauseConversation}
          onSelectConversation={app.selectConversation}
          onSelectUser={app.selectUser}
          pausingConversationId={app.pausingConversationId}
          runningSandboxCount={app.runningSandboxCount}
          template={app.config?.template || "base"}
          user={app.user}
        />

        <section className={styles.main}>
          <div className={styles.terminal}>
            <TerminalPanel
              ref={app.terminalRef}
              onReadyChange={setTerminalReady}
              sandboxId={app.activeSandboxId || undefined}
              status={app.activeConversation?.sandbox_status || "not-started"}
              title={app.activeConversation?.title || "New conversation"}
            />
            <CommandComposer
              command={app.command}
              disabled={
                app.isBusy ||
                !app.config?.hasE2bApiKey ||
                !terminalReady ||
                !app.user ||
                !app.activeConversationId
              }
              isRunning={app.isRunning}
              onChange={app.setCommand}
              onRun={app.runCommand}
              ready={terminalReady}
              selectionKey={app.activeConversationId}
            />
          </div>
        </section>
      </section>
    </main>
  );
}
