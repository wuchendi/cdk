# 20261116-0212-deploy-cloudflare-workers Deploy on Cloudflare Workers with D1/Turso

- **status**: completed
- **priority**: P1
- **owner**: claude/session-20261116-0212
- **createdAt**: 2026-11-16 02:12

## Description

Move the API from `Bun.serve` + `bun:sqlite` to a Cloudflare Worker, with the database selectable between Cloudflare D1 and Turso (libSQL). Serve the dashboard, shop and admin SPAs from the same Worker so one deployment (one origin) covers all apps.

Acceptance: `wrangler deploy` ships API + three SPAs; the API works against D1 (binding) or Turso (URL + token); USDT sync runs on a Cron Trigger; existing API tests pass on the new data layer; `bun run check` passes.

## ActiveForm

Moving the deployment to Cloudflare Workers.

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

Plan: docs/plan/20261116-0212-deploy-cloudflare-workers.md

- complete: bun run check passes; wrangler dev smoke-tested on local D1 and libSQL server.
