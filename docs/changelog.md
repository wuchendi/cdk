# Changelog

## 2026-11-11 08:20 [progress]

Scaffolded the Bun monorepo shell (task 20261111-0805-scaffold-monorepo): `apps/api` (Hono + hono-openapi + Drizzle/SQLite, `/api/health`, `/api/openapi.json`, `/api/docs`, SPA serving in production), `apps/web` (React + Vite + TanStack Router/Query + shadcn base-nova, placeholder dashboard), `packages/shared`, `packages/tsconfig`, repository hygiene files. Shell only; no task-execution logic. `bun run check` passes.

## 2026-11-11 08:30 [decision]

Replaced ESLint (`@antfu/eslint-config`) with Biome (task 20261111-0820-replace-eslint-with-biome), mirroring the `/srv/work/projects` `biome.json` rule set; React domain enabled for `apps/web`. Zod is imported as `import * as z from 'zod'`. The root TypeScript 6 pin (needed only by typescript-eslint) was dropped; the repo now uses TypeScript 7 everywhere.

## 2026-11-11 08:35 [progress]

Added root `dev` (api + web together) and `clean` (`scripts/clean.sh`, removes node_modules / dist / coverage, keeps `data/`) scripts (task 20261111-0822-add-dev-clean-scripts).

## 2026-11-11 08:45 [progress]

Consolidated the descriptive project documentation into a single `docs/architecture.md` and scrubbed upstream-service and credential-handling details from the docs. PMA task/plan/changelog tracking retained.

## 2026-11-11 08:57 [progress]

Completed the dashboard interactions (task 20261111-0831-implement-dashboard-interactions): key validation and balance, task submit / list / filter / search / pagination, pending-task cancel with refund, zh-CN dashboard UI. Tasks stay `pending` until an execution service is connected. `bun run check` passes.

## 2026-11-11 09:13 [progress]

Added the standalone key shop (task 20261111-0857-add-key-shop-app): `apps/shop` SPA (products, order form, payment page, order query, login/register) and the `/api/shop` module (catalog, accounts, orders, Alipay precreate + signed callback, USDT TRC20 amount matching via a TronGrid poller, key issuance). New tables `users`, `sessions`, `products`, `orders`; `cdkeys.order_id`; `CORS_ORIGINS` for cross-origin access; `VITE_SHOP_URL` links the dashboard's purchase button to the shop.

## 2026-11-11 09:13 [decision]

Shop scope and defaults (user: Alipay + USDT, accounts, order query, modelled on a supplied storefront). Chosen where unspecified: official Alipay `alipay.trade.precreate` signed with `node:crypto` (no SDK); USDT on TRC20 with self-hosted amount matching and a fixed `USDT_CNY_RATE`; email + password accounts with bearer session tokens because the shop is a separate origin; placeholder packs of 1 / 3 / 10 credits. Vite settings stay in per-app `.env` files: pointing `envDir` at the repo root made Vite pick up the API's `NODE_ENV` and ship development builds. Not done: email verification, password reset, rate limiting, refunds, admin UI. Neither provider has been exercised against the real service (no merchant credentials); verified by signed-callback and stubbed-TronGrid tests plus a browser run against a local TronGrid stand-in.

## 2026-11-11 09:18 [decision]

Removed shop accounts at the user's request (task 20261111-0916-remove-shop-accounts): no registration or login; every buyer is a guest identified by contact email + order password. Dropped the `/api/shop/auth/*` routes, `GET /api/shop/orders`, the `users` / `sessions` tables and `orders.user_id` (migration `0002`, hand-ordered because drizzle migrations run in a transaction where `PRAGMA foreign_keys` is a no-op; checked against a database holding orders and issued keys). Order query keeps browser orders, email + order password, and order number.

## 2026-11-11 09:26 [progress]

Dev wiring for the shop: `bun run dev` now also starts `apps/shop`; its nsl name is `cdk-shop` (single-level host, so wildcard TLS on public dev domains covers it).

## 2026-11-11 09:54 [progress]

Added a development-only `mock` payment method (task 20261111-0953-add-dev-mock-payment): offered only with `SHOP_MOCK_PAY=true` and `NODE_ENV=development`, settled through `POST /api/shop/orders/:orderNo/mock-pay`. The explicit flag exists because `NODE_ENV` defaults to `development`. Web and shop tests now pin their `VITE_*` settings so a local `.env` cannot change test results.

## 2026-11-11 10:08 [progress]

Added the standalone admin console (task 20261111-1003-add-admin-app): `apps/admin` SPA (nsl name `cdk-admin`) and the `/api/admin` module, enabled only when `ADMIN_TOKEN` is set. Products can be created, edited, listed and unlisted at runtime; orders can be filtered, searched and settled by hand (`manual:` trade marker). Order views moved to `modules/shop/orders.ts` and are shared by shop and admin. Products are unlisted rather than deleted because orders reference them.

