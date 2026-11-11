# cdk

A CDKey-based credit and task dashboard, built as a Bun monorepo. Private, for study and learning; not open source.

## Layout

```text
apps/api          Bun + Hono API (@cdk/api)
apps/web          React SPA (@cdk/web)
apps/shop         Key shop SPA (@cdk/shop), deployed separately
apps/admin        Admin console SPA (@cdk/admin), deployed separately
packages/shared   Shared types/constants (@cdk/shared)
packages/ui       Shared theme, UI components, HTTP client (@cdk/ui)
packages/tsconfig Shared TS presets (@cdk/tsconfig)
data/             Runtime state (SQLite), git-ignored
scripts/clean.sh  Workspace cleanup
```

## API (`apps/api`)

- `src/index.ts` — bootstrap: config, logger, db, `Bun.serve`, graceful shutdown.
- `src/app.ts` — `createApp()`: all API routes mounted under `/api`; in production also serves `apps/web/dist` with an `index.html` fallback.
- `src/config.ts` — Zod-validated env; the only place that reads `process.env` (besides `root.ts`).
- `src/root.ts` — path resolution for assets, web dist, and `DATA_DIR`.
- `src/db/` — Drizzle schema and `createDb()` (WAL, foreign keys, migrations on startup). Migrations in `drizzle/`.
- `src/modules/<name>/` — one router per module; `docs` exposes `/openapi.json` and `/docs`.
- `src/modules/tasks/` — key-authenticated session, task submit / list / cancel.
- `src/modules/shop/` — `shop.routes.ts` (catalog, orders, order lookup, Alipay callback), `payments.ts` (Alipay signing, USDT matching, key issuance) and `orders.ts` (order views shared with admin).
- `src/modules/admin/` — token-guarded product management, order list and manual settlement, and the task list / status updates (credentials exposed here only); mounted only when `ADMIN_TOKEN` is set.
- `CORS_ORIGINS` enables cross-origin access for the listed origins; empty means same-origin only.
- Response envelope: `{ success: true, data }` / `{ success: false, error: { code, message, details? } }`.

## Web (`apps/web`)

- File-based routes in `src/app/routes/` (generated `routeTree.gen.ts`).
- Providers: i18next -> TanStack Query (`src/app/providers.tsx`). Default locale `zh-CN`.
- Feature hooks live in `src/features/<name>/api.ts`.
- Theme, components and the HTTP client come from `@cdk/ui` (see below).

## Dev routing

nsl serves the dashboard and API on `cdk.localhost:3355`; `/api` goes to the API (prefix kept, not stripped), everything else to Vite. The shop and admin run on `cdk-shop.localhost:3355` and `cdk-admin.localhost:3355` and reach the API cross-origin, as in production.

## Shared UI (`packages/ui`)

The one place that defines how the three SPAs look. Each app's `src/index.css` is a single `@import "@cdk/ui/styles.css"`.

- `src/styles.css` — Tailwind setup, colour tokens (light, indigo accent), status colours. Change the look here.
- `src/components/ui/` — shadcn/ui (base-nova) primitives pulled from the registry (`bunx shadcn add` with `components.json` in this package): `Button`, `Input`, `Badge`, `Select`, `Checkbox`, `Label`, `Tabs`, `Table`, `ScrollArea`.
- `src/components/` — blocks every app builds pages from: `AppShell` (fixed header; the content column scrolls inside a `ScrollArea`), `PageTitle`, `Panel`, `Notice`, `Field`, `Pagination`, plus `Tabs` and `DataTable` wrappers over the `Tabs`/`Table` primitives for a compact API.
- `src/http.ts` — `apiFetch` / `ApiError`; unwraps the API envelope and prefixes `VITE_API_URL` (empty means same origin).

Page markup that only one app needs stays in that app.

## Shop (`apps/shop`)

A static SPA with no backend of its own. Routes: `/` (notice + products), `/products/$id` (order form), `/orders/$orderNo` (payment page that turns into the key list), `/orders` (order query). There are no accounts; every buyer is a guest. It calls the API at `VITE_API_URL` and keeps this browser's order numbers in `localStorage`.

## Admin (`apps/admin`)

A static SPA for the operator. It signs in with `ADMIN_TOKEN` (kept in `sessionStorage`, sent as a bearer token) and calls `/api/admin`: `/` manages products (create, edit, list/unlist, sort), `/orders` lists orders with filter and search and can settle an unpaid order by hand, which issues its keys through `fulfilOrder` with a `manual:` trade marker. `/tasks` lists every cdkey's task with the submitted account (email, password, 2FA — admin-only) and moves it through `running` / `success` / `failed` with a run note. Products are never deleted, only unlisted, because orders reference them.

## Domain

- `cdkeys`: an access key carrying a credit balance; `orderId` links keys issued by the shop to their order.
- `tasks`: queued jobs owned by a cdkey. Each carries the account the worker logs into — `email`, `password` and `totp_secret` (2FA), submitted as one `邮箱----password----2FA` field and stored write-only (never returned in the task list). Type `sub6` / `sub12` / `sub24` costs 1 / 1.5 / 2 credits; status `pending` / `running` / `success` / `failed`. No execution worker exists; tasks stay `pending`. The credential secrets are stored in plaintext, since the worker must read them back.
- `products`: credit packs sold by the shop (price in CNY fen).
- `orders`: one guest purchase of `quantity` keys, identified by contact email and an order password (argon2id hash). Stored status is `pending` or `paid`; `expired` is derived from `expiresAt` (15 minutes).

### Purchase flow

1. `POST /api/shop/orders` prices the order from `products` and starts payment. The buyer gives an email and an order password.
   - Alipay: `alipay.trade.precreate` returns a QR link, shown by the shop.
   - USDT (TRC20): the order gets an amount that is unique among open USDT orders (0.0001 steps), converted at `USDT_CNY_RATE`.
   - Mock (development only): offered when `SHOP_MOCK_PAY=true` and `NODE_ENV=development`; `POST /api/shop/orders/:orderNo/mock-pay` settles the order without payment.
2. Payment is confirmed server-side only:
   - Alipay posts to `/api/shop/payments/alipay/notify`; the signature, app id and amount must match.
   - A 15-second poller reads confirmed transfers to the receiving address from TronGrid and matches exact amount within the order's time window.
3. `fulfilOrder` flips `pending -> paid` and issues the keys in one transaction; a trade/transaction id settles at most one order.
4. The shop polls `GET /api/shop/orders/:orderNo`, which returns the keys once paid. The order number is unguessable and acts as the read capability; buyers can also find orders by email + order password (`POST /api/shop/orders/lookup`).

## Scripts

| Command | Action |
|---|---|
| `bun run dev` | api + web + shop + admin together (nsl) |
| `bun run dev:api` / `dev:web` / `dev:shop` / `dev:admin` | one app only |
| `bun run build` | build `apps/web/dist`, `apps/shop/dist` and `apps/admin/dist` |
| `bun run start` | API + built SPA on one port (`PORT`, default 3000) |
| `bun run lint` / `lint:fix` / `format` | Biome |
| `bun run typecheck` / `test` | per-workspace |
| `bun run check` | lint + typecheck + test + build |
| `bun run db:generate` | regenerate migrations after a schema change |
| `bun run clean` | remove `node_modules` / `dist` / `coverage` (keeps `data/`) |

## Toolchain

- Lint and format: Biome (`biome.json` at the root).
- TypeScript 7 everywhere via the workspace catalog.
- Data: Drizzle + SQLite (`bun:sqlite`), migrations applied on startup.
