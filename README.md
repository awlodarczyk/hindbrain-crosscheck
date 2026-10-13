<img src="docs/images/mark.svg" width="40" alt="hindbrain crosscheck mark">

# hindbrain crosscheck

Ask one question and get two answers, one from Claude and one from ChatGPT, both with web
search. Then each model cross-checks the other's answer claim by claim, citing sources.
Every session is kept in a sidebar history. It runs locally on your machine, or hosted
for a small team behind a login.

Part of the hindbrain family (sibling of hindbrain reflex).

<!-- screenshot: docs/images/session-light.png -->

## How it works

1. **Ask.** Type a question. Claude and ChatGPT answer it in parallel, each with web search.
2. **Cross-check.** Each answer is split into claims. The other model verifies every claim
   and marks it as supported, disputed, partial or unverifiable, with its sources.
3. **Read.** Compare the two answers side by side, expand any claim to see the verdict and
   the links, and come back later from the history sidebar.

Two models agreeing is not proof. Both can be wrong in the same way. Open the sources and
read them, especially for medical, legal or financial topics.

## Run locally

Prerequisites: Node.js 22 or newer (see `.nvmrc`) and Corepack (ships with Node).

```bash
corepack enable
git clone https://github.com/your-account/hindbrain-crosscheck.git
cd hindbrain-crosscheck
pnpm install
cp .env.example .env
```

Generate the signing secret and put it in `.env` as `APP_SECRET`:

```bash
openssl rand -base64 48
```

Then create the database and start the dev server (`pnpm db:migrate` reads `APP_SECRET`
from `.env`):

```bash
pnpm db:migrate
pnpm dev
```

Open <http://127.0.0.1:4173>. With no provider connected, the first-run panel tells you
what to set up.

### Connect a provider

You need at least one provider, ideally both (the cross-check needs two models).

