import {
  ChevronDown,
  LoaderCircle,
  Pause,
  Plus,
  UserRound,
} from "lucide-react";
import type { ConversationListItem, User } from "@/lib/contracts";
import { sandboxLabel } from "../terminal-format";
import styles from "./conversation-sidebar.module.css";

type Props = {
  activeConversationId: string;
  conversations: ConversationListItem[];
  isBusy: boolean;
  isLoading: boolean;
  name: string;
  onCreateConversation: () => Promise<void>;
  onNameChange: (name: string) => void;
  onPauseConversation: (conversation: ConversationListItem) => Promise<void>;
  onSelectConversation: (conversationId: string) => Promise<void>;
  onSelectUser: (name: string) => Promise<void>;
  pausingConversationId: string;
  runningSandboxCount: number;
  template: string;
  user: User | null;
};

export default function ConversationSidebar(props: Props) {
  return (
    <aside className={styles.sidebar}>
      <details className={styles.account}>
        <summary>
          <span className={styles.avatar} aria-hidden="true">
            <UserRound size={16} />
          </span>
          <span className={styles.accountName}>
            <small>Local user</small>
            <strong>{props.user?.name || "Selecting..."}</strong>
          </span>
          <ChevronDown className={styles.chevron} size={16} />
        </summary>
        <div className={styles.accountPanel}>
          <form
            className={styles.userForm}
            onSubmit={(event) => {
              event.preventDefault();
              void props.onSelectUser(props.name);
            }}
          >
            <label className={styles.srOnly} htmlFor="name">
              Local user name
            </label>
            <div className={styles.inlineForm}>
              <input
                autoComplete="off"
                id="name"
                maxLength={80}
                onChange={(event) => props.onNameChange(event.target.value)}
                placeholder="Name"
                value={props.name}
              />
              <button
                disabled={props.isBusy || !props.name.trim()}
                type="submit"
              >
                Switch
              </button>
            </div>
          </form>
          <dl className={styles.details}>
            <Detail label="User ID" value={props.user?.id || "Selecting..."} />
            <Detail label="Template" value={props.template} />
          </dl>
        </div>
      </details>

      <div className={styles.history}>
        <div className={styles.historyHeading}>
          <div>
            <span>Conversations</span>
            <small>{props.runningSandboxCount} active</small>
          </div>
          <button
            className={styles.newButton}
            disabled={!props.user || props.isBusy}
            onClick={() => void props.onCreateConversation()}
            type="button"
          >
            <Plus aria-hidden="true" size={15} />
            New
          </button>
        </div>
        <div className={styles.historyList}>
          {props.conversations.length === 0 ? (
            <p className={styles.emptyState}>
              {props.isLoading
                ? "Loading conversations..."
                : "No conversations yet."}
            </p>
          ) : (
            props.conversations.map((conversation) => (
              <ConversationItem
                active={props.activeConversationId === conversation.id}
                busy={props.isBusy}
                conversation={conversation}
                key={conversation.id}
                onPause={props.onPauseConversation}
                onSelect={props.onSelectConversation}
                pausing={props.pausingConversationId === conversation.id}
              />
            ))
          )}
        </div>
      </div>
    </aside>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ConversationItem({
  active,
  busy,
  conversation,
  onPause,
  onSelect,
  pausing,
}: {
  active: boolean;
  busy: boolean;
  conversation: ConversationListItem;
  onPause: (conversation: ConversationListItem) => Promise<void>;
  onSelect: (conversationId: string) => Promise<void>;
  pausing: boolean;
}) {
  const status = conversation.sandbox_status || "not-started";
  const canPause =
    Boolean(conversation.e2b_sandbox_id) &&
    conversation.sandbox_status === "running";
  return (
    <div className={`${styles.historyItem} ${active ? styles.active : ""}`}>
      <button
        className={styles.historySelect}
        disabled={busy}
        onClick={() => void onSelect(conversation.id)}
        type="button"
      >
        <strong>{conversation.title}</strong>
        <span className={styles.sandboxMeta}>
          <span className={`${styles.sandboxDot} ${styles[status]}`} />
          <span>{status === "not-started" ? "Not started" : status}</span>
          {conversation.e2b_sandbox_id ? (
            <code>{sandboxLabel(conversation.e2b_sandbox_id)}</code>
          ) : null}
        </span>
      </button>
      {canPause ? (
        <button
          aria-label={`Pause ${conversation.title}`}
          className={styles.pauseButton}
          disabled={busy || pausing}
          onClick={() => void onPause(conversation)}
          title="Pause sandbox"
          type="button"
        >
          {pausing ? (
            <LoaderCircle
              className={styles.spin}
              aria-hidden="true"
              size={15}
            />
          ) : (
            <Pause aria-hidden="true" size={15} />
          )}
        </button>
      ) : null}
    </div>
  );
}
