# 20261111-0953-add-dev-mock-payment Add development-only mock payment

- **status**: completed
- **priority**: P1
- **owner**: maintainer/shop-20261111-0953
- **createdAt**: 2026-11-11 09:53

## Description

Add a `mock` payment method so the order -> pay -> keys flow can be exercised in development without merchant credentials. It must be impossible to enable outside development.

## ActiveForm

Adding the development-only mock payment.

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

Requested directly by the user; approval given in the request.

- complete: bun run check passes (api 30, web 8, shop 5 tests); mock order settled against the running dev API and the issued key activated.
