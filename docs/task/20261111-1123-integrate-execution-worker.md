# 20261111-1123-integrate-execution-worker Integrate the execution worker

- **status**: completed
- **priority**: P1
- **owner**: maintainer/worker-20261111-1123
- **createdAt**: 2026-11-11 11:23

## Description

Bring the Google-Pro automation helper (`batch/`, currently in gitignored `.tmp/`) into the repo as `worker/` and wire it to our business: instead of its local `config.json` + paste-import + manual run, it pulls `pending` tasks from the admin API, runs the Playwright engine, and reports `running`/`success`/`failed` with a note back to the task.

## ActiveForm

Integrating the execution worker.

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

Requested and approved. The Playwright engine (`automation_engine.py`) is kept as-is — only the orchestration is rewritten. It runs on the operator's Windows machine (real Chrome + US proxy); it cannot run on the headless `station` container, so it is not executed here, only syntax-checked.

- complete: batch vendored into worker/ and wired via task_worker.py (poll pending -> run engine -> report status); py_compile clean, bun run check passes; engine kept as-is, runs operator-side, not executed here.
