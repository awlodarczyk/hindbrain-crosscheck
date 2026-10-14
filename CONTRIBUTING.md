# Contributing

## Setup

- Node.js 22 or newer (see `.nvmrc`) and `corepack enable` (provides the pinned pnpm).

```sh
pnpm install
cp .env.example .env     # set APP_SECRET (openssl rand -base64 48)
pnpm db:migrate
pnpm dev                 # http://127.0.0.1:4173
```

Use `PROVIDER_TRANSPORT=mock` to work without real providers.

## Checks

```sh
pnpm check              # format, lint, typecheck, unit/integration tests with coverage
pnpm test:security      # security suite, run it when you touch auth, sanitising, limits, secrets or routes
pnpm e2e                # Playwright (needs `pnpm exec playwright install chromium` once)
```

CI runs gitleaks, `format:check`, `lint`, `typecheck`, `test`, then `e2e` on every push and
pull request to `main`. Run the same locally before pushing.

## Tests first

Write the failing test, make it pass, then refactor. Coverage stays at or above 80%.
A test that passes locally but waits on the wrong element fails on slower CI: fix the wait.

## Commits and pull requests

Conventional commits: `<type>: <description>` with type one of `feat`, `fix`, `refactor`,
`docs`, `test`, `chore`, `perf`, `ci`. The body says what changed and why. Do not add
attribution footers (`Co-Authored-By`, generated-by lines, session links) to commits or pull
request descriptions. Comments in code describe what the code is, not its history.

## Adding a transport

1. Implement the `Provider` interface (`answer`, `review`, `test`) in `lib/providers/<name>.ts`,
   parsing responses with zod at the boundary (`lib/providers/types.ts`).
2. Add the id to `Transport`/`TRANSPORTS` in `lib/db/enums.ts` and wire it in
   `lib/providers/registry.ts` and `lib/providers/transports.ts`.
3. Add fixtures under `tests/fixtures/` and a unit test next to the module; CLI transports
   go through `lib/providers/cli-runner.ts` and are tested with `tests/helpers/fake-spawn.ts`.
4. Update the README if users see a new option.

## Reporting security issues

See [SECURITY.md](SECURITY.md). Do not open a public issue.
