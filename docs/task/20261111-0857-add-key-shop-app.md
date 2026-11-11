# 20261111-0857-add-key-shop-app Add standalone key purchase app

- **status**: completed
- **priority**: P1
- **owner**: maintainer/shop-20261111-0857
- **createdAt**: 2026-11-11 08:57

## Description

Add a separately deployed web app for buying access keys, wired end to end through the existing API: choose a credit pack, pay, receive a generated key, continue to the dashboard. The shop holds no state of its own; orders, payment confirmation and key issuance live in `apps/api`.

Acceptance: a paid order issues exactly one key with the purchased balance; an unpaid or forged payment issues none; the shop builds and deploys independently of the dashboard and reaches the API cross-origin; the dashboard's purchase button opens the shop.

## ActiveForm

Adding the standalone key purchase app.

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

Investigation: no order, product or payment code exists. Keys are only created by direct DB insert. The API serves same-origin only (no CORS). The dashboard's purchase button shows a fixed "unavailable" notice. Payment provider and pack pricing are not yet decided.

- complete: apps/shop and /api/shop implemented; bun run check passes (api 31, web 8, shop 5 tests); browser run against real API with a local TronGrid stand-in issued keys end to end. Real Alipay and TronGrid not exercised: no merchant credentials.
