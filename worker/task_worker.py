"""API-driven execution worker for the cdk task system.

Instead of the local config.json + paste-import of the standalone console
(app.py), this polls the cdk admin API for pending tasks, runs the Playwright
automation for each account, and reports progress and the final result back to
the task. Card and proxy settings stay operator-local in config.json / env.

Run on the operator's machine (real Chrome + US proxy):
    python task_worker.py            # poll forever
    python task_worker.py --once     # drain the queue once and exit
"""

import asyncio
import json
import os
import sys
from typing import Any, Dict

from automation_engine import GoogleUltraAutomator
from cdk_api import CdkApi, CdkApiError

HERE = os.path.dirname(os.path.abspath(__file__))

# task_type -> engine target plan. The engine currently always drives the
# zero-cost 24-month pipeline; this mapping is where per-duration limiting
# would attach once the engine supports it.
TASK_PLAN = {
    "sub6": "pro_2year_zero",
    "sub12": "pro_2year_zero",
    "sub24": "pro_2year_zero",
}


def load_config() -> Dict[str, Any]:
    path = os.path.join(HERE, "config.json")
    if not os.path.exists(path):
        sys.exit(
            "worker/config.json not found — copy config.example.json to "
            "config.json and fill in the card and proxy."
        )
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def task_to_account(task: Dict[str, Any]) -> Dict[str, Any]:
    """Map a cdk task to the account dict the engine expects."""
    return {
        "id": f"task-{task['id']}",
        "email": task["email"],
        "password": task["password"],
        "recovery_email": "",
        "totp_secret": task["totpSecret"],
        "proxy": "",
        "ip_info": "",
        "status": "pending",
        "current_step": 0,
        "step_message": "",
        "expiry_date": "-",
        "last_screenshot": "",
    }


async def run_task(api: CdkApi, cfg: Dict[str, Any], task: Dict[str, Any]) -> None:
    account = task_to_account(task)
    last_msg = {"value": ""}

    def on_log(line: str) -> None:
        print(line, flush=True)

    def on_state(patch: Dict[str, Any]) -> None:
        # Mirror the engine's step messages onto the task as live progress.
        msg = patch.get("step_message")
        if msg and msg != last_msg["value"]:
            last_msg["value"] = msg
            try:
                api.update_task(task["id"], "running", msg)
            except CdkApiError as exc:
                print(f"[worker] progress push failed: {exc}", flush=True)

    try:
        api.update_task(task["id"], "running", "执行端已接单")
    except CdkApiError as exc:
        print(f"[worker] could not claim task {task['id']}: {exc}", flush=True)
        return

    automator = GoogleUltraAutomator(
        account=account,
        card=cfg.get("card", {}),
        target_region=cfg.get("target_region", "US"),
        target_plan=TASK_PLAN.get(task["taskType"], "pro_2year_zero"),
        auto_cancel=cfg.get("auto_cancel", True),
        proxy_template=cfg.get("proxy_template", ""),
        port=int(cfg.get("base_port", 9320)),
        on_log=on_log,
        on_state=on_state,
    )

    try:
        await automator.run_pipeline()
    except Exception as exc:  # noqa: BLE001 - report any engine failure to the task
        api.update_task(task["id"], "failed", f"执行异常: {str(exc)[:400]}")
        return

    completed = account.get("status") == "completed"
    expiry = account.get("expiry_date") or "-"
    if completed:
        detail = f"办理完成，到期 {expiry}" if expiry != "-" else "办理完成"
    else:
        detail = account.get("step_message") or "执行失败，请在执行端查看日志"
    api.update_task(task["id"], "success" if completed else "failed", detail[:500])


async def main() -> None:
    cfg = load_config()
    base = os.environ.get("CDK_API_URL") or cfg.get("api_url")
    token = os.environ.get("CDK_ADMIN_TOKEN") or cfg.get("admin_token")
    if not base or not token:
        sys.exit(
            "set the API connection: CDK_API_URL + CDK_ADMIN_TOKEN "
            "(env) or api_url + admin_token (config.json)."
        )
    api = CdkApi(base, token)
    once = "--once" in sys.argv
    interval = int(os.environ.get("CDK_POLL_SECONDS", cfg.get("poll_seconds", 15)))
    print(f"[worker] polling {base} every {interval}s (once={once})", flush=True)

    while True:
        try:
            tasks = api.pending_tasks()
        except CdkApiError as exc:
            print(f"[worker] poll failed: {exc}", flush=True)
            tasks = []
        for task in tasks:
            print(
                f"[worker] task {task['id']} {task['email']} ({task['taskType']})",
                flush=True,
            )
            await run_task(api, cfg, task)
        if once:
            break
        await asyncio.sleep(interval)


if __name__ == "__main__":
    asyncio.run(main())
