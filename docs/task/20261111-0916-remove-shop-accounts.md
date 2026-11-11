# 20261111-0916-remove-shop-accounts Remove shop accounts

- **status**: completed
- **priority**: P1
- **owner**: maintainer/shop-20261111-0916
- **createdAt**: 2026-11-11 09:16

## Description

Remove registration and login from the shop. Every buyer is a guest: ordering, paying, receiving keys and order query (browser orders, email + order password, order number) keep working without an account.

## ActiveForm

Removing shop accounts.

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

Requested directly by the user; approval given in the request.

- complete: Accounts removed from API, schema and shop; bun run check passes (api 28, web 8, shop 4 tests); migration 0002 verified on a database with orders, keys and accounts.
