# 20261111-1108-admin-task-view Admin task management view

- **status**: completed
- **priority**: P1
- **owner**: maintainer/admintasks-20261111-1108
- **createdAt**: 2026-11-11 11:08

## Description

Add a task-management view to the admin console: list every cdkey's submitted task with its full account (email, password, 2FA) for the operator, filter by status and search by email/cdkey, and let the operator move a task through `running` / `success` / `failed` with a run note. This is the human-operation entry point until an execution worker is connected.

## ActiveForm

Adding the admin task view.

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

Requested and approved: "可以，按照推荐的来". Credentials are visible in the admin because the operator needs them; consistent with the plaintext storage already in place.

- complete: Admin tasks list + status update implemented; bun run check passes (api 37, admin 5, web 8, shop 5); verified on dev API: list shows credentials, PATCH to success sets message+completedAt, no-token 401.
