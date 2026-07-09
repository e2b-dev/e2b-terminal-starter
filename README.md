# E2B Terminal Starter

A Next.js starter for building apps that run user commands inside E2B sandboxes.

The app gives each local user multiple terminal conversations. Each conversation is backed by one E2B sandbox, stores command history in SQLite, and reconnects to the same sandbox when the user returns.

Requires Node.js 20.19 or newer and pnpm 10.

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

Selecting a new local user creates an empty conversation, but no E2B resources are used yet. The first command creates and attaches a sandbox; later commands reconnect to that same sandbox, start a short-lived PTY, send the command through Bash, and record the output in SQLite.

Idle sandboxes pause automatically. The next command reconnects with E2B auto-resume enabled.

Use `Cmd+Enter` on macOS or `Ctrl+Enter` elsewhere to run the command from the editor.
Commands are limited to 16,000 characters, and the terminal keeps the first 256,000 characters of output from each run.

## Customize the Starter

The code is split around the parts most applications replace:

| Change                                       | Start here                                 |
| -------------------------------------------- | ------------------------------------------ |
| Use Clerk, Auth.js, or another auth provider | `lib/auth.ts` and `app/api/users/route.ts` |
| Change environment defaults or limits        | `lib/config.ts`                            |
| Change the SQLite schema or queries          | `lib/db/`                                  |
| Change sandbox creation and lifecycle        | `lib/e2b/sandbox.ts`                       |
| Change how commands run through the PTY      | `lib/e2b/pty.ts`                           |
| Add work around command execution            | `lib/run-command.ts`                       |
| Change client loading and selection behavior | `app/use-terminal-app.ts`                  |
| Change a visible part of the interface       | `app/components/`                          |

API request and response types live in `lib/contracts.ts`. Browser requests are collected in `app/api-client.ts`, so changing an endpoint does not require searching through UI components.

The database layer uses plain `better-sqlite3` functions instead of an ORM. `lib/db/client.ts` owns setup and schema migrations; the other files contain queries grouped by domain.

## Checks

```bash
pnpm test
pnpm typecheck
pnpm format:check
pnpm build
```

For a live E2B smoke, create two conversations and verify that each keeps an independent working directory. Run commands that produce normal output, no output, and a non-zero exit code; then pause a sandbox and confirm the next command reconnects successfully.

## Starter Auth

This repo intentionally uses a local name field instead of production authentication. It is enough to show user-owned conversations and sandbox mapping on your machine.

The local auth endpoint is enabled by default in development and disabled by default in production. Replace it with Clerk, Auth.js, or your own auth provider before shipping a real app.
