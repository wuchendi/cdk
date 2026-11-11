# 20261111-1050-task-credential-format Require email/password/2FA for a task

- **status**: completed
- **priority**: P1
- **owner**: maintainer/cred-20261111-1050
- **createdAt**: 2026-11-11 10:50

## Description

Task creation currently collects only an email, which is not enough for the execution service to log in. Collect account email, password and 2FA secret in one field with the fixed format `邮箱----密码----2FA密钥` (`----` separators), validated to that format. The secrets are stored for the worker and never returned in the task list.

## ActiveForm

Requiring full account credentials for a task.

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

Requested directly by the user; approval given in the request. The existing security warning told buyers not to submit passwords/2FA, which contradicts this and is updated.

- complete: bun run check passes (api 36, web 8, shop 5, admin 4); verified on the dev API: bad format 422, good format stores email/password/totp with the secret normalised, password absent from the response.
