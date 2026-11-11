# cdk - Task List

> Updated: 2026-11-11

## Usage

Each task is a single line linking to its detail file. All detailed information lives in `docs/task/<timestamp>-<feature-slug>.md`.

### Format

- [ ] [**20260907-1428-add-endpoint Add endpoint**](20260907-1428-add-endpoint.md) `P1`

### Status Markers

| Marker | Meaning |
|--------|---------|
| `[ ]`  | Pending |
| `[-]`  | In progress |
| `[x]`  | Completed |
| `[~]`  | Closed / Won't do |
| `[d]`  | Deleted detail file; index entry retained |

### Priority: P0 (blocking) > P1 (high) > P2 (medium) > P3 (low)

### Rules

- Only update the checkbox marker; never delete the line or change its other content. If the detail file is deleted, mark the entry `[d]`.
- Record change history and deletion reasons in `docs/changelog.md`; update affected dependency and plan references.
- New tasks append to the end.
- See each `<timestamp>-<feature-slug>.md` for full details, except `[d]` entries whose files have been deleted; consult `docs/changelog.md` for their history.

---

## Tasks

- [x] [**20261111-0805-scaffold-monorepo Scaffold Bun monorepo shell (api + web)**](20261111-0805-scaffold-monorepo.md) `P1`
- [x] [**20261111-0820-replace-eslint-with-biome Replace ESLint with Biome**](20261111-0820-replace-eslint-with-biome.md) `P1`
- [x] [**20261111-0822-add-dev-clean-scripts Add root dev and clean scripts**](20261111-0822-add-dev-clean-scripts.md) `P2`

- [x] [**20261111-0831-implement-dashboard-interactions Implement dashboard interactions**](20261111-0831-implement-dashboard-interactions.md) `P1`
- [x] [**20261111-0857-add-key-shop-app Add standalone key purchase app**](20261111-0857-add-key-shop-app.md) `P1`
- [x] [**20261111-0916-remove-shop-accounts Remove shop accounts**](20261111-0916-remove-shop-accounts.md) `P1`
- [x] [**20261111-0953-add-dev-mock-payment Add development-only mock payment**](20261111-0953-add-dev-mock-payment.md) `P1`
- [x] [**20261111-1003-add-admin-app Add standalone admin app**](20261111-1003-add-admin-app.md) `P1`
- [x] [**20261111-1017-unify-frontend-style Unify the style of the three frontends**](20261111-1017-unify-frontend-style.md) `P1`
- [x] [**20261111-1050-task-credential-format Require email/password/2FA for a task**](20261111-1050-task-credential-format.md) `P1`
- [x] [**20261111-1108-admin-task-view Admin task management view**](20261111-1108-admin-task-view.md) `P1`
