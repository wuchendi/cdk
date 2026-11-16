# cdk

A CDKey-based credit and task dashboard, built as a Bun monorepo. Private, for study and learning; not open source.

## Layout

```text
apps/api          Hono API (@cdk/api): Cloudflare Worker, or Bun locally
apps/web          React SPA (@cdk/web)
apps/shop         Key shop SPA (@cdk/shop), served under /shop/
apps/admin        Admin console SPA (@cdk/admin), served under /admin/
packages/shared   Shared types/constants (@cdk/shared)
packages/ui       Shared theme, UI components, HTTP client (@cdk/ui)
packages/tsconfig Shared TS presets (@cdk/tsconfig)
worker/           Python execution worker (Playwright), operator-run
data/             Bun runtime state (libSQL file), git-ignored
dist/             Assembled SPA build (web at /, shop/, admin/), git-ignored
scripts/          clean.sh (workspace cleanup), assemble-dist.sh (merge SPA builds into dist/), deploy.sh (Cloudflare release)
.github/workflows ci.yml (check on push/PR), deploy.yml (manual deploy)
```

## API (`apps/api`)

- `src/worker/index.ts` — Cloudflare Worker entry: builds the app once per isolate from `env`; `fetch` serves `/api` and answers asset misses with the matching SPA `index.html` (`shared/lib/spa.ts`); `scheduled` (Cron Trigger, every minute) runs the USDT sync. Static files are served by Workers Assets from `dist/` (`wrangler.jsonc`).
- `src/index.ts` — Bun entry (local dev, `bun run start`): config, logger, db, `Bun.serve`, 15 s USDT timer, graceful shutdown; in production serves `dist/` through `src/static.ts`.
- `src/app.ts` — `createApp()`: all API routes mounted under `/api`; an optional `assets` middleware serves the SPAs (Bun only).
- `src/config.ts` — Zod-validated env; Workers pass `env`, Bun passes `process.env`.
- `src/root.ts` — Bun-only path resolution for migrations, `dist/` and `DATA_DIR`.
- `src/db/` — Drizzle schema and the shared async `Db` type (`index.ts`). The driver is fixed per deployment: the Worker uses `DATABASE_URL` (libSQL/Turso via `@libsql/client/web`, the default) if set, else the D1 binding `DB` (`d1_databases`, commented out in `wrangler.jsonc` unless D1 is chosen; `scripts/d1-config.ts` writes an enabled copy for local D1), and never migrates; Bun uses `db/bun.ts` (`@libsql/client` over a local `file:`, `:memory:` in tests, or `DATABASE_URL`), migrating on startup. `migrate-cli.ts` migrates a remote libSQL database. Migrations in `drizzle/` (also D1's `migrations_dir`).
- Writes that must be atomic use `db.batch([...])` (D1 has no interactive transactions): each later statement is guarded on the earlier one (`where changes() = 1`), e.g. debit + task insert, task delete + refund, order settle + key issue.
- `src/modules/<name>/` — one router per module; `docs` exposes `/openapi.json` and `/docs`.
- `src/modules/tasks/` — key-authenticated session, task submit / list / cancel.
- `src/modules/shop/` — `shop.routes.ts` (catalog, orders, order lookup, Alipay callback), `payments.ts` (Alipay signing, USDT matching, key issuance) and `orders.ts` (order views shared with admin).
- `src/modules/admin/` — token-guarded product management, order list and manual settlement, and the task list / status updates (credentials exposed here only); mounted only when `ADMIN_TOKEN` is set.
- `CORS_ORIGINS` enables cross-origin access for the listed origins; empty means same-origin only (the default deployment serves everything from one origin).
- Response envelope: `{ success: true, data }` / `{ success: false, error: { code, message, details? } }`.

## Web (`apps/web`)

- File-based routes in `src/app/routes/` (generated `routeTree.gen.ts`).
- Providers: i18next -> TanStack Query (`src/app/providers.tsx`). Default locale `zh-CN`.
- Feature hooks live in `src/features/<name>/api.ts`.
- Theme, components and the HTTP client come from `@cdk/ui` (see below).

## Dev routing

nsl serves everything on `cdk.localhost:3355`, mirroring production: `/api` goes to the API, `/shop` and `/admin` to their Vite servers (prefixes kept, not stripped; Vite `base` and router `basepath` match), everything else to the dashboard's Vite.

## Shared UI (`packages/ui`)

The one place that defines how the three SPAs look. Each app's `src/index.css` is a single `@import "@cdk/ui/styles.css"`.

- `src/styles.css` — Tailwind setup, colour tokens (light, indigo accent), status colours. Change the look here.
- `src/components/ui/` — shadcn/ui (base-nova) primitives pulled from the registry (`bunx shadcn add` with `components.json` in this package): `Button`, `Input`, `Badge`, `Select`, `Checkbox`, `Label`, `Tabs`, `Table`, `ScrollArea`.
- `src/components/` — blocks every app builds pages from: `AppShell` (fixed header; the content column scrolls inside a `ScrollArea`), `PageTitle`, `Panel`, `Notice`, `Field`, `Pagination`, plus `Tabs` and `DataTable` wrappers over the `Tabs`/`Table` primitives for a compact API.
- `src/http.ts` — `apiFetch` / `ApiError`; unwraps the API envelope and prefixes `VITE_API_URL` (empty means same origin).

Page markup that only one app needs stays in that app.

## Shop (`apps/shop`)

A static SPA with no backend of its own, served under `/shop/`. Routes (relative to the base): `/` (notice + products), `/products/$id` (order form), `/orders/$orderNo` (payment page that turns into the key list), `/orders` (order query). There are no accounts; every buyer is a guest. It calls the API on the same origin (or `VITE_API_URL`) and keeps this browser's order numbers in `localStorage`.

## Admin (`apps/admin`)

A static SPA for the operator, served under `/admin/`. It signs in with `ADMIN_TOKEN` (kept in `sessionStorage`, sent as a bearer token) and calls `/api/admin`: `/` manages products (create, edit, list/unlist, sort), `/orders` lists orders with filter and search and can settle an unpaid order by hand, which issues its keys through `fulfilOrder` with a `manual:` trade marker. `/tasks` lists every cdkey's task with the submitted account (email, password, 2FA — admin-only) and moves it through `running` / `success` / `failed` with a run note. Products are never deleted, only unlisted, because orders reference them.

## Execution worker (`worker/`)

A Python + Playwright automation (operator-run on Windows, real Chrome + US proxy — not deployable on the headless server) that performs the account subscription a task represents. `automation_engine.py` is the vendored engine (kept as-is); `task_worker.py` is the cdk integration: it polls `GET /api/admin/tasks?status=pending` for credentialed tasks, runs the engine per account, and reports `running` / `success` / `failed` with a note via `PATCH /api/admin/tasks/:id` (`cdk_api.py` is the stdlib client). Card and proxy stay operator-local in `worker/config.json` (gitignored). Tasks move from pending to a final state in the admin as the worker runs. `app.py` is the engine's original standalone console, kept for manual use.

## Domain

- `cdkeys`: an access key carrying a credit balance; `orderId` links keys issued by the shop to their order.
- `tasks`: queued jobs owned by a cdkey. Each carries the account the worker logs into — `email`, `password` and `totp_secret` (2FA), submitted as one `邮箱----password----2FA` field and stored write-only (never returned in the task list). Type `sub6` / `sub12` / `sub24` costs 1 / 1.5 / 2 credits; status `pending` / `running` / `success` / `failed`. No execution worker exists; tasks stay `pending`. The credential secrets are stored in plaintext, since the worker must read them back.
- `products`: credit packs sold by the shop (price in CNY fen).
- `orders`: one guest purchase of `quantity` keys, identified by contact email and an order password (PBKDF2-SHA256 via WebCrypto, `shared/lib/password.ts`). Stored status is `pending` or `paid`; `expired` is derived from `expiresAt` (15 minutes).

### Purchase flow

1. `POST /api/shop/orders` prices the order from `products` and starts payment. The buyer gives an email and an order password.
   - Alipay: `alipay.trade.precreate` returns a QR link, shown by the shop.
   - USDT (TRC20): the order gets an amount that is unique among open USDT orders (0.0001 steps), converted at `USDT_CNY_RATE`.
   - Mock / test payment: offered when `SHOP_MOCK_PAY=true` and `NODE_ENV=development`, or on any environment when `SHOP_TEST_PAY_CODE` is set. `POST /api/shop/orders/:orderNo/mock-pay` settles the order without payment; with the code set it requires `{ code }` (constant-time compare, `shared/lib/secret.ts`), and with `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` a Turnstile token verified via siteverify (`shared/lib/turnstile.ts`, fails closed). The catalog reports `testPayCode` and `turnstileSiteKey` so the shop renders the code field and widget.
2. Payment is confirmed server-side only:
   - Alipay posts to `/api/shop/payments/alipay/notify`; the signature, app id and amount must match.
   - A poller (Cron Trigger every minute on Workers, 15 s timer under Bun) reads confirmed transfers to the receiving address from TronGrid and matches exact amount within the order's time window.
3. `fulfilOrder` flips `pending -> paid` and issues the keys in one atomic batch; a trade/transaction id settles at most one order.
4. The shop polls `GET /api/shop/orders/:orderNo`, which returns the keys once paid. The order number is unguessable and acts as the read capability; buyers can also find orders by email + order password (`POST /api/shop/orders/lookup`).

## Scripts

| Command | Action |
|---|---|
| `bun run dev` | api + web + shop + admin together (nsl) |
| `bun run dev:api` / `dev:web` / `dev:shop` / `dev:admin` | one app only |
| `bun run build` | build the three SPAs and assemble `dist/` |
| `bun run start` | Bun: API + built SPAs on one port (`PORT`, default 3000) |
| `bun run dev:worker` | API in `wrangler dev` (local D1, `apps/api/.dev.vars`) |
| `bun run deploy` / `deploy:dry` | `scripts/deploy.sh`: preflight, install, check, migrate (D1 or Turso), `wrangler deploy`, upload secrets / dry run |
| `bun run db:migrate:d1` / `db:migrate:d1:local` | apply migrations to D1 (remote / local) |
| `bun run db:migrate` | apply migrations to `DATABASE_URL` (Turso) |
| `bun run lint` / `lint:fix` / `format` | Biome |
| `bun run typecheck` / `test` | per-workspace |
| `bun run check` | lint + typecheck + test + build |
| `bun run db:generate` | regenerate migrations after a schema change |
| `bun run clean` | remove `node_modules` / `dist` / `coverage` (keeps `data/`) |

## Toolchain

- Lint and format: Biome (`biome.json` at the root).
- TypeScript 7 everywhere via the workspace catalog.
- Data: Drizzle over D1 or libSQL/Turso (Workers) and libSQL (Bun); one async `Db` type.
- Deploy: Wrangler (`apps/api/wrangler.jsonc`), `nodejs_compat` for `node:crypto`.
- Logging: JSON lines on the console (`src/logger.ts`), same on both hosts.
