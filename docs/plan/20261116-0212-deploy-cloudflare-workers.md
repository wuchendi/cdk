# 20261116-0212-deploy-cloudflare-workers Deploy on Cloudflare Workers with D1/Turso

- **status**: completed
- **createdAt**: 2026-11-16 02:12
- **approvedAt**: 2026-11-16 02:30
- **relatedTask**: 20261116-0212-deploy-cloudflare-workers

## Context

The API (`apps/api`) runs on Bun and has several Bun/Node-only dependencies that do not work on Workers:

| Area | Current | Workers problem |
|---|---|---|
| Entry | `src/index.ts`: `Bun.serve`, signal handlers | needs `export default { fetch, scheduled }` |
| DB driver | `drizzle-orm/bun-sqlite`, file in `DATA_DIR`, WAL pragma, `migrate()` on startup | no filesystem; D1 / libSQL are async |
| Queries | synchronous `.get()/.all()/.run()` throughout `modules/*` (~40 call sites) | must be `await`ed |
| Transactions | `db.transaction(..., { behavior: 'immediate' })` in 4 places: task submit (dup check + debit + insert), task cancel (delete + refund), `fulfilOrder` (trade-no check + mark paid + issue keys), order create (unique USDT amount) | D1 has no interactive transactions; only `batch()` (atomic, but no JS logic between statements) |
| Password hash | `Bun.password` (argon2id) for order passwords | not available |
| Crypto | `node:crypto` (`createSign/createVerify` RSA for Alipay, `randomBytes`, `randomInt`, `createHash`, `timingSafeEqual`) | works with `nodejs_compat` |
| USDT sync | `setInterval` every 15 s | no timers between requests; Cron Trigger minimum is 1 min |
| Logger | `pino` | Node streams; replace with a console-based logger of the same shape |
| Static files | `serveStatic` + `Bun.file` for `apps/web/dist` only; shop and admin are separate deployments reaching the API via CORS | Workers Static Assets |
| Config | `process.env` -> `loadConfig(env)` | Worker `env` bindings (already an injectable argument) |

`createApp({ config, db, logger, fetch })` is already dependency-injected, and tests call `app.request(...)` with an in-memory DB, so the HTTP layer can stay as is.

## Proposal

### 1. One async data layer, driver fixed at deploy time

Follows the pattern in `/srv/ai/bks` (`packages/db`, `apps/api/src/worker/deps.ts`). There is no runtime switching: the deployment config decides.

- `Db` is the shared async `BaseSQLiteDatabase<'async', ...>` plus `batch`; modules do not know the driver.
- Worker (`src/worker/deps.ts`): `DATABASE_URL` set -> libSQL/Turso via `@libsql/client/web` (+ secret `DATABASE_AUTH_TOKEN`); else the D1 binding `DB`; neither -> startup error. The worker never migrates.
- Bun (local dev and tests): `@libsql/client` over a local `file:` (default `data/db/cdk.db`) or `:memory:`, migrated on startup with the libsql migrator — replaces `bun:sqlite`.
- Schema and existing migrations are unchanged (plain SQLite DDL). No existing data to migrate.
- Production migrations: D1 `wrangler d1 migrations apply cdk --remote` (`migrations_dir = "drizzle"`); Turso `DATABASE_URL=... bun run db:migrate` (small Bun CLI over the same migrator).

### 2. Replace interactive transactions with atomic batches

Each one becomes a single `db.batch([...])` whose statements carry their own guards, followed by a read only to pick the error code on failure:

- Task submit: `UPDATE cdkeys SET balance = balance - cost WHERE id = ? AND balance >= cost AND NOT EXISTS (<duplicate pending/running task>)`, then `INSERT INTO tasks ... SELECT ... WHERE changes() = 1`. If nothing was inserted, check duplicate vs balance to return `DUPLICATE_TASK` / `INSUFFICIENT_BALANCE`.
- Task cancel: refund `UPDATE cdkeys ... WHERE id = (SELECT cdkey_id FROM tasks WHERE id = ? AND cdkey_id = ? AND status = 'pending')` using a `CASE task_type` cost, then `DELETE ... WHERE ... AND status = 'pending'`. Not-found vs not-pending decided by a read when nothing was deleted.
- `fulfilOrder`: `UPDATE orders SET status = 'paid', trade_no = ? WHERE id = ? AND status = 'pending' AND NOT EXISTS (<trade_no used>)`, then `INSERT INTO cdkeys ... SELECT ... WHERE EXISTS (SELECT 1 FROM orders WHERE id = ? AND trade_no = ?)`; the existing unique index on `trade_no` remains the last line of defence.
- Order create (USDT amount uniqueness): insert, then re-read open USDT orders; on a collision bump the amount and retry (bounded). Same guarantee as today without a lock.

