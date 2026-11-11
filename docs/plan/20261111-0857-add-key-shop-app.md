# 20261111-0857-add-key-shop-app Add standalone key purchase app

- **status**: completed
- **createdAt**: 2026-11-11 08:57
- **approvedAt**: 2026-11-11 09:02
- **relatedTask**: 20261111-0857-add-key-shop-app

## Context

- `apps/api` has `cdkeys` (code, balance) and `tasks`; keys are created only by direct DB insert. There is no order, product or payment code, and no admin surface.
- The API is same-origin only: no CORS middleware, and `apps/web` calls a hard-coded relative `/api` (`src/shared/lib/http.ts`).
- The dashboard's purchase button toggles a fixed "unavailable" notice (`features/dashboard/dashboard.tsx`).
- In production the API also serves `apps/web/dist`; the shop must not depend on that and is deployed as its own static site.

## Proposal

1. **Schema** (`db/schema.ts` + one generated migration):
   - `users` (email unique, password hash), `sessions` (token hash, user, expiry).
   - `products` (name, description, credits, price in fen, active, sort), seeded with placeholder packs.
   - `orders`: `orderNo` (unguessable), optional `userId`, contact `email`, optional order-password hash, product snapshot (name, credits), `quantity`, `amount` (fen), `method` (`alipay` / `usdt`), `payAmount` (fen or micro-USDT), `payUrl`, `status` (`pending` / `paid`; expiry is derived from `expiresAt`), unique `tradeNo`, timestamps.
   - `cdkeys.orderId` (nullable FK) links issued keys to their order.
2. **Shop API** (`modules/shop/`), under `/api/shop`, documented in OpenAPI:
   - `GET /catalog` - active products and the payment methods that are configured.
   - `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` - email + password (argon2id via `Bun.password`), opaque bearer session token stored hashed. Bearer rather than cookie because the shop is a different origin.
   - `POST /orders` - guest (email + order password) or signed-in; price and credits come from the server-side product.
   - `GET /orders/:orderNo` - order by number (the number is the capability), with keys once paid.
   - `POST /orders/lookup` - guest lookup by email + order password.
   - `GET /orders` - signed-in user's orders.
   - `POST /payments/alipay/notify` - Alipay async callback.
3. **Payments** (`modules/shop/payments.ts`), each enabled only when its env is set:
   - Alipay: official `alipay.trade.precreate` (QR), RSA2 signing/verification with `node:crypto`, no SDK. The callback is accepted only with a valid signature, matching `app_id`, matching amount and a success trade status.
   - USDT (TRC20): one receiving address, a unique amount per pending order (0.0001 steps), fixed `USDT_CNY_RATE`; a poller reads confirmed transfers from TronGrid and matches amount + time window; a transaction id can settle only one order.
   - Fulfilment is one immediate transaction: `pending -> paid`, then issue `quantity` keys. Replays issue nothing.
4. **Cross-origin**: `CORS_ORIGINS` env applied with `hono/cors` on `/api`; empty keeps same-origin behavior.
5. **Shop app** `apps/shop` (`@cdk/shop`), same stack and gates as `apps/web`, light theme, zh-CN, laid out after the reference storefront: notice + product grid (`/`), product detail with quantity / contact / order password / payment method (`/products/$id`), payment page with QR, countdown and polling that turns into the key list (`/orders/$orderNo`), order query with browser / order-password / order-number / my-orders tabs (`/orders`), `/login`, `/register`. Build-time env: `VITE_API_URL`, `VITE_DASHBOARD_URL`. Output is a plain static `dist`.
6. **Dashboard link**: `VITE_SHOP_URL` in `apps/web`; when set, the purchase button opens the shop, otherwise the existing notice stays.
7. **Tooling/docs**: root scripts, nsl name `shop.cdk`, `.env.example`, README, `docs/architecture.md`, changelog.

Verification, tests written first: API tests for catalog, register/login/session, order creation with server-side price, guest lookup, forged / wrong-amount / wrong-app callbacks rejected, a valid callback issuing exactly `quantity` keys, replay idempotency, USDT unique amounts and transfer matching, CORS allow/deny; shop component tests for buy -> pay -> keys and order lookup; `bun run check`.

## Risks

- Payment confirmation is the trust boundary: signature, amount and idempotency must all hold or keys can be minted for free.
- The order number alone reveals the keys; it has 96 random bits and responses are `no-store`, but it appears in the URL and browser history.
- USDT matching by amount depends on buyers sending the exact amount; under- or over-payments are not matched and need manual handling. The CNY rate is a static setting.
- No email verification or password reset (no mail service), and no rate limiting on login or order creation.
- Neither provider can be exercised end to end without merchant credentials and a publicly reachable `APP_URL`; until then the paid paths are covered by signed-callback and stubbed-TronGrid tests only.

## Scope

New `apps/shop`, new `modules/shop`, schema + one migration, config/env, CORS in `app.ts`, USDT poller in `index.ts`, one button in the dashboard, shared contracts, tests, docs. No refunds, coupons, balance payment, WeChat Pay, stock management or admin UI.

## Alternatives

- Put the purchase page inside `apps/web`: less code, but contradicts the independent-deployment requirement.
- Give the shop its own backend/database: duplicates key issuance and needs a service-to-service channel; rejected because the service stays behind the one API.
- Alipay page pay (`alipay.trade.page.pay`) or an aggregator gateway instead of precreate: precreate needs the least merchant onboarding and gives one payment page for both methods.
- Extract UI primitives into `packages/ui`: deferred; the shop copies the few shadcn primitives it needs.

## Annotations

User: pay with Alipay and USDT; add registration/login and order query; follow the supplied storefront screenshots. Taken as approval.

Defaults chosen where unspecified: placeholder packs (1 / 3 / 10 credits), official Alipay precreate, USDT on TRC20 with self-hosted matching, email + password accounts.
