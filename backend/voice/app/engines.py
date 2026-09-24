"""Các engine giọng nói thật, viết sau một giao diện nhỏ để test tiêm bản giả.

- `EdgeTtsEngine`: tổng hợp bằng edge-tts (miễn phí, không cần API key).
- `FasterWhisperEngine`: nhận diện bằng faster-whisper (mã nguồn mở, chạy cục bộ).

Việc import thư viện nặng (faster_whisper) được hoãn tới lần dùng đầu tiên, nên
app vẫn khởi động và test vẫn chạy được khi máy chưa cài model.
"""

from __future__ import annotations

import io
from typing import Protocol


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
