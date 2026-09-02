"""In-process throttling for authentication attempts.

The store is per-process. A multi-worker or multi-instance deployment should
back this with Redis; the public helpers below are deliberately small so that
swapping the backing store does not change any call site.
"""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field

from app.config.settings import settings


@dataclass
class _Bucket:
    failures: list[float] = field(default_factory=list)
    locked_until: float = 0.0


class LoginThrottle:
    def __init__(self) -> None:
        self._buckets: dict[str, _Bucket] = {}
        self._lock = threading.Lock()

    def _prune(self, bucket: _Bucket, now: float) -> None:
        window_start = now - settings.LOGIN_ATTEMPT_WINDOW_SECONDS
        bucket.failures = [stamp for stamp in bucket.failures if stamp >= window_start]

    def retry_after(self, keys: list[str]) -> int:
        """Return the number of seconds a caller must wait, or 0 when allowed."""
        now = time.monotonic()
        longest = 0.0
        with self._lock:
            for key in keys:
                bucket = self._buckets.get(key)
                if bucket is None:
                    continue
                if bucket.locked_until > now:
                    longest = max(longest, bucket.locked_until - now)
                elif bucket.locked_until:
                    # Lock expired: start the next window from a clean slate.
                    bucket.locked_until = 0.0
                    bucket.failures.clear()
        return int(longest) + 1 if longest > 0 else 0

    def register_failure(self, keys: list[str]) -> None:
        now = time.monotonic()
        with self._lock:
            for key in keys:
                bucket = self._buckets.setdefault(key, _Bucket())
                self._prune(bucket, now)
                bucket.failures.append(now)
                if len(bucket.failures) >= settings.LOGIN_MAX_ATTEMPTS:
                    bucket.locked_until = now + settings.LOGIN_LOCKOUT_SECONDS
                    bucket.failures.clear()

    def register_success(self, keys: list[str]) -> None:
        with self._lock:
            for key in keys:
                self._buckets.pop(key, None)

    def reset(self) -> None:
        """Clear all state. Used by the test-suite fixtures."""
        with self._lock:
            self._buckets.clear()


login_throttle = LoginThrottle()