**Option A, local CLIs (no API cost).** Install [Claude Code](https://docs.claude.com/en/docs/claude-code)
and [Codex CLI](https://github.com/openai/codex), then sign in once:

```bash
claude login
codex login
```

The app looks for both binaries when the Settings view is built (a found binary is cached for 60 seconds, a miss for 10) and shows their status in Settings and in the first-run panel. CLI calls run
on your own subscription. Codex with a ChatGPT account rejects the mini models, so on
`codex-cli` the verification step uses the same model that wrote the answer. CLI providers
are for local mode only; hosted deployments set `CLI_ENABLED=0`.

**Option B, API keys.** Create a key in the
[Anthropic console](https://console.anthropic.com/) and the
[OpenAI platform](https://platform.openai.com/api-keys). Either paste them in
Settings, Models (they are stored encrypted), or set `ANTHROPIC_API_KEY` and
`OPENAI_API_KEY` in `.env`. If both exist, the environment variable wins. One question
costs roughly four model calls (two answers plus two verifications), plus web searches;
Settings shows an estimated cost range for one question.

### Package managers

Use pnpm: the lockfile, CI and the Docker image all use it (`packageManager` pins 9.12.0).
`bun install && bun run dev` and `npm install && npm run dev` work for development, but
they ignore `pnpm-lock.yaml`, so dependency versions can drift from what CI tests.
Is `pnpm` the best choice? For this repo, yes. Its strict, content-addressed store keeps
installs fast and prevents undeclared imports, and a single lockfile format means the
tested tree is the shipped tree. Bun works for development, but the native modules here
(`better-sqlite3`, `@node-rs/argon2`) are exercised on Node in CI.

## Configuration

All settings come from environment variables, validated at start by `lib/env.ts`.
An empty value counts as unset. Mode: **local** (single user, no login), **hosted**
(`APP_MODE=hosted`, multi-user, login), or **both**.

| Key                 | Default  | Mode   | Purpose                                                            |
| ------------------- | -------- | ------ | ------------------------------------------------------------------ |
| `APP_MODE`          | `local`  | both   | `local` or `hosted`                                                |
| `PORT`              | `4173`   | both   | HTTP port                                                          |
| `DATA_DIR`          | `./data` | both   | Directory holding `crosscheck.db`                                  |
| `APP_SECRET`        | required | both   | 32+ characters; signs sessions and derives the encryption key      |
| `APP_URL`           | unset    | hosted | Public https URL; required in hosted, used for Origin checks       |
| `TRUST_PROXY`       | `0`      | both   | `1` trusts the last `x-forwarded-for` hop; must be `1` when hosted |
| `VALKEY_URL`        | unset    | hosted | Valkey/Redis URL for rate limits; required in hosted               |
| `ADMIN_EMAIL`       | unset    | hosted | Initial admin account; first deploy only                           |
| `ADMIN_PASSWORD`    | unset    | hosted | Initial admin password, 12+ chars; first deploy only               |
| `CLI_ENABLED`       | `1`      | both   | `0` disables the Claude Code and Codex CLI providers               |
| `ANTHROPIC_API_KEY` | unset    | both   | Anthropic key; overrides a key saved in Settings                   |
| `OPENAI_API_KEY`    | unset    | both   | OpenAI key; overrides a key saved in Settings                      |
| `SMTP_URL`          | unset    | both   | SMTP connection URL, for example `smtp://user:pass@host:587`       |
| `LOG_LEVEL`         | `info`   | both   | `fatal`, `error`, `warn`, `info`, `debug` or `trace`               |

### Development & tests

| Key                  | Default | Purpose                                                |
| -------------------- | ------- | ------------------------------------------------------ |
| `PROVIDER_TRANSPORT` | `auto`  | `mock` swaps real providers for deterministic fixtures |
| `MOCK_DELAY_MS`      | `0`     | Per-call delay in milliseconds for the mock transport  |
| `MOCK_FAIL`          | unset   | `claude` or `chatgpt`: that provider's mock calls fail |

## Testing

```bash
pnpm check
pnpm e2e
pnpm test:security
RUN_LIVE=1 pnpm test:live
```

- `pnpm check` runs the same steps as CI: Prettier, ESLint, TypeScript and Vitest with
  coverage. Coverage thresholds are 80% for lines, branches, functions and statements.
- `pnpm e2e` runs Playwright against a mock-provider dev server. Projects: `chromium`
  (desktop flows), `mobile` (mobile viewport) and `hosted` (login and CSP in hosted mode).
  Install the browser once with `pnpm exec playwright install chromium`.
- `pnpm test:security` runs the security suite described in `tests/security/README.md`.
- `RUN_LIVE=1 pnpm test:live` calls the real Anthropic and OpenAI APIs. It needs real keys
  and costs money, so it never runs in CI.

## Deploy on Dokploy

The hosted setup is two containers: the app and Valkey. Neither publishes a host port;
Dokploy's Traefik routes by domain on the external `dokploy-network`.

1. **Project.** In Dokploy create a project, then a Compose service. Provider: Git, your
   repository and branch. Compose path: `deploy/docker-compose.dokploy.yml`.
2. **Environment.** In the Environment tab set the variables below. Start from
   `deploy/env.production.example` and replace every `change-me`.

   | Key               | Value                                                               |
   | ----------------- | ------------------------------------------------------------------- |
   | `APP_SECRET`      | output of `openssl rand -base64 48`                                 |
   | `VALKEY_PASSWORD` | output of `openssl rand -hex 24` (URL-safe)                         |
   | `APP_URL`         | your public https URL, for example `https://crosscheck.example.com` |
   | `ADMIN_EMAIL`     | the first admin's email                                             |
   | `ADMIN_PASSWORD`  | the first admin's password, 12+ characters                          |
   | `TRUST_PROXY`     | `1` (compose pins it; hosted mode refuses to start otherwise)       |

   Optional: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `LOG_LEVEL`. Compose also pins
   `APP_MODE=hosted`, `CLI_ENABLED=0`, `DATA_DIR=/data` and builds `VALKEY_URL`.

3. **Domain and HTTPS.** In the Domains tab add your host, service `app`, port `3000`,
   HTTPS with Let's Encrypt (Traefik).
4. **Deploy.** The first boot creates the admin from `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
   Bootstrap only creates the account when that email is unknown; it never overwrites it.
5. **Sign in** at your domain and change nothing else yet.
6. **Verify** `https://your-domain/api/health`. Migrations run on the first health check,
   so a healthy container is a migrated one.

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` for the first deploy, sign in, then remove
`ADMIN_PASSWORD` (and optionally `ADMIN_EMAIL`) and redeploy. The admin user persists in
the database. If a hosted instance has no users and no admin variables, it logs an error
at boot and sign-in is impossible until they are set.

**Staging and production.** Create two Dokploy projects with their own environment values
and their own `crosscheck-data` volumes. Never share a volume or an `APP_SECRET`.

**Backups.** Data lives in the `crosscheck-data` volume at `/data/crosscheck.db` plus its
`-wal` and `-shm` files. Either stop the app and copy all three, or copy the directory and
snapshot it with SQLite:

```bash
docker cp <app-container>:/data ./data-copy
sqlite3 data-copy/crosscheck.db ".backup 'crosscheck-backup.db'"
```

Valkey holds only rate-limit counters and queued jobs, so it needs no backup.

**Upgrading.** Redeploy from Dokploy. Migrations run automatically as above.

**Rotating `APP_SECRET`.** The production image has no `pnpm` or `tsx`, so run the rotation
from a dev checkout against a copy of the database (stop the app, copy `/data/crosscheck.db*`
out, run, copy back):

```bash
DATA_DIR=./data-copy pnpm secrets:rotate --old "<old secret>" --new "<new secret>"
```

Then set the new `APP_SECRET` in Dokploy and redeploy. The command re-encrypts stored
provider keys in one transaction.

**Resetting a password or adding a user.** Same dev-checkout flow. Both commands take the
password from the `PASSWORD` environment variable or prompt for it. Resetting also signs
the user out everywhere.

```bash
DATA_DIR=./data-copy pnpm user:reset-password user@example.com
DATA_DIR=./data-copy pnpm user:create user@example.com
```

**Proxy topology.** With `TRUST_PROXY=1` the client IP is the last `x-forwarded-for` hop,
which is Traefik. Do not put a CDN or a second proxy in front in v1: it would need an
extra trusted hop, which is not supported. See `deploy/README.md` for more detail.

## Security model

- **Rate limits.** Layered per browser, per IP and per user, with weighted operations
  (expensive calls cost more). Valkey backs them in hosted mode, process memory locally.
  Exceeding a limit returns `429` with `Retry-After`.
- **CSP with nonces** on every page, plus `nosniff`, `no-store` and request ids on API routes.
- **CSRF.** Mutations must prove same origin through `Sec-Fetch-Site` or `Origin`. Browsers
  send these on their own; non-browser clients must send an `Origin` header matching the
  app (`APP_URL` when hosted).
- **Validation.** Every request body and environment value is validated server-side with zod.
- **Model output** is untrusted: Markdown is sanitised server-side and links are restricted
  to http(s).
- **Secrets at rest.** Provider keys are encrypted with AES-256-GCM using a key derived from
  `APP_SECRET` via HKDF.
- **Logging.** Logs redact keys, tokens, cookies and passwords, and error messages are
  scrubbed before they are stored.
- **SQLite has no database roles.** All access control is in the application. If you need
  database-level isolation, plan a migration to Postgres.

Details: [docs/API.md](docs/API.md) and [tests/security/README.md](tests/security/README.md).

## Data & privacy

- Everything is stored in `./data/crosscheck.db` (or `DATA_DIR`), locally or on your volume.
- Deleting a session keeps it; list deleted sessions with `GET /api/sessions/deleted` and restore one with `POST /api/sessions/{id}/restore` (a Settings screen for this is in progress).
- The only traffic that leaves the machine is calls to the provider APIs or CLIs you
  configured, including their web searches.
- No telemetry, no analytics, no CDN. Fonts are self-hosted.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Run `pnpm check` before opening a pull request.
Design conventions, including the brand lockup, are in [docs/DESIGN.md](docs/DESIGN.md).

## License

MIT, see LICENSE.
