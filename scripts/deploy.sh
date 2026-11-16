#!/usr/bin/env bash
# Builds and deploys the Cloudflare Worker (API + SPAs) in one go.
#
#   bash scripts/deploy.sh [--skip-check] [--no-migrate] [--dry-run]
#
# Steps: preflight -> check (or build) -> migrate -> deploy -> secrets.
# The database driver follows apps/api/wrangler.jsonc: an uncommented
# d1_databases block means D1, otherwise libSQL/Turso (default; migrating needs
# DATABASE_URL + DATABASE_AUTH_TOKEN in the env).
# Secrets come from the WORKER_SECRETS env var (JSON) or apps/api/.secrets.json;
# empty values are dropped so they never wipe an existing Worker secret.
set -euo pipefail

cd "$(dirname "$0")/.."
API_DIR=apps/api
CONFIG="$API_DIR/wrangler.jsonc"
SECRETS_FILE="$API_DIR/.secrets.json"
PLACEHOLDER_ID=00000000-0000-0000-0000-000000000000

skip_check=false
migrate=true
dry_run=false
for arg in "$@"; do
  case "$arg" in
    --skip-check) skip_check=true ;;
    --no-migrate) migrate=false ;;
    --dry-run) dry_run=true ;;
    *)
      echo "unknown option: $arg" >&2
      exit 2
      ;;
  esac
done

step() { printf '\n==> %s\n' "$*"; }
fail() {
  echo "error: $*" >&2
  exit 1
}
wrangler() { (cd "$API_DIR" && bunx wrangler "$@"); }
# wrangler.jsonc without // comment lines
config() { grep -vE '^\s*//' "$CONFIG"; }

step "Preflight"
if config | grep -q '"d1_databases"'; then
  driver=d1
  if config | grep -q "$PLACEHOLDER_ID"; then
    fail "D1 database_id in $CONFIG is the placeholder; run 'cd $API_DIR && bunx wrangler d1 create cdk' and paste the id"
  fi
else
  driver=libsql
  if $migrate && ! $dry_run && [[ -z "${DATABASE_URL:-}" || -z "${DATABASE_AUTH_TOKEN:-}" ]]; then
    fail "libSQL deployment: set DATABASE_URL and DATABASE_AUTH_TOKEN to migrate (or pass --no-migrate)"
  fi
fi
echo "database: $driver"
command -v jq >/dev/null || fail "jq is required"
if ! $dry_run; then
  wrangler whoami --json >/dev/null 2>&1 ||
    fail "wrangler is not authenticated; run 'bunx wrangler login' or set CLOUDFLARE_API_TOKEN"
fi

step "Install"
bun install --frozen-lockfile

if $skip_check; then
  step "Build"
  bun run build
else
  step "Check (lint, typecheck, test, build)"
  bun run check
fi

if $dry_run; then
  step "Deploy (dry run)"
  wrangler deploy --dry-run
  exit 0
fi

if $migrate; then
  step "Migrate ($driver)"
  if [[ $driver == d1 ]]; then
    wrangler d1 migrations apply DB --remote
  else
    bun "$API_DIR/src/db/migrate-cli.ts"
  fi
fi

step "Deploy"
wrangler deploy

secrets=""
if [[ -n "${WORKER_SECRETS:-}" ]]; then
  secrets=$WORKER_SECRETS
elif [[ -f "$SECRETS_FILE" ]]; then
  secrets=$(cat "$SECRETS_FILE")
fi
if [[ -n "$secrets" ]]; then
  step "Secrets"
  tmp=$(mktemp)
  trap 'rm -f "$tmp"' EXIT
  jq 'with_entries(select(.value != null and .value != ""))' <<<"$secrets" >"$tmp"
  if [[ $(jq length "$tmp") -eq 0 ]]; then
    echo "no non-empty secrets; skipped"
  else
    jq -c keys "$tmp"
    wrangler secret bulk "$tmp"
  fi
fi

step "Done"
