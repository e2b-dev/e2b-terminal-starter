"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Check, Copy, RotateCcw, SquareTerminal } from "lucide-react";
import type { SandboxStatus } from "@/lib/contracts";
import styles from "./terminal-panel.module.css";

export type TerminalPanelHandle = {
  write: (text: string) => void;
  reset: () => void;
};

const INITIAL_TEXT = "";
const HIDE_CURSOR = "\u001b[?25l";

type Props = {
  onReadyChange?: (ready: boolean) => void;
  sandboxId?: string;
  status?: SandboxStatus | "not-started";
  title?: string;
};

type GhosttyTerminal = import("ghostty-web").Terminal;
type GhosttyFitAddon = import("ghostty-web").FitAddon;
type IdleHandle =
  ReturnType<typeof requestIdleCallback> | ReturnType<typeof setTimeout>;

function scheduleIdle(callback: () => void) {
  return typeof window.requestIdleCallback === "function"
    ? window.requestIdleCallback(callback, { timeout: 500 })
    : setTimeout(callback, 1);
}

function cancelIdle(handle: IdleHandle) {
  if (typeof window.cancelIdleCallback === "function") {
    window.cancelIdleCallback(handle as ReturnType<typeof requestIdleCallback>);
  } else {
    clearTimeout(handle as ReturnType<typeof setTimeout>);
  }
}

const TerminalPanel = forwardRef<TerminalPanelHandle, Props>(
  function TerminalPanel(
    { onReadyChange, sandboxId, status = "not-started", title = "Terminal" },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const terminalRef = useRef<GhosttyTerminal | null>(null);
    const transcriptRef = useRef(INITIAL_TEXT);
    const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [copied, setCopied] = useState(false);
    const [initError, setInitError] = useState("");

    function write(text: string) {
      if (!text) return;
      transcriptRef.current += text;
      terminalRef.current?.write(text);
    }

    function reset() {
      transcriptRef.current = INITIAL_TEXT;
      terminalRef.current?.reset();
      terminalRef.current?.clear();
      terminalRef.current?.write(HIDE_CURSOR);
      if (INITIAL_TEXT) terminalRef.current?.write(INITIAL_TEXT);
    }

    useImperativeHandle(ref, () => ({ write, reset }));

    async function copyTerminalText() {
      const selectedText = terminalRef.current?.hasSelection()
        ? terminalRef.current.getSelection()
        : "";
      if (!navigator.clipboard) return;
      try {
        await navigator.clipboard.writeText(
          (selectedText || transcriptRef.current).replace(/\r\n/g, "\n"),
        );
        setCopied(true);
        if (copyResetRef.current) clearTimeout(copyResetRef.current);
        copyResetRef.current = setTimeout(() => setCopied(false), 1_500);
      } catch {
        setCopied(false);
      }
    }

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      let disposed = false;
      let resizeTimer: ReturnType<typeof setTimeout> | null = null;
      let terminal: GhosttyTerminal | null = null;
      let fitAddon: GhosttyFitAddon | null = null;
      let idleHandle: IdleHandle | null = null;
      setInitError("");
      onReadyChange?.(false);

      const resize = () => {
        if (!fitAddon || resizeTimer) return;
        resizeTimer = setTimeout(() => {
          resizeTimer = null;
          fitAddon?.fit();
        }, 80);
      };

      idleHandle = scheduleIdle(() => {
        void import("ghostty-web")
          .then(async ({ FitAddon, Terminal, init }) => {
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
                cursor: "#61d98d",
                foreground: "#d8dce3",
                selectionBackground: "#7dd3fc40",
              },
            });
            fitAddon = new FitAddon();
            terminal.loadAddon(fitAddon);
            terminal.open(container);
            fitAddon.fit();
            terminal.blur();
            terminalRef.current = terminal;
            terminal.write(HIDE_CURSOR);
            if (transcriptRef.current) terminal.write(transcriptRef.current);
            onReadyChange?.(true);
          })
          .catch(() => {
            if (disposed) return;
            setInitError("Terminal failed to load.");
            onReadyChange?.(false);
          });
      });

      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
      window.addEventListener("resize", resize);

      return () => {
        disposed = true;
        if (resizeTimer) clearTimeout(resizeTimer);
        if (idleHandle !== null) cancelIdle(idleHandle);
        if (copyResetRef.current) clearTimeout(copyResetRef.current);
        window.removeEventListener("resize", resize);
        resizeObserver.disconnect();
        fitAddon?.dispose();
        terminal?.dispose();
        terminalRef.current = null;
        onReadyChange?.(false);
      };
    }, [onReadyChange]);

    return (
      <section className={styles.panel}>
        <header className={styles.header}>
          <div className={styles.title}>
            <span className={styles.terminalIcon} aria-hidden="true">
              <SquareTerminal size={15} />
            </span>
            <strong>{title}</strong>
            <span className={styles.sandboxState} title={sandboxId}>
              <span className={`${styles.stateDot} ${styles[status]}`} />
              {status === "not-started" ? "Not started" : status}
              {sandboxId ? <code>{sandboxId.slice(-8)}</code> : null}
            </span>
          </div>
          <div className={styles.actions}>
            <button
              aria-label="Copy terminal output"
              onClick={() => void copyTerminalText()}
              onMouseDown={(event) => event.preventDefault()}
              title="Copy terminal output"
              type="button"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
            <button
              aria-label="Clear terminal"
              onClick={reset}
              title="Clear terminal"
              type="button"
            >
              <RotateCcw size={15} />
            </button>
          </div>
        </header>
        <div className={styles.terminalArea}>
          <div
            aria-label="Terminal"
            className={styles.body}
            ref={containerRef}
            role="application"
          />
          {initError ? (
            <div className={styles.error} role="alert">
              {initError}
            </div>
          ) : null}
        </div>
      </section>
    );
  },
);

export default TerminalPanel;
