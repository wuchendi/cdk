# 20261111-1050-task-credential-format Require email/password/2FA for a task

- **status**: completed
- **createdAt**: 2026-11-11 10:50
- **approvedAt**: 2026-11-11 10:50
- **relatedTask**: 20261111-1050-task-credential-format

## Context

`tasks` holds only `email`. `POST /api/tasks` validates `{ email, taskType }`, dedups on email, and the dashboard form has one email field. The dashboard warns buyers not to submit password/2FA.

## Proposal

1. Schema: add `password` and `totp_secret` to `tasks` (NOT NULL default '' so the migration is safe on existing rows); one generated migration.
2. API: the request body becomes `{ credential, taskType }`. `credential` is one string split on `----` into exactly three parts — email (valid, lowercased), password (1–128 chars), 2FA secret (base32, 16–64 chars, spaces stripped, upper-cased); any deviation is a 422. Store all three; dedup still on email. The serialised task never includes password or totp (write-only).
3. Web: the single field becomes 账号信息 with the format as a hint and placeholder; it sends the raw `credential` string. The contradictory security warning is rewritten to say credentials are used to log in, to submit only owned/authorised accounts, to omit payment data, and to change the password afterwards.
4. Tests and docs follow.

## Risks

- Passwords and 2FA secrets are stored in plaintext in SQLite — the worker must read them back and there is no key management, so encryption is deferred. Access to the DB file exposes live credentials. This is the main caution.
- If a password contains `----` the split rejects it; acceptable given the batch-format convention.

## Scope

`packages/shared`, `apps/api` (schema, migration, tasks module), `apps/web` (form, copy), tests, docs. No shop/admin change.

## Alternatives

Three separate inputs instead of one `----` field: clearer per-field errors, but the user asked for the single fixed-format field used by these services.

## Annotations

User: the create-task form only has email; it needs 邮箱----密码----2FA密钥 with a fixed format.
