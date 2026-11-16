# cdk - Plan Index

> Updated: 2026-11-11

## Usage

Each plan is a single line linking to its detail file. All detailed information lives in `docs/plan/<timestamp>-<feature-slug>.md`.

### Format

- [ ] [**20260907-1440-add-endpoint Add endpoint**](20260907-1440-add-endpoint.md) `YYYY-MM-DD`

### Status Markers

| Marker | Meaning |
|--------|---------|
| `[ ]`  | Draft / Pending review |
| `[-]`  | Approved / Implementing |
| `[x]`  | Completed |
| `[~]`  | Rejected / Abandoned |
| `[d]`  | Deleted detail file; index entry retained |

### Rules

- Only update the checkbox marker; never delete the line or change its other content. If the detail file is deleted, mark the entry `[d]`.
- Record change history and deletion reasons in `docs/changelog.md`; update affected task and plan references.
- New plans append to the end.
- See each `<timestamp>-<feature-slug>.md` for full details, except `[d]` entries whose files have been deleted; consult `docs/changelog.md` for their history.

---

## Plans

- [x] [**20261111-0805-scaffold-monorepo Scaffold Bun monorepo shell (api + web)**](20261111-0805-scaffold-monorepo.md) `2026-11-11`
- [x] [**20261111-0820-replace-eslint-with-biome Replace ESLint with Biome**](20261111-0820-replace-eslint-with-biome.md) `2026-11-11`

- [x] [**20261111-0831-implement-dashboard-interactions Implement dashboard interactions**](20261111-0831-implement-dashboard-interactions.md) `2026-11-11`
- [x] [**20261111-0857-add-key-shop-app Add standalone key purchase app**](20261111-0857-add-key-shop-app.md) `2026-11-11`
- [x] [**20261111-0916-remove-shop-accounts Remove shop accounts**](20261111-0916-remove-shop-accounts.md) `2026-11-11`
- [x] [**20261111-0953-add-dev-mock-payment Add development-only mock payment**](20261111-0953-add-dev-mock-payment.md) `2026-11-11`
- [x] [**20261111-1003-add-admin-app Add standalone admin app**](20261111-1003-add-admin-app.md) `2026-11-11`
- [x] [**20261111-1017-unify-frontend-style Unify the style of the three frontends**](20261111-1017-unify-frontend-style.md) `2026-11-11`
- [x] [**20261111-1050-task-credential-format Require email/password/2FA for a task**](20261111-1050-task-credential-format.md) `2026-11-11`
- [x] [**20261111-1108-admin-task-view Admin task management view**](20261111-1108-admin-task-view.md) `2026-11-11`
- [x] [**20261111-1123-integrate-execution-worker Integrate the execution worker**](20261111-1123-integrate-execution-worker.md) `2026-11-11`
- [x] [**20261116-0212-deploy-cloudflare-workers Deploy on Cloudflare Workers with D1/Turso**](20261116-0212-deploy-cloudflare-workers.md) `2026-11-16`
- [x] [**20261116-0247-add-deploy-script Add a one-command build and deploy script**](20261116-0247-add-deploy-script.md) `2026-11-16`
- [x] [**20261116-0253-split-deploy-workflow Manual deploy workflow and libSQL by default**](20261116-0253-split-deploy-workflow.md) `2026-11-16`
- [x] [**20261116-0302-production-test-payment Test payment on deployments, guarded by a code and Turnstile**](20261116-0302-production-test-payment.md) `2026-11-16`
