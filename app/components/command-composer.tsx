import { KeyboardEvent, useEffect, useRef } from "react";
import { LoaderCircle, Play } from "lucide-react";
import styles from "./command-composer.module.css";

type Props = {
  command: string;
  disabled: boolean;
  isRunning: boolean;
  onChange: (command: string) => void;
  onRun: () => Promise<void>;
  ready: boolean;
  selectionKey: string;
};

export default function CommandComposer(props: Props) {
  const commandRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!props.ready) return;
    commandRef.current?.focus();
    commandRef.current?.select();
  }, [props.ready, props.selectionKey]);

  function submitShortcut(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (props.disabled || !props.command.trim()) return;
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <form
      className={styles.composer}
      onSubmit={(event) => {
        event.preventDefault();
        if (props.disabled || !props.command.trim()) return;
        void props.onRun();
      }}
    >
      <div className={styles.commandShell}>
        <span className={styles.prompt} aria-hidden="true">
          $
        </span>
        <textarea
          aria-label="Command"
          className={styles.command}
          onChange={(event) => props.onChange(event.target.value)}
          onKeyDown={submitShortcut}
          placeholder="Enter a shell command"
          rows={2}
          ref={commandRef}
          spellCheck={false}
          value={props.command}
        />
      </div>
      <button
        className={styles.run}
        disabled={props.disabled || !props.command.trim()}
        title="Run command"
        type="submit"
      >
        {props.isRunning ? (
          <LoaderCircle className={styles.spin} aria-hidden="true" size={17} />
        ) : (
          <Play aria-hidden="true" size={17} />
        )}
        <span>{props.isRunning ? "Running" : "Run"}</span>
      </button>
    </form>
  );
}