Batches are atomic on both D1 and libSQL.

### 3. Workers runtime adaptations

- `Bun.password` -> PBKDF2-SHA256 via WebCrypto (100k iterations, the Workers maximum), stored as `pbkdf2$<iter>$<salt>$<hash>`, on both hosts. No existing hashes need to stay valid.
- Logger: the worker uses a small console JSON logger with the same `info/warn/error/debug` shape; Bun keeps `pino`.
- `node:crypto` kept, `compatibility_flags = ["nodejs_compat"]`.
- USDT sync: worker `scheduled()` on a `* * * * *` Cron Trigger (1-minute granularity instead of 15 s); the Bun entry keeps its 15 s timer.

### 4. One Worker serves API + three SPAs (single origin)

- New `apps/api/src/worker.ts`: `fetch` builds/caches the app per isolate from `env`; `scheduled` runs `syncUsdt`.
- `wrangler.jsonc` in `apps/api` with `assets.directory = "../../dist"`, `binding = "ASSETS"`, `not_found_handling = "none"`. Static files are served directly by Cloudflare; the Worker only runs for `/api/*` and for asset misses, where it returns the SPA `index.html` of the matching prefix.
- Path layout on one domain:
  - `/` dashboard (`apps/web`)
  - `/shop/` shop (`apps/shop`, Vite `base: '/shop/'`, router `basepath: '/shop'`)
  - `/admin/` admin (`apps/admin`, Vite `base: '/admin/'`, router `basepath: '/admin'`)
  - `/api/*` API
- `bun run build` assembles `dist/` (web at root, `dist/shop`, `dist/admin`). Same origin means `VITE_API_URL` and `CORS_ORIGINS` can stay empty; both remain supported for split deployments.

### 5. Dev and scripts

- `bun run dev` stays on Bun + nsl as today (libSQL local file instead of `bun:sqlite`); separate nsl hosts per SPA keep working, only with the new URL prefixes.
- New in `apps/api`: `dev:worker` (`wrangler dev`, local D1), `deploy` (root build + `wrangler deploy`), `db:migrate` (Bun CLI for `DATABASE_URL`). Root forwards `deploy`, `dev:worker`, `db:migrate`.
- `bun run start` stays as the Bun production path (it costs nothing extra).
- Update `.env.example` (`DATABASE_URL`, `DATABASE_AUTH_TOKEN`), `docs/architecture.md`, `docs/changelog.md`.

## Risks

- Batch rewrites touch money paths (balance debit/refund, key issuance). Covered by existing tests plus new tests for duplicate / insufficient balance / double settlement.
- Alipay RSA via `node:crypto` on Workers needs a check under `wrangler dev`; fallback is WebCrypto `RSASSA-PKCS1-v1_5`.
- USDT confirmation latency rises from <=15 s to <=60 s.
- Workers free plan CPU limit (10 ms) can be exceeded by PBKDF2 at 100k iterations; the paid plan is assumed.
- The Python worker (`worker/`) only needs `CDK_API_URL` pointing at the new host; no code change.

## Scope

`apps/api` (db, entry, modules with DB calls, payments, logger, config, tests, package.json, wrangler config, drizzle configs), `apps/shop` / `apps/admin` (vite base + router basepath), root `package.json` scripts, env examples, docs. Roughly 20–25 files. No schema change.

## Alternatives

- Host-based routing instead of path prefixes: one Worker bound to `cdk.example.com`, `shop.example.com`, `admin.example.com`, choosing the SPA by `Host`. Keeps current URLs (no basepath change) but needs three custom domains and CORS-free still only if all calls go through the same host. Path prefixes are simpler.
- Three Workers (or Pages) for the SPAs plus one API Worker: closest to today, but three deployments and CORS.
- Turso only: libSQL supports interactive transactions, so the transaction code could stay mostly intact (only async). Dropping D1 support would shrink section 2, but D1 was requested.

## Annotations

- 2026-11-16: no data to migrate; the database is chosen at deploy time (no runtime switching), following `/srv/ai/bks`. Path prefixes chosen for the SPAs (option A).
