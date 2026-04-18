"""Script mock para simular el heartbeat del agente PC durante desarrollo.

Corre en loop enviando POST /system/heartbeat cada 10s.
Útil para probar la UI del SystemPage sin agent.py real corriendo.

Uso:
    python scripts/mock_heartbeat.py

Requiere:
    - Gateway corriendo en localhost:8003
    - .env con AGENT_API_KEY (o pasarlo como variable de entorno)
"""

from __future__ import annotations

import os
import platform
import time
from pathlib import Path

import httpx


def _load_env(path: Path) -> None:
    """Mini-parser de .env — evita dep extra."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    _load_env(root / ".env")

    gateway = os.getenv("MOCK_GATEWAY_URL", "http://localhost:8003")
    agent_key = os.getenv("AGENT_API_KEY")
    if not agent_key:
        raise SystemExit("AGENT_API_KEY no está en .env")

    url = f"{gateway}/system/heartbeat"
    headers = {"X-Agent-Key": agent_key}
    payload = {
        "agent_id": "agent_pc_mock",
        "metadata": {
            "hostname": platform.node(),
            "os": platform.system(),
            "python": platform.python_version(),
            "mock": True,
        },
    }

    print(f"[mock_heartbeat] Posting to {url} every 10s (Ctrl+C to stop)")
    with httpx.Client(timeout=5.0) as client:
        while True:
            try:
                r = client.post(url, headers=headers, json=payload)
                if r.status_code == 200:
                    print(f"  ✓ {r.json()['received_at']}")
                else:
                    print(f"  ✗ {r.status_code}: {r.text[:120]}")
            except httpx.HTTPError as exc:
                print(f"  ✗ error: {exc}")
            time.sleep(10)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[mock_heartbeat] Detenido.")