## 2026-11-11 10:22 [decision]

Unified the look of the three SPAs (task 20261111-1017-unify-frontend-style). New `packages/ui` (`@cdk/ui`) owns the theme, the shadcn primitives, the HTTP client and the shared page blocks (`AppShell`, `PageTitle`, `Panel`, `Notice`, `Field`, `Tabs`, `DataTable`, `Pagination`); the per-app copies of `index.css`, `components/ui`, `http.ts` and `components.json` are gone. The dashboard moved from its dark amber theme to the shared light indigo one, chosen because shop and admin already used it; the unused `Card` primitive and dark token set were dropped. Status filters are now tabs (`role="tab"`). No API or behaviour change.

## 2026-11-11 10:52 [progress]

Task creation now collects the full account (task 20261111-1050-task-credential-format): one `邮箱----password----2FA密钥` field, validated to exactly three `----`-separated parts (valid email, 1–128-char password, base32 16–64 TOTP secret; spaces in the secret stripped). Added `tasks.password` and `tasks.totp_secret` (migration `0003`), stored write-only — never returned in the task list. The dashboard's security warning, which told buyers not to submit passwords/2FA, was rewritten since those are now required. Secrets are stored in plaintext because the (not-yet-built) worker must read them back; encryption is deferred.

## 2026-11-11 10:58 [progress]

Fixed the create-task row alignment (the credential format hint moved out of the field row to a line below the form) and replaced hand-rolled controls with official base-nova components pulled into `packages/ui` via `bunx shadcn add`: `Select`, `Checkbox`, `Label`, `Tabs`, `Table`. The dashboard task-type now uses the real `Select`; the admin product form uses the real `Checkbox`; the shared `Tabs` and `DataTable` blocks are rebuilt on the `Tabs`/`Table` primitives. Verified in a browser: the three create-row controls share a baseline, the select opens below its trigger, the checkbox renders, no console errors.

## 2026-11-11 11:01 [progress]

Unified page scrolling on the base-nova `ScrollArea` component (pulled via `bunx shadcn add`): `AppShell` now has a fixed header and scrolls its content column inside a `ScrollArea`, and `DataTable` scrolls horizontally inside one. The component renders both scrollbars, so it covers vertical and horizontal cases.

## 2026-11-11 11:10 [progress]

Added the admin task view (task 20261111-1108-admin-task-view): `GET /api/admin/tasks` (all tasks joined to their cdkey, filter by status, search email/cdkey, paginated, returns the account credentials — admin-only) and `PATCH /api/admin/tasks/:id` (set `running`/`success`/`failed` plus a run note, `completed_at` on finish). New `apps/admin` `/tasks` page with copyable account, status filter, search, pagination and per-row status change. The operator uses this until an execution worker exists.

## 2026-11-11 11:24 [progress]

Vendored the Google-Pro automation helper into `worker/` (was in gitignored `.tmp/`) and wired it to the task system (task 20261111-1123-integrate-execution-worker). The Playwright engine (`automation_engine.py`) and its standalone console (`app.py`) are kept as-is; new `task_worker.py` polls `GET /api/admin/tasks?status=pending`, runs the engine per account, and reports `running`/`success`/`failed` with a note via `PATCH /api/admin/tasks/:id` (`cdk_api.py`, stdlib urllib). Card/proxy stay operator-local in `worker/config.json` (gitignored); no API or schema change. The worker runs on the operator's Windows machine and was syntax-checked only (needs real Chrome + US proxy).

## 2026-11-11 11:29 [progress]

Made the execution worker cross-platform: `automation_engine.py` Chrome-path detection now honours `CHROME_PATH` and probes Linux/macOS locations, process cleanup uses `terminate()/kill()` off Windows, and the Windows-only netstat/taskkill port cleanup is skipped elsewhere. Added `worker/run.sh` (venv + deps + playwright + run) and documented Linux/macOS usage (real Chromium, a display or `xvfb-run`, US proxy). The engine's browser logic is unchanged.

## 2026-11-16 02:40 [decision]

Moved deployment to Cloudflare Workers (task 20261116-0212-deploy-cloudflare-workers). One Worker (`apps/api/wrangler.jsonc`, entry `src/worker/index.ts`) serves `/api` and the three SPAs from Workers Assets on one origin: dashboard at `/`, shop at `/shop/`, admin at `/admin/` (Vite `base` + router `basepath`; path prefixes chosen over host-based routing because Cloudflare serves the static files without invoking the Worker). `bun run build` assembles `dist/`. The database is fixed per deployment, following `/srv/ai/bks`: `DATABASE_URL` selects Turso, otherwise the D1 binding `DB`; the Worker never migrates (`db:migrate:d1` / `db:migrate`). Bun stays for local dev and `bun run start`, on libSQL (`file:`/`:memory:`) instead of `bun:sqlite`. All queries are async; the four interactive transactions became atomic `db.batch` calls guarded with `changes() = 1` (task debit + insert, cancel + refund, settle + key issue), and USDT amount uniqueness is enforced by re-checking after insert. Order passwords moved from argon2id to PBKDF2-SHA256 (WebCrypto; no existing data). USDT sync runs on a 1-minute Cron Trigger on Workers. `pino` was replaced by a console JSON logger on both hosts (simpler than keeping two loggers; deviation from the plan). Verified with `bun run check`, concurrency tests, and `wrangler dev` smoke runs against local D1 and a local libSQL server (orders, mock pay, Alipay sign/verify, tasks, refunds).

