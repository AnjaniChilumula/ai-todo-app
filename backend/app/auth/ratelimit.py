"""Slow down password guessing.

Five failed sign-ins for the same email from the same IP address within 15 minutes lock that pair
for 15 minutes. The counts live in memory, which is fine for one server process; a setup with
several processes would keep them in a shared store such as Redis.
"""

import math
from datetime import datetime, timedelta
from threading import Lock

from app.models import utcnow

MAX_FAILURES = 5
WINDOW = timedelta(minutes=15)
LOCKOUT = timedelta(minutes=15)

Key = tuple[str, str]  # (email, ip)


class LoginLimiter:
    def __init__(self) -> None:
        self._failures: dict[Key, list[datetime]] = {}
        self._locked_until: dict[Key, datetime] = {}
        self._lock = Lock()

    def retry_after(self, key: Key) -> int | None:
        """Seconds until this email + IP may try again, or None if not locked."""
        with self._lock:
            until = self._locked_until.get(key)
            if until is None:
                return None
            remaining = (until - utcnow()).total_seconds()
            if remaining <= 0:
                del self._locked_until[key]
                return None
            return math.ceil(remaining)

    def record_failure(self, key: Key) -> None:
        now = utcnow()
        with self._lock:
            recent = [t for t in self._failures.get(key, []) if now - t < WINDOW] + [now]
            if len(recent) >= MAX_FAILURES:
                self._locked_until[key] = now + LOCKOUT
                self._failures.pop(key, None)
            else:
                self._failures[key] = recent

    def reset(self, key: Key) -> None:
        with self._lock:
            self._failures.pop(key, None)
            self._locked_until.pop(key, None)

    def clear(self) -> None:
        """Forget everything (used by tests)."""
        with self._lock:
            self._failures.clear()
            self._locked_until.clear()


login_limiter = LoginLimiter()
