import { LoaderCircle, Pause, Plus } from "lucide-react";
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
      <form
        className={styles.userForm}
        onSubmit={(event) => {
          event.preventDefault();
          void props.onSelectUser(props.name);
        }}
      >
        <label htmlFor="name">Local user</label>
        <div className={styles.inlineForm}>
          <input
            autoComplete="off"
            id="name"
            maxLength={80}
            onChange={(event) => props.onNameChange(event.target.value)}
            placeholder="Name"
            value={props.name}
          />
          <button disabled={props.isBusy || !props.name.trim()} type="submit">
            Change
          </button>
        </div>
      </form>

      <dl className={styles.details}>
        <Detail label="User" value={props.user?.id || "Selecting..."} />
        <Detail label="Template" value={props.template} />
        <Detail
          label="Active sandboxes"
          value={String(props.runningSandboxCount)}
        />
      </dl>

      <div className={styles.history}>
        <div className={styles.historyHeading}>
          <span>Conversations</span>
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
  return (
    <div className={`${styles.historyItem} ${active ? styles.active : ""}`}>
      <button
        className={styles.historySelect}
        disabled={busy}
        onClick={() => void onSelect(conversation.id)}
        type="button"
      >
        <strong>{conversation.title}</strong>
        <small>{sandboxLabel(conversation.e2b_sandbox_id)}</small>
        <span className={styles.sandboxStatus}>
          <span className={`${styles.sandboxDot} ${styles[status]}`} />
          {status === "not-started" ? "Not started" : status}
        </span>
      </button>
      <button
        aria-label={`Pause ${conversation.title}`}
        className={styles.pauseButton}
        disabled={
          busy ||
          !conversation.e2b_sandbox_id ||
          conversation.sandbox_status !== "running" ||
          pausing
        }
        onClick={() => void onPause(conversation)}
        title="Pause sandbox"
        type="button"
      >
        {pausing ? (
          <LoaderCircle className={styles.spin} aria-hidden="true" size={15} />
        ) : (
          <Pause aria-hidden="true" size={15} />
        )}
      </button>
    </div>
  );
}
