# 20261111-1017-unify-frontend-style Unify the style of the three frontends

- **status**: completed
- **priority**: P1
- **owner**: maintainer/ui-20261111-1017
- **createdAt**: 2026-11-11 10:17

## Description

The dashboard (dark, amber), shop and admin (light, indigo) look like different products and each carries its own copy of the theme, UI primitives and HTTP client. Give all three one theme, one set of primitives and one page shell, from a single shared package.

## ActiveForm

Unifying the frontend style.

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

Requested directly by the user; approval given in the request. The target look (light, indigo) is the assistant's choice: two of the three apps already use it and it follows the storefront reference the user supplied.

- complete: bun run check passes (api 36, web 8, shop 5, admin 4 tests); browser pass over all three apps: identical background, header, brand colour, font and header height, no console errors, no horizontal overflow at 390px.
