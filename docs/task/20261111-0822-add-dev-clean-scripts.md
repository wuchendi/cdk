# 20261111-0822-add-dev-clean-scripts Add root dev and clean scripts

- **status**: completed
- **priority**: P2
- **owner**: agent/cdk-scripts
- **createdAt**: 2026-11-11 08:22

## Description

Add root `dev` (start api + web together) and `clean` (remove dependencies and build outputs) scripts, following `/srv/ai/bkd` and `/srv/work/projects`.

Acceptance:
- `bun run dev` starts `@cdk/api` and `@cdk/web` dev servers in one terminal via nsl.
- `bun run clean` removes `node_modules`, `dist`, `coverage` across the workspace and leaves `data/` untouched.

## ActiveForm

Adding root dev and clean scripts

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

(none)
