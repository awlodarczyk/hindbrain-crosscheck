# Deploying hindbrain crosscheck on Dokploy

Two services: `app` (Next.js standalone image from `Dockerfile`) and `valkey` (rate limits, jobs).
Neither publishes a host port; Dokploy's Traefik routes by domain.

## Dokploy setup

1. Create Service, Compose. Provider Git, your repo and branch.
2. Compose path: `deploy/docker-compose.dokploy.yml` (build context is the repo root, `..`).
3. Environment tab: paste `deploy/env.production.example` (or `env.staging.example`) and replace every `change-me`.
4. Domains tab: host `crosscheck.example.com`, service `app`, port `3000`, HTTPS with Let's Encrypt.
5. Deploy. Use separate Dokploy projects (and separate volumes) for staging and production.

The `app` service joins the external `dokploy-network` (plus the default network it shares
with `valkey`) because Dokploy's Traefik reaches Compose services only on that network.
The network exists on every Dokploy host; for a plain `docker compose` run, create it first
with `docker network create dokploy-network`.

## Environment contract

| Name                                             | Required   | Mode   | Purpose                                                 |
| ------------------------------------------------ | ---------- | ------ | ------------------------------------------------------- |
| `APP_MODE`                                       | yes        | all    | `hosted` (pinned by compose)                            |
| `APP_SECRET`                                     | yes        | all    | signing and key-encryption secret, 32+ chars            |
| `APP_URL`                                        | yes        | hosted | public https URL; sets Secure cookies and origin checks |
| `TRUST_PROXY`                                    | yes        | hosted | must be `1` (pinned by compose)                         |
| `VALKEY_PASSWORD`                                | yes        | hosted | password for bundled Valkey and its URL                 |
| `VALKEY_URL`                                     | yes        | hosted | built by compose from `VALKEY_PASSWORD`                 |
| `ADMIN_EMAIL`                                    | yes        | hosted | initial admin account                                   |
| `ADMIN_PASSWORD`                                 | first boot | hosted | min 12 chars; remove after the admin logs in            |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`           | no         | all    | provider keys                                           |
| `CLI_ENABLED`                                    | no         | all    | `0` in containers (pinned)                              |
| `PROVIDER_TRANSPORT`                             | no         | all    | `auto` or `mock` (smoke tests)                          |
| `LOG_LEVEL`                                      | no         | all    | `info` in production, `debug` in staging                |
| `DATA_DIR`                                       | no         | all    | `/data` (the volume)                                    |
| `PORT`, `SMTP_URL`, `MOCK_DELAY_MS`, `MOCK_FAIL` | no         | all    | see `.env.example`                                      |

`APP_SECRET` is not needed to build the image; it is checked at container start.

## Data and backup

SQLite lives on the `crosscheck-data` volume at `/data/crosscheck.db` (WAL mode: also
`-wal` and `-shm`). Back up either by stopping the app and copying all three files, or
online from a host with `sqlite3`:

```bash
docker cp <app-container>:/data ./data-copy   # stop the app first
sqlite3 data-copy/crosscheck.db ".backup 'crosscheck-backup.db'"
```

Valkey is a cache (no persistence); losing it only resets rate-limit counters and queued jobs.

## Upgrades

Redeploy from Dokploy. Migrations run on the first health request after start (the
HEALTHCHECK triggers it), so a healthy container is a migrated one.

## Secret rotation and password reset

The standalone image has no pnpm or tsx. Run these from a dev checkout against a copy
of the database (copy `/data/crosscheck.db*` out, run, copy it back with the app stopped):

```bash
DATA_DIR=./data-copy APP_SECRET=<old> pnpm secrets:rotate
DATA_DIR=./data-copy pnpm user:reset-password
```

Then set the new `APP_SECRET` in Dokploy and redeploy.

## Proxy topology

`TRUST_PROXY=1` means the last `x-forwarded-for` hop (Traefik) is the client IP source.
A CDN or second proxy in front needs an extra trusted hop; not supported in v1.

## Local smoke

```bash
VALKEY_PASSWORD=devpass APP_SECRET=<32+ chars> APP_URL=http://127.0.0.1:3100 \
ADMIN_EMAIL=admin@example.test ADMIN_PASSWORD=<12+ chars> PROVIDER_TRANSPORT=mock \
docker compose -f deploy/docker-compose.dokploy.yml -f deploy/docker-compose.local-smoke.yml up -d --build
```
