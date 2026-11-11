# 20261111-1123-integrate-execution-worker Integrate the execution worker

- **status**: completed
- **createdAt**: 2026-11-11 11:23
- **approvedAt**: 2026-11-11 11:23
- **relatedTask**: 20261111-1123-integrate-execution-worker

## Context

The helper is a Windows FastAPI console (`app.py`) + a 96KB Playwright engine (`automation_engine.py`). The engine takes an `account` dict (`id/email/password/totp_secret/recovery_email/proxy`) and reports progress via an `on_state` callback (`status`, `step_message`, `expiry_date`); on success `account['status']` becomes `completed`, on failure `error`. Our task format (`email----password----2FA`) and the admin task API (`GET /api/admin/tasks?status=pending` with credentials, `PATCH /api/admin/tasks/:id`) already match.

## Proposal

1. Copy `batch/` to `worker/` (tracked). Keep `automation_engine.py`, `app.py` (manual console), `templates/`, `tests/`, `.bat`, `requirements.txt` unchanged.
2. Add `worker/cdk_api.py` — stdlib `urllib` client for the admin task endpoints (bearer `ADMIN_TOKEN`).
3. Add `worker/task_worker.py` — poll pending tasks, map each to an account dict, set `running`, run `run_pipeline()`, push `step_message` as progress, then `success`/`failed` with a note. `--once` and loop modes.
4. Config/secrets stay operator-side: `worker/config.example.json` (card, proxy, region, api_url) and `worker/.env.example`; `worker/.gitignore` ignores `config.json`, `.env`, `profiles/`, `screenshots/`, `__pycache__/`.
5. README (worker) + architecture + changelog. No API/schema change (endpoints already exist).

Verify: `python -m py_compile` on the new modules; our gate (`bun run check`) still passes.

## Risks

- The engine is Windows-only (netstat/taskkill, interactive desktop) and needs a real Chrome + US proxy; it runs on the operator machine, not here, and is not executed during this change.
- `task_type` (sub6/sub12/sub24) vs the engine's fixed 24-month pipeline: mapped through `target_plan` but the engine currently always targets 24 months; per-type limiting is a documented follow-up.
- The engine needs no recovery email for 2FA accounts; our tasks don't collect one (passed empty).
- A worker crash mid-run leaves a task `running`; the operator resets it to `pending` in admin.

## Scope

New `worker/` tree and two new Python modules; docs. No change to the Bun apps or the DB.

## Alternatives

Rewrite the engine in Bun/TypeScript, or run it headless server-side: huge and fragile, and Google verification needs a real desktop; rejected.

## Annotations

User: move batch into the project (it's gitignored now) and rewrite it to wire into our business.
