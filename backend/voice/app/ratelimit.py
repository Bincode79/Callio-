"""Giới hạn tần suất theo thuật toán token bucket, không phụ thuộc thư viện ngoài.

Mục đích: bảo vệ dịch vụ edge-tts **không chính thức** của Microsoft (có thể chặn
nếu bị gọi quá nhiều) và model STT chạy CPU cục bộ (tốn tài nguyên) khỏi bị lạm dụng.

Lớp thuần, nhận `clock` tiêm được nên test kiểm soát được thời gian, không cần `sleep`.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass


@dataclass
class Bucket:
    tokens: float
    updated_at: float


class TokenBucketLimiter:
    """Giới hạn `capacity` request mỗi `window_seconds`, nạp đều theo thời gian.

    Ví dụ `capacity=30, window_seconds=60` cho phép trung bình 30 request/phút nhưng
    vẫn cho phép bùng nổ ngắn tới 30 request liên tiếp — phù hợp với thao tác người
    dùng thay vì chặn cứng theo cửa sổ.
    """

    def __init__(self, capacity: int, window_seconds: float, clock=time.monotonic) -> None:
        # capacity <= 0 nghĩa là tắt giới hạn.
        self._capacity = max(0, capacity)
        self._window_seconds = window_seconds if window_seconds > 0 else 60.0
        self._clock = clock
        self._buckets: dict[str, Bucket] = {}
        # FastAPI có thể chạy nhiều thread; khoá để tránh đọc/ghi đan xen.
        self._lock = threading.Lock()

    @property
    def enabled(self) -> bool:
        return self._capacity > 0

    def _refill_rate(self) -> float:
        return self._capacity / self._window_seconds

    def allow(self, key: str, cost: int = 1) -> bool:
        """Trừ `cost` token cho `key`; trả False nếu không đủ token.

        Chưa từng thấy `key` thì tạo bucket đầy, nên request đầu tiên luôn qua được.
        """
        if not self.enabled:
            return True
        now = self._clock()
        with self._lock:
            bucket = self._buckets.get(key)
            if bucket is None:
                bucket = Bucket(tokens=float(self._capacity), updated_at=now)
                self._buckets[key] = bucket
            elapsed = max(0.0, now - bucket.updated_at)
            bucket.tokens = min(float(self._capacity), bucket.tokens + elapsed * self._refill_rate())
            bucket.updated_at = now
            if bucket.tokens < cost:
                return False
            bucket.tokens -= cost
            return True

    def retry_after(self, key: str, cost: int = 1) -> int:
        """Số giây tối thiểu cần chờ để có đủ `cost` token, làm tròn lên."""
        if not self.enabled:
            return 0
        bucket = self._buckets.get(key)
        if bucket is None:
            return 0
        missing = cost - bucket.tokens
        if missing <= 0:
            return 0
        # Làm tròn lên để không hứa sớm hơn thực tế.
        return max(1, int(missing / self._refill_rate() + 0.9999))

    def reset(self) -> None:
        with self._lock:
            self._buckets.clear()
