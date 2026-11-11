# 20261111-1108-admin-task-view Admin task management view

- **status**: completed
- **createdAt**: 2026-11-11 11:08
- **approvedAt**: 2026-11-11 11:08
- **relatedTask**: 20261111-1108-admin-task-view

## Context

Tasks are only readable per-cdkey via `/api/tasks`; the serialised task omits password/totp. The admin module (`/api/admin`) has products and orders but no tasks. The operator has no way to see submitted jobs or move them forward.

## Proposal

1. API, under `/api/admin` (existing `ADMIN_TOKEN` guard):
   - `GET /admin/tasks` — all tasks joined to their cdkey code, filter by status, search email or cdkey code, paginated. Returns email, password and totp_secret (admin-only).
   - `PATCH /admin/tasks/:id` — set status to `pending`/`running`/`success`/`failed` and an optional `message`; `completed_at` is set when success/failed, cleared otherwise.
2. Shared: `AdminTask`, `AdminTaskList`.
3. Admin app: `/tasks` route and page — table with account (copyable `email----password----2FA`), status filter, search, pagination, and a per-row status change with an optional run note.
4. Tests (API + component), docs.

## Risks

- Password and 2FA are exposed to anyone holding `ADMIN_TOKEN`; acceptable per the approved scope and consistent with plaintext storage. Responses are `no-store`.
- Free status transitions (operator discretion); no worker yet.

## Scope

`packages/shared`, `apps/api/src/modules/admin`, `apps/admin`, tests, docs. No schema change (columns exist).

## Alternatives

Put tasks in the dashboard for an admin key: mixes buyer and operator surfaces; rejected.

## Annotations

User approved the recommended scope.
