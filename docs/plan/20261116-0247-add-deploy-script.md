# 20261116-0247-add-deploy-script Add a one-command build and deploy script

- **status**: completed
- **createdAt**: 2026-11-16 02:47
- **approvedAt**: 2026-11-16 02:55
- **relatedTask**: 20261116-0246-add-deploy-script

## Context

`bun run deploy` today is `bun run build && wrangler deploy`. Migrations are separate (`db:migrate:d1` / `db:migrate`), secrets are set by hand with `wrangler secret put`, and nothing stops a deploy when `wrangler.jsonc` still holds the placeholder D1 id or tests fail. No CI exists in the repo.

## Proposal

New `scripts/deploy.sh` (bash, `set -euo pipefail`), root `deploy` points at it. Steps, each aborting on failure:

1. **Preflight**: `wrangler whoami` (logged in or `CLOUDFLARE_API_TOKEN` set); detect the driver from `apps/api/wrangler.jsonc`: a `d1_databases` block -> D1 (refuse the all-zero placeholder id and print the `wrangler d1 create cdk` hint); otherwise Turso, which needs `DATABASE_URL` + `DATABASE_AUTH_TOKEN` in the environment for migration.
2. **Gate**: `bun install --frozen-lockfile`, then `bun run check` (lint + typecheck + test + build, which also assembles `dist/`). `--skip-check` falls back to `bun run build` only.
3. **Migrate**: D1 -> `wrangler d1 migrations apply cdk --remote`; Turso -> `bun apps/api/src/db/migrate-cli.ts` with the env vars.
4. **Deploy**: `wrangler deploy` from `apps/api`.
5. **Secrets (optional)**: if `apps/api/.secrets.json` exists (gitignored, example file committed), upload with `wrangler secret bulk`. Runs after the deploy so it also works on the very first release, when the Worker does not exist yet.

Flags: `--skip-check`, `--dry-run` (everything up to `wrangler deploy --dry-run`, no migration, no secrets).

Secrets can also come from the `WORKER_SECRETS` env var (a JSON object), so CI needs no file.

### CI (`.github/workflows/ci.yml`)

- `check` job on every push and pull request to `main`: `bun install --frozen-lockfile`, `bun run check`.
- `deploy` job on push to `main` only, after `check`, in the `production` environment: runs `bash scripts/deploy.sh --skip-check`. Repository secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, optional `DATABASE_URL` / `DATABASE_AUTH_TOKEN` (Turso) and `WORKER_SECRETS`. Without `CLOUDFLARE_API_TOKEN` the job skips with a notice instead of failing, so CI stays green before Cloudflare is set up.
- `concurrency` serialises deploys; superseded check runs are cancelled.

Files: `.github/workflows/ci.yml`, `scripts/deploy.sh`, `package.json` (root `deploy`, `deploy:dry`), `apps/api/.secrets.example.json`, `.gitignore`, README deploy section.

## Risks

- Migrations run before the new code is live; they are additive today, but a destructive migration would break the running version between the two steps.
- `wrangler secret bulk` overwrites existing values of the listed keys.

## Scope

6 files, no app code change.

## Alternatives

- Keep separate commands and only document the order: cheaper, but easy to forget migrations.

## Annotations

- 2026-11-16: approved with secret upload and dry-run kept; CI added to scope.
