# 20261116-0246-add-deploy-script Add a one-command build and deploy script

- **status**: completed
- **priority**: P1
- **owner**: claude/session-20261116-0246
- **createdAt**: 2026-11-16 02:46

## Description

Add `scripts/deploy.sh` (wired to `bun run deploy`) that runs the whole Cloudflare release in order: preflight checks, quality gate, build, database migration for the configured driver (D1 or Turso), optional secret upload, `wrangler deploy`.

Acceptance: one command deploys from a clean checkout; it stops before deploying on any failed step; it picks D1 or Turso from the deployment config without manual switching.

## ActiveForm

Adding the deploy script.

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

Follow-up to 20261116-0212-deploy-cloudflare-workers.

- complete: shellcheck, actionlint, bun run check pass; preflight branches and dry run verified locally; real deploy not run (no Cloudflare account here).
