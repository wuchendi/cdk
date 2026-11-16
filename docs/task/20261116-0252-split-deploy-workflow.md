# 20261116-0252-split-deploy-workflow Manual deploy workflow and libSQL by default

- **status**: completed
- **priority**: P1
- **owner**: claude/session-20261116-0252
- **createdAt**: 2026-11-16 02:52

## Description

Follow `/srv/ai/tinylink`: move deployment out of `ci.yml` into a manually dispatched `.github/workflows/deploy.yml` (optional migrations input, Worker secrets synced from individual repository secrets with empty values skipped), and make libSQL/Turso the default driver with the `d1_databases` block commented out in `wrangler.jsonc`; D1 commands run against a generated copy with the block enabled.

## ActiveForm

Splitting the deploy workflow and defaulting to libSQL.

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

Requested directly by the user with tinylink as the reference; follow-up to 20261116-0246-add-deploy-script.

- complete: bun run check (46 api tests), actionlint, shellcheck pass; preflight branches, dry run, local D1 via generated copy verified.
