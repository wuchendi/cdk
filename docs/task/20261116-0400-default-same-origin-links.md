# 20261116-0400-default-same-origin-links Default the shop and dashboard links to the same origin

- **status**: completed
- **priority**: P1
- **owner**: claude/session-20261116-0400
- **createdAt**: 2026-11-16 04:00

## Description

On the deployed Worker the dashboard's "购买Key" button shows "购买渠道暂未配置" because `VITE_SHOP_URL` is empty at build time (CI has no `apps/web/.env`). Likewise the shop's post-payment dashboard link is hidden (`VITE_DASHBOARD_URL`). Since the SPAs now share one origin, default these links to `/shop/` and `/`.

## ActiveForm

Defaulting the cross-app links to the same origin.

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

Reported from the live deployment (screenshot).

- complete: web and shop tests updated (RED->GREEN); bun run check passes.
