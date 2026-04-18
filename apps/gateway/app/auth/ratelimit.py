"""Rate limiting simple in-memory para login.

Usado en vez de slowapi por incompatibilidad con FastAPI + body Pydantic
(slowapi 0.1.9 rompe introspección de tipos al wrappear con *args/**kwargs).
"""

from __future__ import annotations

import time
from collections import deque
from threading import Lock


class RateLimiter:
    def __init__(self, max_attempts: int, window_seconds: int) -> None:
        self.max_attempts = max_attempts
        self.window = window_seconds
        self._events: dict[str, deque[float]] = {}
        self._lock = Lock()

    def check(self, key: str) -> bool:
        """True si queda cupo, False si ya superó el límite."""
        now = time.monotonic()
        cutoff = now - self.window
        with self._lock:
            bucket = self._events.setdefault(key, deque())
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            if len(bucket) >= self.max_attempts:
                return False
            bucket.append(now)
            return True

    def retry_after(self, key: str) -> int:
        with self._lock:
            bucket = self._events.get(key)
            if not bucket:
                return 0
            oldest = bucket[0]
            remaining = int(self.window - (time.monotonic() - oldest))
            return max(0, remaining)


login_limiter = RateLimiter(max_attempts=5, window_seconds=15 * 60)
