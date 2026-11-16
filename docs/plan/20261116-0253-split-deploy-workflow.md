# 20261116-0253-split-deploy-workflow Manual deploy workflow and libSQL by default

- **status**: completed
- **createdAt**: 2026-11-16 02:53
- **approvedAt**: 2026-11-16 02:53
- **relatedTask**: 20261116-0252-split-deploy-workflow

## Context

`ci.yml` currently checks and also auto-deploys on push to `main`; Worker secrets come from one `WORKER_SECRETS` JSON secret. `wrangler.jsonc` enables `d1_databases` with a placeholder id, so D1 is the default. The reference project `/srv/ai/tinylink` uses a manual `deploy.yml` (`workflow_dispatch`, `run_migrations` input), syncs Worker secrets from individual repository secrets after the deploy while skipping empty ones, keeps libSQL as default with `d1_databases` commented out, and runs D1 commands through `scripts/d1-config.ts`, which writes a gitignored `wrangler.d1.jsonc` with the block enabled.

## Proposal

- `ci.yml`: check only (push to `main`, pull requests, manual dispatch); `permissions: contents: read`.
- New `deploy.yml`: `workflow_dispatch` with `run_migrations` (default false); one step builds the Worker-secret JSON from individual repository secrets with `jq` and runs `scripts/deploy.sh --skip-check [--no-migrate]`. Secrets scoped to that step; `setup-bun` pinned by SHA.
- `scripts/deploy.sh`: new `--no-migrate`; drops empty secret values before `wrangler secret bulk` (an unset value never wipes a Worker secret); Turso preflight only when migrating.
- `wrangler.jsonc`: `d1_databases` commented out; libSQL is the default (`DATABASE_URL` / `DATABASE_AUTH_TOKEN` as Worker secrets). Driver selection in code is unchanged (`DATABASE_URL` set -> libSQL, else `DB`).
- `apps/api/scripts/d1-config.ts` (+ unit test) writes `wrangler.d1.jsonc`; `db:migrate:d1`, `db:migrate:d1:local` and `dev:worker` use it.
- Docs: README deploy/CI sections, architecture, changelog; `.gitignore` gets `wrangler.d1.jsonc`; `.secrets.example.json` gains `DATABASE_URL`.

## Risks

- Deploys no longer happen on push; someone has to dispatch them.
- A D1 deployment must uncomment the block in `wrangler.jsonc` (deploy.sh detects it).

## Scope

About 10 files; no application code change.

## Alternatives

- Explicit `DB_TYPE` var as in tinylink: redundant here, since the D1 binding exists only when uncommented and `DATABASE_URL` already selects libSQL.

## Annotations

- 2026-11-16: requested directly with tinylink as the reference; treated as approved.
