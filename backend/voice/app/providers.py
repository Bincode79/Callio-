"""Nhà cung cấp giọng nói OpenAI-compatible.

Nhiều engine mã nguồn mở (VieNeu-TTS, Kokoro-FastAPI, speaches…) đều nói cùng một
giao thức OpenAI:

- TTS: `POST {base}/v1/audio/speech` với JSON `{model, input, voice}` -> bytes audio.
- STT: `POST {base}/v1/audio/transcriptions` multipart `file` (+ `model`, `language`)
  -> JSON `{text}`.

Nhờ vậy có thể đổi engine mà không sửa mã API, chỉ đổi biến môi trường.

Các lớp ở đây dùng `httpx` và nhận `client` tiêm được để test không cần mạng.
"""

from __future__ import annotations

from typing import Any


class OpenAICompatibleTts:
    """Tổng hợp giọng nói qua endpoint OpenAI-compatible."""

    def __init__(
        self,
        base_url: str,
        model: str,
        api_key: str = "",
        client: Any | None = None,
        voice_override: str | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._api_key = api_key
        # `voice_override` cho phép ép một mã giọng cụ thể của engine đích, ví dụ
        # VieNeu-TTS dùng tên giọng riêng thay vì mã edge-tts.
        self._voice_override = voice_override
        self._client = client

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._api_key}"} if self._api_key else {}

    def _http(self):
        if self._client is not None:
            return self._client
        import httpx

        self._client = httpx.Client(timeout=60.0)
        return self._client

    async def synthesize(self, text: str, voice: str) -> bytes:
        payload = {
            "model": self._model,
            "input": text,
            "voice": self._voice_override or voice,
        }
        response = self._http().post(f"{self._base_url}/v1/audio/speech", json=payload, headers=self._headers())
        response.raise_for_status()
        data = response.content
        if not data:
            raise RuntimeError("Nhà cung cấp TTS trả về audio rỗng")
        return data

    async def stream(self, text: str, voice: str):
        """Nhà cung cấp OpenAI-compatible trả cả tệp một lần, nên phát một đoạn."""
        yield await self.synthesize(text, voice)


class OpenAICompatibleStt:
    """Nhận diện giọng nói qua endpoint OpenAI-compatible."""

    def __init__(
        self,
        base_url: str,
        model: str,
        api_key: str = "",
        client: Any | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._api_key = api_key
        self._client = client

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._api_key}"} if self._api_key else {}

    def _http(self):
        if self._client is not None:
            return self._client
        import httpx

        self._client = httpx.Client(timeout=120.0)
        return self._client

    def transcribe(self, audio: bytes, language: str) -> str:
        files = {"file": ("recording.webm", audio, "audio/webm")}
        data = {"model": self._model, "language": language}
        response = self._http().post(
            f"{self._base_url}/v1/audio/transcriptions",
            files=files,
            data=data,
            headers=self._headers(),
        )
        response.raise_for_status()
        body = response.json()
        text = body.get("text") if isinstance(body, dict) else None
        if not isinstance(text, str):
            raise RuntimeError("Nhà cung cấp STT không trả về trường 'text'")
        return text
