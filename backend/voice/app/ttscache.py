"""Đệm audio tổng hợp ở phía máy chủ.

Vì sao cần, dù client đã có đệm riêng:

- Nhiều người dùng gọi cùng câu (lời thoại mẫu, câu xác nhận) — đệm theo `giọng + text`
  phục vụ được mọi người, không chỉ một trình duyệt.
- `edge-tts` dùng dịch vụ **không chính thức** của Microsoft; gọi lại cùng một câu là
  vừa tốn vừa tăng nguy cơ bị chặn.
- Client tải lại trang hoặc đổi máy thì mất đệm của nó; đệm máy chủ thì không.

Lớp thuần, không phụ thuộc mạng, nên test được.
"""

from __future__ import annotations

import threading
from collections import OrderedDict
from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover
    from .engines import TtsEngine


def ttsCacheKey(text: str, voice: str) -> str:
    """Khoá đệm: cùng giọng + cùng nội dung thì cùng audio."""
    return f"{voice.strip()}::{text.strip()}"


class TtsCache:
    """LRU theo số mục, có thể giới hạn thêm theo tổng dung lượng byte.

    Audio một câu tiếng Việt thường vài chục KB, nên giới hạn theo số mục là đủ cho
    hầu hết trường hợp; giới hạn byte để chặn trường hợp ai đó gửi câu rất dài.
    """

    def __init__(self, max_entries: int = 256, max_bytes: int = 64 * 1024 * 1024) -> None:
        self._max_entries = max(0, max_entries)
        self._max_bytes = max(0, max_bytes)
        self._store: OrderedDict[str, bytes] = OrderedDict()
        self._bytes = 0
        self._lock = threading.Lock()
        self.hits = 0
        self.misses = 0

    @property
    def enabled(self) -> bool:
        return self._max_entries > 0 and self._max_bytes > 0

    @property
    def size(self) -> int:
        return len(self._store)

    @property
    def bytes_used(self) -> int:
        return self._bytes

    def get(self, key: str) -> bytes | None:
        if not self.enabled:
            return None
        with self._lock:
            value = self._store.get(key)
            if value is None:
                self.misses += 1
                return None
            # Chạm thì đưa lên cuối (mới nhất) để không bị loại sớm.
            self._store.move_to_end(key)
            self.hits += 1
            return value

    def set(self, key: str, value: bytes) -> None:
        if not self.enabled:
            return
        # Một mục lớn hơn cả hạn mức thì không thể đệm; bỏ qua thay vì dọn sạch cache.
        if len(value) > self._max_bytes:
            return
        with self._lock:
            existing = self._store.pop(key, None)
            if existing is not None:
                self._bytes -= len(existing)
            self._store[key] = value
            self._bytes += len(value)
            self._evict_locked()

    def _evict_locked(self) -> None:
        while self._store and (len(self._store) > self._max_entries or self._bytes > self._max_bytes):
            _oldest_key, oldest_value = self._store.popitem(last=False)
            self._bytes -= len(oldest_value)

    def stats(self) -> dict[str, int]:
        with self._lock:
            hits, misses = self.hits, self.misses
        total = hits + misses
        return {
            "entries": self.size,
            "bytes": self.bytes_used,
            "hits": hits,
            "misses": misses,
            # Tỉ lệ trúng theo phần trăm, làm tròn; 0 khi chưa có request nào.
            "hitRate": round(hits / total * 100) if total else 0,
        }

    def clear(self) -> None:
        with self._lock:
            self._store.clear()
            self._bytes = 0


class CachedTtsEngine:
    """Bọc một `TtsEngine` để đệm kết quả theo `giọng + text`.

    Vẫn thoả giao diện `TtsEngine`, nên `main.py` không cần biết có đệm hay không.

    Lưu ý về `stream`: khi đã có trong đệm thì phát ngay một khối (nhanh hơn hẳn tổng
    hợp lại). Khi chưa có thì **không** đệm giữa chừng — ta stream thẳng từ engine và
    chỉ ghi đệm ở đường `synthesize`, để tránh giữ hai bản logic đệm khác nhau.
    """

    def __init__(self, inner: "TtsEngine", cache: TtsCache) -> None:
        self._inner = inner
        self._cache = cache

    @property
    def cache(self) -> TtsCache:
        return self._cache

    async def synthesize(self, text: str, voice: str) -> bytes:
        key = ttsCacheKey(text, voice)
        cached = self._cache.get(key)
        if cached is not None:
            return cached
        data = await self._inner.synthesize(text, voice)
        self._cache.set(key, data)
        return data

    async def stream(self, text: str, voice: str):
        key = ttsCacheKey(text, voice)
        cached = self._cache.get(key)
        if cached is not None:
            yield cached
            return
        async for chunk in self._inner.stream(text, voice):
            yield chunk
