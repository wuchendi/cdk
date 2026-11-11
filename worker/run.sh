#!/usr/bin/env bash
# Linux/macOS launcher for the API-driven execution worker.
# Needs a real Chrome/Chromium and a display (desktop, or run under xvfb-run).
set -euo pipefail
cd "$(dirname "$0")"

python3 -m venv .venv 2>/dev/null || true
# shellcheck disable=SC1091
. .venv/bin/activate

pip install -q -r requirements.txt
python -m playwright install chromium

# Pass --once to drain the queue and exit; no args = poll forever.
exec python task_worker.py "$@"
