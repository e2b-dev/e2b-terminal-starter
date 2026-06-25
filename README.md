# E2B Terminal Starter

A Next.js starter for building apps that run user commands inside E2B sandboxes.

The app gives each local user multiple terminal conversations. Each conversation is backed by one E2B sandbox, stores command history in SQLite, and reconnects to the sandbox when the user returns.

## Stack

- Next.js App Router
- E2B Sandbox SDK
- Ghostty Web terminal renderer
- SQLite with `better-sqlite3`
- Local signed-cookie session for starter auth

## Run with Stripe Projects

This template is designed for `stripe projects build` with the `e2b/sandbox` service.

```bash
stripe projects build e2b/terminal-starter
cd e2b-terminal-starter
stripe projects env --pull
pnpm install
pnpm dev
```

Open http://localhost:3000.

`stripe projects env --pull` writes the E2B credentials provisioned by Stripe Projects into your local environment file.

## Run without Stripe Projects

You can also run the app with your own E2B API key.

```bash
pnpm install
cp .env.example .env.local
```

Set `E2B_API_KEY` in `.env.local`, then start the app:

```bash
pnpm dev
```

## Environment

Required:

```bash
E2B_API_KEY=e2b_...
```

Optional:

```bash
E2B_TEMPLATE=base
E2B_TIMEOUT_MS=300000
APP_DATABASE_PATH=./data/app.db
APP_SESSION_SECRET=change-me
APP_ENABLE_LOCAL_AUTH=
```

`E2B_TIMEOUT_MS` controls sandbox create/connect calls and PTY command execution. New sandboxes are created with `autoResume: true` and `onTimeout: "pause"`.

`APP_SESSION_SECRET` signs the local starter session cookie. Set it in deployed or shared environments.

`APP_ENABLE_LOCAL_AUTH` controls the starter's name-based auth flow. It is enabled by default in development and disabled by default in production. Do not enable it for a shared deployment unless you understand that anyone who can reach the app can claim a local user name and run commands with your E2B API key.

## How It Works

The server stores starter state in SQLite:

- `users`: local users keyed by UUID
- `conversations`: one user's terminal conversations
- `sandboxes`: one E2B sandbox per conversation
- `messages`: command and output history

When a user runs a command, the API creates or reconnects to the conversation's sandbox, starts a short-lived PTY, sends the command through Bash, records the output, and returns it to the terminal UI.

Idle sandboxes pause automatically. The next command reconnects with E2B auto-resume enabled.

## Starter Auth

This repo intentionally uses a local name field instead of production authentication. It is enough to show user-owned conversations and sandbox mapping on your machine.

The local auth endpoint is enabled by default in development and disabled by default in production. Replace it with Clerk, Auth.js, or your own auth provider before shipping a real app.
