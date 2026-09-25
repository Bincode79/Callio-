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

    def __init__(self, capacity: int, window_seconds: float, clock=time.monotonic, max_keys: int = 10_000) -> None:
        # capacity <= 0 nghĩa là tắt giới hạn.
        self._capacity = max(0, capacity)
        self._window_seconds = window_seconds if window_seconds > 0 else 60.0
        self._clock = clock
        # `max_keys` chặn rò rỉ bộ nhớ: mỗi IP tạo một bucket, mà request có thể đến
        # từ rất nhiều IP. Khi vượt ngưỡng, dọn bucket đã nạp đầy (không còn tác dụng).
        self._max_keys = max(1, max_keys)
        self._buckets: dict[str, Bucket] = {}
        # FastAPI có thể chạy nhiều thread; khoá để tránh đọc/ghi đan xen.
        self._lock = threading.Lock()

    @property
    def enabled(self) -> bool:
        return self._capacity > 0

    def _refill_rate(self) -> float:
        return self._capacity / self._window_seconds

    def _evict_full_buckets_locked(self, now: float) -> None:
        """Dọn bucket khi vượt `max_keys`, ưu tiên bucket đã nạp đầy.

        Hai giai đoạn:
        1. Xoá bucket đã nạp đầy trở lại — chúng tương đương "chưa từng thấy", nên xoá
           không ảnh hưởng hạn mức của ai.
        2. Nếu vẫn vượt trần (mọi bucket đều đang bị tiêu), xoá dần bucket **lâu chưa
           đụng nhất**. Đây là đánh đổi có ý thức: bảo vệ bộ nhớ quan trọng hơn việc
           giữ hạn mức tuyệt đối cho một IP cụ thể, mà trần 10.000 khoá là rất khó để
           một kẻ tấn công vượt qua chỉ bằng cách đổi IP.
        """
        if len(self._buckets) <= self._max_keys:
            return

        for key in list(self._buckets.keys()):
            if len(self._buckets) <= self._max_keys:
                return
            bucket = self._buckets[key]
            elapsed = max(0.0, now - bucket.updated_at)
            if bucket.tokens + elapsed * self._refill_rate() >= float(self._capacity):
                del self._buckets[key]

        if len(self._buckets) <= self._max_keys:
            return

        # Vẫn vượt trần: xoá theo thứ tự cũ nhất trước.
        oldest = sorted(self._buckets.items(), key=lambda item: item[1].updated_at)
        for key, _bucket in oldest:
            if len(self._buckets) <= self._max_keys:
                return
            del self._buckets[key]

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
                self._evict_full_buckets_locked(now)
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
