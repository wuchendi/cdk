# 20261111-0953-add-dev-mock-payment Add development-only mock payment

- **status**: completed
- **createdAt**: 2026-11-11 09:53
- **approvedAt**: 2026-11-11 09:53
- **relatedTask**: 20261111-0953-add-dev-mock-payment

## Context

Payment methods are offered only when configured (`payMethods`), and keys are issued solely by `fulfilOrder`. No credentials exist in development, so no order can be paid there. `NODE_ENV` defaults to `development` when unset.

## Proposal

1. `mock` joins `PAY_METHODS`. It is offered only when `SHOP_MOCK_PAY=true` **and** `NODE_ENV=development`; the flag is ignored in any other environment.
2. `POST /api/shop/orders/:orderNo/mock-pay` settles a pending, unexpired `mock` order through `fulfilOrder`; it answers 404 when the method is not enabled or the order uses another method.
3. Shop: the payment page shows a "simulate payment" button for `mock` orders.
4. A startup warning is logged while the method is enabled.

Tests first: enabled only with flag + development; refused in test and production; settles once; cannot settle orders of other methods.

## Risks

An enabled mock method mints keys for free. Because `NODE_ENV` defaults to `development`, the method needs the explicit flag as well, so a deployment that forgets `NODE_ENV` stays safe unless the flag was also copied.

## Scope

`packages/shared`, `apps/api` (config, shop module, schema type), `apps/shop` (order page, copy), tests, env example, docs. No migration: the method column is plain text.

## Alternatives

Gate on `NODE_ENV` alone: one setting less, but an unset `NODE_ENV` in production would hand out keys.

## Annotations

User: add a mock payment available only in development.
