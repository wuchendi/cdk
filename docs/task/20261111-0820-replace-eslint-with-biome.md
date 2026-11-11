# 20261111-0820-replace-eslint-with-biome Replace ESLint with Biome

- **status**: completed
- **priority**: P1
- **owner**: agent/cdk-biome
- **createdAt**: 2026-11-11 08:20

## Description

Replace the ESLint (`@antfu/eslint-config`) setup with Biome, following the `biome.json` used in `/srv/work/projects`.

Acceptance:
- `eslint.config.js` and all ESLint dev dependencies removed; `@biomejs/biome` added at the root.
- `biome.json` mirrors the reference rules, adapted to this repo's paths and React app.
- `bun run lint` runs `biome check .`; `bun run check` passes.

## ActiveForm

Replacing ESLint with Biome

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

Plan: `docs/plan/20261111-0820-replace-eslint-with-biome.md`.
