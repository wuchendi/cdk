# 20261111-0805-scaffold-monorepo Scaffold Bun monorepo shell (api + web)

- **status**: completed
- **createdAt**: 2026-11-11 08:05
- **approvedAt**: 2026-11-11 08:20
- **relatedTask**: 20261111-0805-scaffold-monorepo

## Context

Target: a CDKey credit and task dashboard (shell only, for study; not open source).
Intended surface:

- CDKey entry in the header; a key carries a credit balance.
- Dashboard: stat cards (total / pending / running / success / failed), queue length, tabbed task table
  with search and pagination, per-row actions.
- Import modal and two-step export modal.
- Open API with a bearer / header-token auth scheme.

Working directory `/srv/work/cdk` was empty and not a git repo.

Reference project `/srv/ai/bkd`: Bun workspaces (`apps/api`, `apps/frontend`, `packages/shared`, `packages/tsconfig`),
`catalog:` for shared versions, nsl for dev URLs, Drizzle + SQLite, `data/` git-ignored.

Scope boundary: scaffolding only — schema shells, a health endpoint, placeholder pages. No task-execution logic.

## Proposal

Bun workspace monorepo, same shape as bkd:

```text
cdk/
  package.json            # workspaces + catalog, root scripts
  tsconfig.json
  biome.json / .gitignore / .gitattributes / .editorconfig / .env.example / LICENSE / README.md
  apps/
    api/                  # @cdk/api - Bun + Hono + hono-openapi + Drizzle (bun:sqlite)
    web/                  # @cdk/web - React + Vite + TanStack Router/Query + shadcn base-nova
  packages/
    shared/               # @cdk/shared - shared types/enums (TaskStatus, TaskType)
    tsconfig/             # @cdk/tsconfig - base / bun / react presets
  docs/                   # pma tracking, architecture.md, changelog.md
```

Dev via nsl (`cdk.localhost`, API under `/api`). Local production: `bun run build` then `bun run start`
(one Bun process serving the API plus `apps/web/dist`).

Only scaffolding in scope: health endpoint, placeholder pages, empty schema shells. All dependency versions
resolved from the registry at install time.

## Risks

- nsl package name differs between docs (`@nsio/nsl`) and bkd (`@dotns/nsl`); verify at install time.
- shadcn base-nova init is interactive; components may be added manually if the CLI prompts.
- Latest majors may conflict with tooling; pin with a recorded reason if so.

## Scope

~40 new files, all new. `git init` included; no commit.

## Alternatives

- API + sibling `web/` without workspaces: simpler, but bkd parity and shared types justify `packages/shared`.

## Annotations

(none)
