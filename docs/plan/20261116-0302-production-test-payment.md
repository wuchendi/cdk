# 20261116-0302-production-test-payment Test payment on deployments, guarded by a code and Turnstile

- **status**: completed
- **createdAt**: 2026-11-16 03:02
- **approvedAt**: 2026-11-16 03:05
- **relatedTask**: 20261116-0310-production-test-payment

## Context

- `payMethods()` (`modules/shop/payments.ts`) offers `mock` only with `SHOP_MOCK_PAY=true` and `NODE_ENV=development`. Workers run with `NODE_ENV=production`, so a deployment without Alipay/USDT offers no method and `POST /shop/orders` fails with `METHOD_UNAVAILABLE`.
- The full mock flow already exists: `POST /shop/orders/:orderNo/mock-pay` -> `fulfilOrder(..., 'mock:<orderNo>')`; the shop's `MockPayment` panel (`apps/shop/src/features/shop/order.tsx`) has the "pay" button; admin lists the method as "模拟支付".
- Issued keys buy tasks that the operator's worker executes with a real card, so free keys on a public deployment cost real money.
- Reference: `/srv/ai/tinylink` `apps/api/src/lib/platform/turnstile.ts` (one siteverify fetch, enabled only when site key var + secret are both set, fail closed, 5 s timeout) and `apps/web/src/components/turnstile.tsx` (explicit-render widget, single-use token, `resetKey`).

## Proposal

### API

- Config: `SHOP_TEST_PAY_CODE` (secret, min 8 chars), `TURNSTILE_SITE_KEY` (var), `TURNSTILE_SECRET_KEY` (secret).
- `payMethods`: `mock` is offered when `SHOP_TEST_PAY_CODE` is set (any environment), or as today with `SHOP_MOCK_PAY=true` in development.
- `mock-pay` takes a JSON body `{ code?, turnstileToken? }`:
  - with `SHOP_TEST_PAY_CODE` set, `code` must match (constant-time compare) -> else 403 `INVALID_TEST_CODE`;
  - with Turnstile configured, the token is verified via siteverify (`remoteip` from `cf-connecting-ip`) -> else 400 `TURNSTILE_FAILED`. Fail closed on errors/timeouts.
- `GET /shop/catalog` adds `testPayCode: boolean` and `turnstileSiteKey: string | null`, so the shop needs no rebuild when keys change.
- New `shared/lib/turnstile.ts` (verify, injectable `fetch` for tests).

### Shop

- New `Turnstile` component in `apps/shop` (port of tinylink's, light theme only).
- `MockPayment`: code input when `testPayCode`, Turnstile widget when `turnstileSiteKey`; button disabled until required inputs exist; on failure the widget is reset (single-use token) and the error shown. Copy changes from "开发环境" to "测试支付".

### Config / deploy

- `wrangler.jsonc` vars: `TURNSTILE_SITE_KEY` (commented placeholder); `deploy.yml` + `.secrets.example.json` sync `SHOP_TEST_PAY_CODE`, `TURNSTILE_SECRET_KEY`; `.dev.vars.example` / `.env.example` document Cloudflare's always-pass test keys.
- Test orders keep `method = 'mock'` and trade marker `mock:<orderNo>`, already visible as "模拟支付" in admin.

### Tests

- API: method offered with the code in production; wrong/missing code 403; Turnstile missing/rejected token 400, accepted token settles once; siteverify error fails closed; catalog flags.
- Shop: code input + widget shown per catalog flags, button gated.

## Risks

- Turnstile only stops bots, not people: anyone with the code can still get keys, which is why the code stays. Remove `SHOP_TEST_PAY_CODE` after testing to make the method disappear.
- Turnstile needs the deployed hostname added to the widget in the Cloudflare dashboard, or the widget errors.

## Scope

~12 files across api, shop, shared, config and docs.

## Alternatives

- Turnstile without a code: blocks scripts only; any visitor clicking through gets free keys. Not recommended.
- Also put Turnstile on order creation (`POST /shop/orders`) for all methods: reduces order spam; can be added with the same helper.

## Annotations

- 2026-11-16: user asked for Cloudflare Turnstile on the pay click.
