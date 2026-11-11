# 20261111-0916-remove-shop-accounts Remove shop accounts

- **status**: completed
- **createdAt**: 2026-11-11 09:16
- **approvedAt**: 2026-11-11 09:16
- **relatedTask**: 20261111-0916-remove-shop-accounts

## Context

Accounts span `users` / `sessions` tables, `orders.user_id`, the `/api/shop/auth/*` routes, the signed-in branch of order creation, `GET /api/shop/orders`, and in `apps/shop` the login/register routes, the session store, the header controls and the "my orders" tab. Migration `0001` is already applied to the local database, so it is not rewritten.

## Proposal

1. API: delete the auth routes, session helpers and `GET /shop/orders`; order creation always requires email + order password.
2. Schema: drop `users`, `sessions` and `orders.user_id` in a new migration.
3. Shop: delete the login/register routes and `auth.tsx`, the session store, header sign-in controls and the "my orders" tab; the order form always shows email + order password.
4. Shared contracts, tests and docs follow. Verify with `bun run check`.

## Risks

The migration drops both account tables; any registered accounts are deleted (none exist locally). Orders keep their email and order password, so guest lookup is unaffected.

## Scope

`apps/api` shop module, schema and one migration, `apps/shop`, `packages/shared`, tests, docs.

## Alternatives

Hide the UI but keep the backend: leaves unused, unauthenticated-registration surface; rejected.

## Annotations

User: remove login and registration; guests keep buying and the other operations.
