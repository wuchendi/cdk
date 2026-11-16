#!/usr/bin/env bash
# Merges the SPA builds into ./dist: dashboard at the root, shop/ and admin/ beside it.
set -euo pipefail

cd "$(dirname "$0")/.."

rm -rf ./dist
cp -r apps/web/dist ./dist
cp -r apps/shop/dist ./dist/shop
cp -r apps/admin/dist ./dist/admin

echo "Assembled ./dist"
