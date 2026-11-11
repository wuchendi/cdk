"""Minimal client for the cdk admin task API (stdlib only).

The execution worker pulls pending tasks and reports their status back through
these two endpoints, authenticating with the admin bearer token.
"""

import json
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional


class CdkApiError(RuntimeError):
    pass


class CdkApi:
    def __init__(self, base_url: str, token: str):
        self.base = base_url.rstrip("/")
        self.token = token

    def _request(
        self, method: str, path: str, body: Optional[Dict[str, Any]] = None
    ) -> Any:
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(
            f"{self.base}{path}",
            data=data,
            method=method,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise CdkApiError(f"{method} {path} -> HTTP {exc.code}: {detail}") from exc
        except urllib.error.URLError as exc:
            raise CdkApiError(f"{method} {path} -> {exc.reason}") from exc
        if not payload.get("success"):
            raise CdkApiError(payload.get("error", {}).get("message", "api error"))
        return payload["data"]

    def pending_tasks(self) -> List[Dict[str, Any]]:
        """Pending tasks (newest first) with their account credentials."""
        return self._request("GET", "/api/admin/tasks?status=pending&page=1")["items"]

    def update_task(
        self, task_id: int, status: str, message: Optional[str] = None
    ) -> Dict[str, Any]:
        body: Dict[str, Any] = {"status": status}
        if message is not None:
            body["message"] = message[:500]
        return self._request("PATCH", f"/api/admin/tasks/{task_id}", body)
