# cdk

A CDKey credit and task dashboard, built as a Bun monorepo. Private, for study and learning; not open source.

- `apps/api` — Bun + Hono + hono-openapi + Drizzle (bun:sqlite)
- `apps/web` — React + Vite + TanStack Router / Query + shadcn/ui (base-nova) + Tailwind
- `apps/admin` — admin console SPA (products, orders), deployed on its own
- `apps/shop` — key shop SPA (same stack as `apps/web`), deployed on its own and talking to the API cross-origin
- `packages/ui` — theme, UI components and HTTP client shared by the three SPAs
- `packages/shared` — types and constants shared by api and web
- `packages/tsconfig` — shared TypeScript presets

## Quick start

```bash
bun install
cp .env.example .env
```

### Development

Requires the [nsl](https://github.com/dotns/nsl) proxy (`bunx nsl start` once).

```bash
bun run dev       # api + web + shop + admin together
bun run dev:api   # http://cdk.localhost:3355/api
bun run dev:web   # http://cdk.localhost:3355
bun run dev:shop  # http://cdk-shop.localhost:3355
bun run dev:admin # http://cdk-admin.localhost:3355
```

Without nsl: `bun --filter @cdk/api dev:bare` and `bun --filter @cdk/web dev:bare` (no `/api` routing between them).

### Local production

```bash
bun run build     # builds apps/web/dist, apps/shop/dist and apps/admin/dist
bun run start     # API + SPA on http://localhost:$PORT (default 3000)
```

SQLite data lives in `data/` (override with `DATA_DIR`). Migrations run on startup.

API docs: `/api/openapi.json`, `/api/docs`.

### Shop

`apps/shop/dist` is a plain static site; host it anywhere and point it at the API:

1. Build-time settings go in `apps/shop/.env` (see `apps/shop/.env.example`): `VITE_API_URL` is the API origin, `VITE_DASHBOARD_URL` the dashboard link shown after payment. Set `VITE_SHOP_URL` in `apps/web/.env` so the dashboard's purchase button opens the shop.
2. On the API, list the shop's origin in `CORS_ORIGINS`.
3. Payment methods appear in the shop only when configured (see `.env.example`):
   - Alipay: `ALIPAY_APP_ID`, `ALIPAY_PRIVATE_KEY`, `ALIPAY_PUBLIC_KEY`, plus a publicly reachable `APP_URL` for the payment callback.
   - USDT (TRC20): `USDT_TRC20_ADDRESS` and `USDT_CNY_RATE`.
   - Mock: `SHOP_MOCK_PAY=true` adds a pay-nothing method for trying the flow. It only works with `NODE_ENV=development`; never set it on a real deployment.
4. Products live in the `products` table (seeded with placeholder packs) and are managed in the admin console.

### Admin

`apps/admin/dist` is another static site. Set `VITE_API_URL` in `apps/admin/.env`, and on the API set `ADMIN_TOKEN` (long and random; the admin API does not exist without it) and add the admin origin to `CORS_ORIGINS`. Sign in with the token to create, edit, list and unlist products, browse orders, and settle an unpaid order by hand.

For local development set `VITE_API_URL=http://cdk.localhost:3355` and `CORS_ORIGINS=http://cdk-shop.localhost:3355`.

## Quality gates

```bash
bun run check     # lint + typecheck + test + build
bun run lint:fix  # Biome lint + format with fixes
```

Remove dependencies and build outputs (keeps `data/`): `bun run clean`, then `bun install`.

Schema change: edit `apps/api/src/db/schema.ts`, then `bun run db:generate`.