## 2026-11-16 02:58 [progress]

Added a one-command release and CI (task 20261116-0246-add-deploy-script). `bun run deploy` now runs `scripts/deploy.sh`: preflight (refuses the placeholder D1 id, missing Cloudflare auth via `wrangler whoami --json`, or missing Turso env), `bun install --frozen-lockfile`, `bun run check` (or `--skip-check` build), migration for the configured driver, `wrangler deploy`, then `wrangler secret bulk` from `apps/api/.secrets.json` or `WORKER_SECRETS` (after the deploy so the first release works). `bun run deploy:dry` stops at `wrangler deploy --dry-run`. `.github/workflows/ci.yml` checks every push/PR to `main` and deploys on push to `main` (skipped while `CLOUDFLARE_API_TOKEN` is unset). Verified with shellcheck, actionlint, `bun run check`, and local runs of every preflight branch plus the dry run; the migrate/deploy/secret steps need a Cloudflare account and were not executed.
CI hardening: `oven-sh/setup-bun` is pinned to a commit SHA (v2.2.0), and the deploy secrets are set only on the steps that use them, not job-wide, so setup actions never see them.

## 2026-11-16 03:05 [decision]

Followed `/srv/ai/tinylink` for deployment (task 20261116-0252-split-deploy-workflow). Deploys moved out of `ci.yml` into a manually dispatched `.github/workflows/deploy.yml` with a `run_migrations` input; Worker secrets now come from individual repository secrets (replacing the single `WORKER_SECRETS` repository secret), assembled with `jq` and synced by `scripts/deploy.sh`, which drops empty values so an unset secret never wipes a live one, and gained `--no-migrate`. `ci.yml` is check-only and adds a Worker bundle dry run. libSQL/Turso is now the default driver: `d1_databases` is commented out in `wrangler.jsonc` and `DATABASE_URL` / `DATABASE_AUTH_TOKEN` are Worker secrets; `apps/api/scripts/d1-config.ts` writes a gitignored `wrangler.d1.jsonc` with the block enabled for `db:migrate:d1(:local)` and `dev:worker`. No explicit `DB_TYPE` var as in tinylink: the binding only exists when uncommented, and `DATABASE_URL` already selects libSQL.

## 2026-11-16 03:20 [progress]

Test payment on deployments (task 20261116-0310-production-test-payment). The `mock` method is now also offered on any environment when the secret `SHOP_TEST_PAY_CODE` (8+ chars) is set; `mock-pay` then requires that code, and Cloudflare Turnstile when `TURNSTILE_SITE_KEY` (var) and `TURNSTILE_SECRET_KEY` (secret) are both set (siteverify with `remoteip`, 5 s timeout, fails closed; modelled on `/srv/ai/tinylink`). The code stays alongside Turnstile because Turnstile stops bots but not people, and issued keys drive tasks the worker executes with a real card. The catalog exposes `testPayCode` / `turnstileSiteKey`; the shop's payment panel shows the code field and the widget (re-rendered after a failed attempt, tokens are single-use), and the copy changed from "模拟支付（仅开发）" to "测试支付". `deploy.yml` and `.secrets.example.json` sync the two new secrets. Verified with API and shop tests and `wrangler dev` in production mode against the real siteverify using Cloudflare's always-pass and always-fail test keys; the widget itself was not exercised in a browser.

## 2026-11-16 03:40 [progress]

First deploy failed after upload: the account hit the Workers Free limit of 5 cron triggers, so `wrangler deploy` exited non-zero and the secret sync never ran. The USDT Cron Trigger is now commented out in `wrangler.jsonc`; uncomment it when USDT is configured.

## 2026-11-16 04:05 [progress]

Fixed the cross-app links on the deployed Worker (task 20261116-0400-default-same-origin-links): CI builds have no `apps/*/.env`, so the dashboard's purchase button showed "购买渠道暂未配置" and the shop hid its post-payment dashboard link. With all SPAs on one origin, `VITE_SHOP_URL` now defaults to `/shop/` and `VITE_DASHBOARD_URL` to `/`; the variables only override for split deployments. The now-unreachable "purchase unavailable" notice was removed.
