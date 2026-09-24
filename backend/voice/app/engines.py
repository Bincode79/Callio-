"""Các engine giọng nói thật, viết sau một giao diện nhỏ để test tiêm bản giả.

- `EdgeTtsEngine`: tổng hợp bằng edge-tts (miễn phí, không cần API key).
- `FasterWhisperEngine`: nhận diện bằng faster-whisper (mã nguồn mở, chạy cục bộ).

Việc import thư viện nặng (faster_whisper) được hoãn tới lần dùng đầu tiên, nên
app vẫn khởi động và test vẫn chạy được khi máy chưa cài model.
"""

from __future__ import annotations

import io
from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:  # pragma: no cover
    from .config import Settings


class TtsEngine(Protocol):
    async def synthesize(self, text: str, voice: str) -> bytes:
        """Trả dữ liệu audio MP3 cho `text` bằng `voice`."""
        ...


class SttEngine(Protocol):
    def transcribe(self, audio: bytes, language: str) -> str:
        """Trả văn bản nhận diện được từ dữ liệu audio."""
        ...


class EdgeTtsEngine:
    """Tổng hợp giọng nói qua edge-tts."""

    async def synthesize(self, text: str, voice: str) -> bytes:
        import edge_tts

        communicate = edge_tts.Communicate(text, voice)
        buffer = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                buffer.write(chunk["data"])
        data = buffer.getvalue()
        if not data:
            raise RuntimeError("edge-tts trả về audio rỗng")
        return data


class FasterWhisperEngine:
    """Nhận diện giọng nói bằng faster-whisper.

    Model được nạp lười và giữ lại để tái dùng; nạp model là bước tốn thời gian
    nhất nên không thể làm lại mỗi request.
    """

    def __init__(self, model_name: str, device: str = "cpu", compute_type: str = "int8") -> None:
        self._model_name = model_name
        self._device = device
        self._compute_type = compute_type
        self._model = None

    def _load(self):
        if self._model is None:
            from faster_whisper import WhisperModel

            self._model = WhisperModel(self._model_name, device=self._device, compute_type=self._compute_type)
        return self._model

    def transcribe(self, audio: bytes, language: str) -> str:
        import tempfile
        import os

        model = self._load()
        # faster-whisper nhận đường dẫn tệp; ghi ra tệp tạm rồi xoá ngay sau khi đọc.
        fd, path = tempfile.mkstemp(suffix=".mp3")
        try:
            with os.fdopen(fd, "wb") as handle:
                handle.write(audio)
            segments, _info = model.transcribe(path, language=language, vad_filter=True)
            return " ".join(segment.text.strip() for segment in segments).strip()
        finally:
            try:
                os.unlink(path)
            except OSError:
                pass


class Engines:
    """Gom hai engine để app và test dùng cùng một chỗ."""

    def __init__(self, tts: TtsEngine, stt: SttEngine) -> None:
        self.tts = tts
        self.stt = stt


def build_engines(settings: "Settings") -> Engines:
    """Dựng engine theo cấu hình.

    `tts_provider`/`stt_provider` là "local" (mặc định) hoặc "openai" (endpoint
    OpenAI-compatible). Chọn "openai" mà thiếu `base_url` thì báo lỗi ngay lúc khởi
    động thay vì để request đầu tiên thất bại khó hiểu.
    """
    if settings.tts_provider not in {"local", "openai"}:
        raise ValueError(f"CALLIO_TTS_PROVIDER không hợp lệ: {settings.tts_provider}")
    if settings.stt_provider not in {"local", "openai"}:
        raise ValueError(f"CALLIO_STT_PROVIDER không hợp lệ: {settings.stt_provider}")

    if settings.tts_provider == "openai":
        if not settings.tts_base_url:
            raise ValueError("CALLIO_TTS_PROVIDER=openai cần CALLIO_TTS_BASE_URL")
        # Import muộn để không kéo phụ thuộc khi chỉ dùng đường cục bộ.
        from .providers import OpenAICompatibleTts

        tts: TtsEngine = OpenAICompatibleTts(
            base_url=settings.tts_base_url,
            model=settings.tts_model,
            api_key=settings.provider_api_key,
            voice_override=settings.tts_voice or None,
        )
    else:
        tts = EdgeTtsEngine()

    if settings.stt_provider == "openai":
        if not settings.stt_base_url:
            raise ValueError("CALLIO_STT_PROVIDER=openai cần CALLIO_STT_BASE_URL")
        from .providers import OpenAICompatibleStt

        stt: SttEngine = OpenAICompatibleStt(
            base_url=settings.stt_base_url,
            model=settings.stt_model,
            api_key=settings.provider_api_key,
        )
    else:
        stt = FasterWhisperEngine(settings.whisper_model, settings.whisper_device, settings.whisper_compute_type)

    return Engines(tts=tts, stt=stt)
