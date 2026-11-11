# 20261111-0820-replace-eslint-with-biome Replace ESLint with Biome

- **status**: completed
- **createdAt**: 2026-11-11 08:20
- **approvedAt**: 2026-11-11 08:25
- **relatedTask**: 20261111-0820-replace-eslint-with-biome

## Context

- Current lint: root `eslint.config.js` (`@antfu/eslint-config`), ESLint dev deps, and a root `typescript@6` pin kept only because typescript-eslint needs the TS 6 compiler API.
- Reference `/srv/work/projects/biome.json`: Biome 2, `preset: "none"` with a hand-picked rule list, formatter 2-space / single quotes / `semicolons: asNeeded`, organizeImports assist, Tailwind CSS directive parsing, VCS ignore file, React domain enabled per React app.
- `zod` is imported as `import { z } from 'zod'` in 3 API files.

## Proposal

1. Remove `eslint.config.js` and the ESLint dev dependencies; drop the root `typescript@6` pin so the root uses the catalog TypeScript 7.
2. `bun add -D @biomejs/biome` at the root.
3. Add `biome.json` copied from the reference, adapted: React domain override for `apps/web/**`; ignores for `dist`, `coverage`, `drizzle/`, `routeTree.gen.ts`, shadcn `ui/`, `docs/`; drop project-specific next/vue overrides.
4. Root scripts: `lint: biome check .`, `lint:fix: biome check . --write`, `format: biome format . --write`.
5. Switch the 3 zod imports to `import * as z from 'zod'`; run `biome check --write` to reformat.
6. Update docs.

## Risks

- Reformat touches most source files (trailing commas, line width); behavior unchanged, verified by tests.
- `noFloatingPromises` / `noMisusedPromises` are nursery rules; fix code, not the rule.

## Scope

~5 config/doc files plus formatting-only changes across `apps/*` and `packages/*`.

## Alternatives

- Keep ESLint for lint, Biome only as formatter: rejected, the request is a full replacement.

## Annotations

(none)
