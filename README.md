# E2B Terminal Starter

A minimal Next.js starter for running per-user terminal sessions in E2B sandboxes.

## Run locally

Install dependencies:

```bash
pnpm install
```

Pull the E2B service credentials from Stripe Projects:

```bash
stripe projects env --pull
```

Start the app:

```bash
pnpm dev
```

Open http://localhost:3000.

## Environment

`stripe projects env --pull` should provide:

```bash
E2B_API_KEY=e2b_...
```

Optional local overrides:

```bash
E2B_TEMPLATE=base
E2B_TIMEOUT_MS=300000
APP_DATABASE_PATH=./data/app.db
APP_SESSION_SECRET=change-me
```

## How it works

The app uses a local SQLite database for starter persistence:

- `users`: local users keyed by UUID
- `conversations`: a user's terminal conversations
- `sandboxes`: one E2B sandbox per conversation
- `messages`: command and output history

The server reads `E2B_API_KEY`, creates or reconnects to the conversation's E2B sandbox, runs the submitted command, and records the command/output in SQLite.

New sandboxes are created with `lifecycle.onTimeout = "pause"` and `lifecycle.autoResume = true`, so idle sandboxes pause instead of being killed and resume when the app reconnects to run another command.

The starter intentionally keeps auth as a local name field. Swap `users` for Clerk, Auth.js, or your own auth provider when you want real accounts.
