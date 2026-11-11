# 20261111-0805-scaffold-monorepo Scaffold Bun monorepo shell (api + web)

- **status**: completed
- **priority**: P1
- **owner**: agent/cdk-bootstrap
- **createdAt**: 2026-11-11 08:05

## Description

Bootstrap an empty-shell project for a CDKey credit and task dashboard.
Layout mirrors `/srv/ai/bkd`: Bun workspaces with `apps/api` (Bun + Hono + hono-openapi + Drizzle/SQLite)
and `apps/web` (React + Vite + TanStack Router/Query + shadcn base-nova), plus shared `packages/*`.

Acceptance:
- `bun install` succeeds; `bun run check` (lint + typecheck + test + build) passes.
- API serves `GET /api/health`, `/openapi.json`, `/docs`.
- Web renders a placeholder dashboard route and calls `/api/health` via TanStack Query.
- Dev runs via nsl (`cdk.localhost`, API at `/api`); production runs as a single Bun process serving the built SPA.

## ActiveForm

Scaffolding the cdk Bun monorepo shell

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

Plan: `docs/plan/20261111-0805-scaffold-monorepo.md`. Shell only; no task-execution logic.
