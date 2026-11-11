# 20261111-0831-implement-dashboard-interactions Implement dashboard interactions

- **status**: completed
- **createdAt**: 2026-11-11 08:31
- **approvedAt**: 2026-11-11 08:33
- **relatedTask**: 20261111-0831-implement-dashboard-interactions

## Context

The screenshot describes a key-gated task dashboard. Current web content is a placeholder with fixed zero statistics. API routes only implement health and documentation. Existing SQLite tables contain keys, balances and tasks; shared constants define types and costs. Both apps already have tests. No worker, external execution integration, payment integration or purchase destination exists.

## Proposal

1. Add API-backed key validation and balance display, logout, and scoped task reads. Verify invalid keys and isolation between keys through API tests.
2. Add task submission with email and task-type validation and atomic credit deduction using existing costs. Verify insufficient balance, invalid inputs and duplicate requests against SQLite tests.
3. Build screenshot-aligned Chinese dashboard controls: dismissible notice, status statistics, queue summary, task form, status tabs, email search, pagination, refresh and pending-task deletion with credit refund. Verify ownership, refund-once behavior and UI interactions with failing tests before implementation.
4. Connect API documentation to the existing docs endpoint. Display an explicit unavailable state for purchasing until a real destination is supplied. Keep tasks pending until a real worker is connected; never simulate success.
5. Run focused tests and the repository check command (lint, typecheck, tests and build).

## Risks

Key-scoped authorization and credit mutations require isolation and transaction tests. The initial scope provides real task management but cannot perform external subscriptions without an execution integration. Purchase checkout requires a real provider or URL. Keep keys out of URLs and logs; do not persist account passwords.

## Scope

Web dashboard, Chinese translations, feature hooks, API task/key modules, shared contracts, tests, and required tracking files. Reuse the current stack and schema where possible; no dependency upgrades or payment/worker simulation.

## Alternatives

Frontend-only mock interactions are smaller but do not satisfy functional task management. Full execution and checkout integration require actual service contracts and credentials and can follow the management flow.

## Annotations

User approved the proposed scope: yes, go.
