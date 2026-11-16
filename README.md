# cdk

A CDKey credit and task dashboard, built as a Bun monorepo. Private, for study and learning; not open source.

- `apps/api` — Hono + hono-openapi + Drizzle; runs on Cloudflare Workers (D1 or Turso) and on Bun (libSQL file) for local work
- `apps/web` — React + Vite + TanStack Router / Query + shadcn/ui (base-nova) + Tailwind
- `apps/admin` — admin console SPA (products, orders, tasks), served under `/admin/`
- `apps/shop` — key shop SPA (same stack as `apps/web`), served under `/shop/`
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
bun run dev:shop  # http://cdk.localhost:3355/shop/
bun run dev:admin # http://cdk.localhost:3355/admin/
```

`bun run dev:worker` runs the API in `wrangler dev` against a local D1 instead (apply the schema first with `bun run db:migrate:d1:local`; local settings go in `apps/api/.dev.vars`, see `.dev.vars.example`).

Without nsl: `bun --filter @cdk/api dev:bare` and `bun --filter @cdk/web dev:bare` (no `/api` routing between them).

### Local production

```bash
bun run build     # builds the three SPAs and assembles ./dist (/, /shop/, /admin/)
bun run start     # API + SPAs on http://localhost:$PORT (default 3000)
```

Under Bun the database is a libSQL file in `data/` (override with `DATA_DIR` or `DATABASE_URL`). Migrations run on startup.

### Deploy (Cloudflare Workers)

One Worker serves the API under `/api` and the three SPAs from Workers Assets: dashboard at `/`, shop at `/shop/`, admin at `/admin/`. Everything is one origin, so `VITE_API_URL` and `CORS_ORIGINS` stay empty. Config lives in `apps/api/wrangler.jsonc`.

The database is fixed per deployment:

- **libSQL / Turso** (default): set the Worker secrets `DATABASE_URL` and `DATABASE_AUTH_TOKEN`; migrations run against the same URL (`bun run db:migrate`, or as part of `bun run deploy`).
- **D1**: `wrangler d1 create cdk`, uncomment the `d1_databases` block in `apps/api/wrangler.jsonc` with that id, migrate with `bun run db:migrate:d1`. `db:migrate:d1:local` and `dev:worker` enable the block on a generated, gitignored `wrangler.d1.jsonc`, so local D1 works without touching the real config.

Plain settings (`APP_URL`, `ALIPAY_APP_ID`, `USDT_*`, ...) go in `vars`. Secrets (`DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `ADMIN_TOKEN`, `ALIPAY_PRIVATE_KEY`, ...) go in `apps/api/.secrets.json` (gitignored; copy `.secrets.example.json`) and are uploaded after every deploy; empty values are skipped so they never wipe an existing secret. `wrangler secret put` works too.

```bash
bunx wrangler login          # once (or export CLOUDFLARE_API_TOKEN)
bun run deploy               # preflight -> install -> check -> migrate -> deploy -> secrets
bun run deploy -- --no-migrate
bun run deploy:dry           # up to `wrangler deploy --dry-run`; no migration, no secrets
```

`scripts/deploy.sh` stops at the first failing step: placeholder D1 id, missing Cloudflare credentials, or (libSQL, when migrating) missing `DATABASE_URL` / `DATABASE_AUTH_TOKEN`. `--skip-check` replaces the full check with a plain build.

### CI and deploy workflows

- `.github/workflows/ci.yml` — on push / pull request to `main` (and manual dispatch): `bun run check` plus a Worker bundle dry run.
- `.github/workflows/deploy.yml` — manual only (Actions → Deploy → Run workflow), with a `run_migrations` checkbox. Runs `scripts/deploy.sh --skip-check` in the `production` environment.

Repository secrets for `deploy.yml`:

| Secret                                                                                                                     | Purpose                                           |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`                                                                                                     | Workers Scripts:Edit (+ D1:Edit if D1 is enabled) |
| `CLOUDFLARE_ACCOUNT_ID`                                                                                                    | target account                                    |
| `DATABASE_URL`, `DATABASE_AUTH_TOKEN`                                                                                      | libSQL/Turso: migrations and Worker secrets       |
| `ADMIN_TOKEN`, `ALIPAY_PRIVATE_KEY`, `ALIPAY_PUBLIC_KEY`, `TRONGRID_API_KEY`, `SHOP_TEST_PAY_CODE`, `TURNSTILE_SECRET_KEY` | Worker secrets; unset ones are skipped            |

USDT payments are matched by a Cron Trigger once a minute.

API docs: `/api/openapi.json`, `/api/docs`.

### Shop

The shop is served at `/shop/` by the same deployment:

1. Build-time settings go in `apps/shop/.env` (see `apps/shop/.env.example`): `VITE_DASHBOARD_URL` is the dashboard link shown after payment (e.g. `/`). Set `VITE_SHOP_URL=/shop/` in `apps/web/.env` so the dashboard's purchase button opens the shop.
2. `VITE_API_URL` and `CORS_ORIGINS` are only needed when the shop is hosted on another origin.
3. Payment methods appear in the shop only when configured (see `.env.example`):
   - Alipay: `ALIPAY_APP_ID`, `ALIPAY_PRIVATE_KEY`, `ALIPAY_PUBLIC_KEY`, plus a publicly reachable `APP_URL` for the payment callback.
   - USDT (TRC20): `USDT_TRC20_ADDRESS` and `USDT_CNY_RATE`.
   - Mock (development): `SHOP_MOCK_PAY=true` adds a pay-nothing method for trying the flow. It only works with `NODE_ENV=development`.
   - Test payment (any deployment): set the secret `SHOP_TEST_PAY_CODE` (8+ chars) to offer "测试支付"; the buyer must enter that code, and, when `TURNSTILE_SITE_KEY` (var) and `TURNSTILE_SECRET_KEY` (secret) are both set, pass Cloudflare Turnstile (add the deployed hostname to the widget). Issued keys are real, so remove it after testing with `cd apps/api && bunx wrangler secret delete SHOP_TEST_PAY_CODE` — deleting the GitHub secret alone does not remove it from the Worker, since empty values are never synced.
4. Products live in the `products` table (seeded with placeholder packs) and are managed in the admin console.

### Admin

Served at `/admin/`. On the API set `ADMIN_TOKEN` (long and random; the admin API does not exist without it). Sign in with the token to create, edit, list and unlist products, browse orders, and settle an unpaid order by hand.

## Quality gates

```bash
bun run check     # lint + typecheck + test + build
bun run lint:fix  # Biome lint + format with fixes
```

Remove dependencies and build outputs (keeps `data/`): `bun run clean`, then `bun install`.

Schema change: edit `apps/api/src/db/schema.ts`, then `bun run db:generate`.
