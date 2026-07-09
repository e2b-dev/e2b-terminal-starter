import { KeyboardEvent } from "react";
import { LoaderCircle, Play } from "lucide-react";
import styles from "./command-composer.module.css";

type Props = {
  command: string;
  disabled: boolean;
  isRunning: boolean;
  onChange: (command: string) => void;
  onRun: () => Promise<void>;
};

export default function CommandComposer(props: Props) {
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
      <textarea
        aria-label="Command"
        className={styles.command}
        onChange={(event) => props.onChange(event.target.value)}
        onKeyDown={submitShortcut}
        placeholder="Enter a shell command"
        rows={2}
        spellCheck={false}
        value={props.command}
      />
      <button
        className={styles.run}
        disabled={props.disabled || !props.command.trim()}
        type="submit"
      >
        {props.isRunning ? (
          <LoaderCircle className={styles.spin} aria-hidden="true" size={17} />
        ) : (
          <Play aria-hidden="true" size={17} />
        )}
        {props.isRunning ? "Running" : "Run"}
      </button>
    </form>
  );
}
