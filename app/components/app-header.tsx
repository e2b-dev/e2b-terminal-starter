import type { ConfigResponse } from "@/lib/contracts";
import styles from "./app-header.module.css";

export default function AppHeader({
  config,
}: {
  config: ConfigResponse | null;
}) {
  const state =
    config === null ? "checking" : config.hasE2bApiKey ? "ready" : "missing";
  const label =
    state === "checking"
      ? "Checking"
      : state === "ready"
        ? "Ready"
        : "Setup required";

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <div className={styles.mark}>E2B</div>
        <h1>E2B Terminal Starter</h1>
      </div>
      <div className={`${styles.status} ${styles[state]}`}>
        <span className={styles.dot} />
        {label}
      </div>
    </header>
  );
}
