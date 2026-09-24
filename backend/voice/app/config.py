"""Cấu hình backend giọng nói, đọc từ biến môi trường.

Tách khỏi phần app để test có thể dựng cấu hình riêng mà không đọc môi trường thật.
"""

from dataclasses import dataclass, field
from functools import lru_cache
import os


# Giọng edge-tts cho tiếng Việt. Nhãn trong sản phẩm ("Giọng nữ miền Bắc - Linh An")
# được ánh xạ sang mã giọng thật ở `voices.py`.
DEFAULT_VOICE = "vi-VN-HoaiMyNeural"

# Whisper: mặc định "small" cho cân bằng giữa chất lượng tiếng Việt và tốc độ CPU.
# "tiny"/"base" nhẹ hơn nhưng sai dấu nhiều hơn rõ rệt với tiếng Việt.
DEFAULT_WHISPER_MODEL = "small"

# Giới hạn kích thước tệp audio gửi lên /api/stt (10 MB).
MAX_AUDIO_BYTES = 10 * 1024 * 1024

# Danh sách origin được phép gọi API khi chạy khác cổng (dev). Production nên phục
# vụ cùng origin nên danh sách này thường để trống.
DEFAULT_ALLOWED_ORIGINS: tuple[str, ...] = ()


@dataclass(frozen=True)
class Settings:
    voice: str = DEFAULT_VOICE
    whisper_model: str = DEFAULT_WHISPER_MODEL
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"
    max_audio_bytes: int = MAX_AUDIO_BYTES
    allowed_origins: tuple[str, ...] = field(default_factory=lambda: DEFAULT_ALLOWED_ORIGINS)


def _split_origins(raw: str) -> tuple[str, ...]:
    return tuple(part.strip() for part in raw.split(",") if part.strip())


@lru_cache
def get_settings() -> Settings:
    """Cấu hình đọc một lần từ môi trường; cache để không đọc lại mỗi request."""
    return Settings(
        voice=os.getenv("CALLIO_VOICE", DEFAULT_VOICE),
        whisper_model=os.getenv("CALLIO_WHISPER_MODEL", DEFAULT_WHISPER_MODEL),
        whisper_device=os.getenv("CALLIO_WHISPER_DEVICE", "cpu"),
        whisper_compute_type=os.getenv("CALLIO_WHISPER_COMPUTE_TYPE", "int8"),
        max_audio_bytes=int(os.getenv("CALLIO_MAX_AUDIO_BYTES", str(MAX_AUDIO_BYTES))),
        allowed_origins=_split_origins(os.getenv("CALLIO_ALLOWED_ORIGINS", "")),
    )
