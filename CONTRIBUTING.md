# Contributing

## Prerequisites

- Node.js >= 20.11 (see `.nvmrc`)
- `corepack enable` (provides the pnpm version pinned in `package.json`)

## Setup and run

```sh
pnpm install
pnpm dev        # http://127.0.0.1:4173
```

## Checks

```sh
pnpm check      # format, lint, typecheck, unit/integration tests with coverage
pnpm e2e        # Playwright end-to-end tests
```

CI runs the same gates on every push and pull request to `main`: gitleaks,
`format:check`, `lint`, `typecheck`, `test`, then `e2e`.

## Tests

Write the failing test first, then the implementation, then refactor.
Coverage must stay at or above 80%.

## Commits

Use conventional commits: `<type>: <description>`, where type is one of
`feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`.

Do not add attribution footers (`Co-Authored-By`, generated-by lines) to
commit messages or pull request descriptions.
