# 20261111-1017-unify-frontend-style Unify the style of the three frontends

- **status**: completed
- **createdAt**: 2026-11-11 10:17
- **approvedAt**: 2026-11-11 10:17
- **relatedTask**: 20261111-1017-unify-frontend-style

## Context

`apps/web`, `apps/shop` and `apps/admin` each hold a copy of `index.css`, the shadcn primitives (`button`, `card`, `input`, `badge`) and `http.ts`. The dashboard forces a dark amber theme through a `dark` class; shop and admin use a light indigo theme. Headers, page titles, tables, tabs and notices are hand-written per app with different markup.

## Proposal

1. New workspace package `packages/ui` (`@cdk/ui`): the single theme (`styles.css`: Tailwind setup, colour tokens, status colours), the shadcn primitives, the HTTP client, and the shared building blocks every app repeats: `AppShell` (header with brand, navigation, actions; page container), `PageTitle`, `Panel`, `Tabs`, `DataTable`, `Field`, `Notice`, `CopyButton`.
2. All three apps import theme, primitives and building blocks from `@cdk/ui`; their local copies and `components.json` files are removed (one `components.json` stays in the package).
3. The dashboard moves to the shared light theme and shell; its page is rebuilt from the shared blocks without changing behaviour or copy.
4. Shop and admin swap their hand-written headers, titles, tabs, tables and notices for the shared blocks.

Verify: existing component tests stay green unchanged in behaviour, `bun run check`, and a browser pass over each app with screenshots.

## Risks

- Visual regressions that tests cannot see; covered by the browser pass.
- The dashboard changes from dark to light. The token file keeps the look in one place, so another direction is a one-file change.
- Tailwind must scan the package for class names; a missed source path would silently drop styles.

## Scope

New `packages/ui`; the three SPAs' styles, layout and page markup; Biome config; docs. No API, schema or behaviour change.

## Alternatives

- Keep per-app copies and only align colours: quicker, but the three copies drift again.
- Unify on the dashboard's dark amber look: equally possible; light indigo chosen because two apps already use it.

## Annotations

User: the three systems are inconsistent in style; unify all of them by refactoring.
