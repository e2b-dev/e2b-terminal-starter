"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export type TerminalPanelHandle = {
  write: (text: string) => void;
  reset: () => void;
};

const INITIAL_TEXT = "$ Type a command below to run it.\r\n";

type TerminalPanelProps = {
  sandboxId?: string;
  template?: string;
  title?: string;
};

type GhosttyTerminal = import("ghostty-web").Terminal;
type GhosttyFitAddon = import("ghostty-web").FitAddon;
type IdleHandle =
  | ReturnType<typeof requestIdleCallback>
  | ReturnType<typeof setTimeout>;

function scheduleIdle(callback: () => void) {
  if (typeof window.requestIdleCallback === "function") {
    return window.requestIdleCallback(callback, { timeout: 500 });
  }

  return setTimeout(callback, 1);
}

function cancelIdle(handle: IdleHandle) {
  if (typeof window.cancelIdleCallback === "function") {
    window.cancelIdleCallback(handle as ReturnType<typeof requestIdleCallback>);
    return;
  }

  clearTimeout(handle as ReturnType<typeof setTimeout>);
}

const TerminalPanel = forwardRef<TerminalPanelHandle, TerminalPanelProps>(
  function TerminalPanel({ sandboxId, template, title = "Terminal" }, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<GhosttyTerminal | null>(null);
  const pendingWritesRef = useRef("");
  const transcriptRef = useRef(INITIAL_TEXT);

  function write(text: string) {
    transcriptRef.current += text;

    if (terminalRef.current) {
      terminalRef.current.write(text);
    } else {
      pendingWritesRef.current += text;
    }
  }

  function reset() {
    transcriptRef.current = INITIAL_TEXT;
    pendingWritesRef.current = "";
    terminalRef.current?.reset();
    terminalRef.current?.write(INITIAL_TEXT);
  }

  function focusTerminal() {
    terminalRef.current?.focus();
    terminalRef.current?.blur();
  }

  async function copyTerminalText() {
    const selectedText = terminalRef.current?.hasSelection()
      ? terminalRef.current.getSelection()
      : "";
    const text = selectedText || transcriptRef.current;

    await navigator.clipboard?.writeText(text.replace(/\r\n/g, "\n"));
  }

  useImperativeHandle(ref, () => ({
    write,
    reset,
  }));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let terminal: GhosttyTerminal | null = null;
    let fitAddon: GhosttyFitAddon | null = null;
    let idleHandle: IdleHandle | null = null;

    const resize = () => {
      if (!fitAddon || resizeTimer) return;

      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        fitAddon?.fit();
      }, 80);
    };

    idleHandle = scheduleIdle(() => {
      void import("ghostty-web").then(async ({ FitAddon, Terminal, init }) => {
        if (disposed) return;

        await init();
        if (disposed) return;

        terminal = new Terminal({
          cols: 96,
          rows: 24,
          cursorBlink: false,
          cursorStyle: "block",
          disableStdin: true,
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: 13,
          scrollback: 500,
          theme: {
            background: "#0b0d10",
            cursor: "#f4f1e8",
            foreground: "#d6ffe3",
            selectionBackground: "#7dd3fc40",
          },
        });
        fitAddon = new FitAddon();

        terminalRef.current = terminal;
        terminal.loadAddon(fitAddon);
        terminal.open(container);
        fitAddon.fit();
        terminal.blur();
        terminal.write(transcriptRef.current);
        pendingWritesRef.current = "";
      });
    });

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(resize)
        : undefined;
    resizeObserver?.observe(container);
    window.addEventListener("resize", resize);

    return () => {
      disposed = true;
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      if (idleHandle !== null) {
        cancelIdle(idleHandle);
      }
      window.removeEventListener("resize", resize);
      resizeObserver?.disconnect();
      fitAddon?.dispose();
      terminal?.dispose();
      terminalRef.current = null;
    };
  }, []);

    return (
      <section className="terminal-panel">
        <header className="terminal-panel-header">
          <div className="terminal-panel-title">
            <span className="terminal-panel-icon" aria-hidden="true">
              &gt;_
            </span>
            <strong>{title}</strong>
            {template ? <code>{template}</code> : null}
            {sandboxId ? <code className="truncate">{sandboxId}</code> : null}
          </div>

          <div className="terminal-panel-actions">
            <button
              aria-label="Copy terminal output"
              className="icon-button"
              onClick={() => void copyTerminalText()}
              onMouseDown={(event) => event.preventDefault()}
              title="Copy terminal output"
              type="button"
            >
              <span className="copy-glyph" aria-hidden="true" />
            </button>
            <button
              aria-label="Clear terminal"
              className="icon-button"
              onClick={reset}
              title="Clear terminal"
              type="button"
            >
              <span className="refresh-glyph" aria-hidden="true" />
            </button>
          </div>
        </header>
        <div
          aria-label="Terminal"
          className="terminal-body"
          onMouseDown={focusTerminal}
          ref={containerRef}
          role="application"
        />
      </section>
    );
  },
);

export default TerminalPanel;
