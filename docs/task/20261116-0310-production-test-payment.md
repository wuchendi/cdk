# 20261116-0310-production-test-payment Test payment flow on a deployment without payment config

- **status**: completed
- **priority**: P1
- **owner**: claude/session-20261116-0310
- **createdAt**: 2026-11-16 03:10

## Description

After deploying to Workers (`NODE_ENV=production`) with neither Alipay nor USDT configured, the shop offers no payment method, so the purchase -> key -> task flow cannot be exercised. Add an explicitly enabled test payment path that works on a production deployment, like the development-only mock payment, without letting the public obtain free keys.

## ActiveForm

Adding a test payment path for deployments.

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

(none)

- complete: bun run check passes (api 49, shop 6); wrangler dev production mode verified against real siteverify with always-pass/always-fail test keys; widget not exercised in a browser.
