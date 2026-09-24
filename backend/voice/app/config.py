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
    max_audio_bytes: int = MAX_AUDIO_BYTES
    allowed_origins: tuple[str, ...] = field(default_factory=lambda: DEFAULT_ALLOWED_ORIGINS)
    # "local" dùng edge-tts + faster-whisper; "openai" gọi endpoint OpenAI-compatible
    # (VieNeu-TTS, Kokoro-FastAPI, speaches, PhoWhisper…).
    tts_provider: str = "local"
    stt_provider: str = "local"
    whisper_model: str = DEFAULT_WHISPER_MODEL
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"
    tts_base_url: str = ""
    tts_model: str = "tts-1"
    tts_voice: str = ""
    stt_base_url: str = ""
    stt_model: str = "whisper-1"
    provider_api_key: str = ""
    # Nếu đặt, mọi request /api/tts và /api/stt phải kèm `Authorization: Bearer <token>`.
    auth_token: str = ""
    # Giới hạn tần suất: số request mỗi cửa sổ (0 = tắt). TTS và STT tách riêng vì
    # STT tốn CPU hơn nhiều.
    rate_limit_tts: int = 60
    rate_limit_stt: int = 20
    rate_limit_window_seconds: float = 60.0
    # Trần số bucket giữ trong bộ nhớ, tránh rò rỉ khi có nhiều IP.
    rate_limit_max_keys: int = 10_000
    # Danh sách IP proxy được tin để đọc X-Forwarded-For (cách nhau dấu phẩy). Để
    # trống nếu chạy trực tiếp; nếu không, header giả có thể dùng để né hạn mức.
    trusted_proxies: frozenset[str] = field(default_factory=frozenset)


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
        tts_provider=os.getenv("CALLIO_TTS_PROVIDER", "local"),
        stt_provider=os.getenv("CALLIO_STT_PROVIDER", "local"),
        tts_base_url=os.getenv("CALLIO_TTS_BASE_URL", ""),
        tts_model=os.getenv("CALLIO_TTS_MODEL", "tts-1"),
        tts_voice=os.getenv("CALLIO_TTS_VOICE", ""),
        stt_base_url=os.getenv("CALLIO_STT_BASE_URL", ""),
        stt_model=os.getenv("CALLIO_STT_MODEL", "whisper-1"),
        provider_api_key=os.getenv("CALLIO_PROVIDER_API_KEY", ""),
        auth_token=os.getenv("CALLIO_AUTH_TOKEN", ""),
        rate_limit_tts=int(os.getenv("CALLIO_RATE_LIMIT_TTS", "60")),
        rate_limit_stt=int(os.getenv("CALLIO_RATE_LIMIT_STT", "20")),
        rate_limit_window_seconds=float(os.getenv("CALLIO_RATE_LIMIT_WINDOW", "60")),
        rate_limit_max_keys=int(os.getenv("CALLIO_RATE_LIMIT_MAX_KEYS", "10000")),
        trusted_proxies=frozenset(_split_origins(os.getenv("CALLIO_TRUSTED_PROXIES", ""))),
    )
