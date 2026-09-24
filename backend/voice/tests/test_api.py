"""Test API giọng nói bằng `unittest` có sẵn trong Python (không thêm runner).

Engine được tiêm bản giả nên test không cần mạng, không cần model và chạy nhanh.
"""

from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from app.config import Settings
from app.engines import Engines
from app.main import MAX_TTS_CHARS, create_app
from app.voices import VOICE_FEMALE, VOICE_MALE, resolve_voice


class FakeTts:
    """Trả dữ liệu cố định và ghi lại tham số nhận được để khẳng định."""

    def __init__(self, payload: bytes = b"MP3DATA") -> None:
        self.payload = payload
        self.calls: list[tuple[str, str]] = []

    async def synthesize(self, text: str, voice: str) -> bytes:
        self.calls.append((text, voice))
        return self.payload


class FakeStt:
    def __init__(self, text: str = "Dạ đúng rồi em") -> None:
        self.text = text
        self.calls: list[tuple[bytes, str]] = []

    def transcribe(self, audio: bytes, language: str) -> str:
        self.calls.append((audio, language))
        return self.text


def build_client(tts: FakeTts | None = None, stt: FakeStt | None = None, **settings_kwargs):
    settings = Settings(**settings_kwargs)
    engines = Engines(tts=tts or FakeTts(), stt=stt or FakeStt())
    app = create_app(settings=settings, engines=engines)
    return TestClient(app), engines


class ResolveVoiceTests(unittest.TestCase):
    def test_maps_female_labels(self):
        self.assertEqual(resolve_voice("Giọng nữ miền Bắc - Linh An"), VOICE_FEMALE)
        self.assertEqual(resolve_voice("Giọng nữ miền Nam - Thuỳ Dương"), VOICE_FEMALE)

    def test_maps_male_labels(self):
        self.assertEqual(resolve_voice("Giọng nam miền Nam - Minh Khang"), VOICE_MALE)
        self.assertEqual(resolve_voice("Giọng nam miền Bắc - Đức Thịnh"), VOICE_MALE)

    def test_checks_female_before_male_in_free_text(self):
        # "nam" nằm trong "miền Nam" nên nếu xét trước sẽ nhận sai giới tính.
        self.assertEqual(resolve_voice("Giọng nữ miền Nam mới"), VOICE_FEMALE)

    def test_falls_back_for_unknown_label(self):
        self.assertEqual(resolve_voice("Giọng đặc biệt"), VOICE_FEMALE)
        self.assertEqual(resolve_voice(None, fallback=VOICE_MALE), VOICE_MALE)


class HealthTests(unittest.TestCase):
    def test_health_reports_config(self):
        client, _ = build_client(voice=VOICE_MALE, whisper_model="tiny")
        body = client.get("/api/health").json()
        self.assertTrue(body["ok"])
        self.assertEqual(body["voice"], VOICE_MALE)
        self.assertEqual(body["whisperModel"], "tiny")


class TtsTests(unittest.TestCase):
    def test_returns_audio_with_resolved_voice(self):
        tts = FakeTts(payload=b"abc123")
        client, _ = build_client(tts=tts)
        response = client.post("/api/tts", data={"text": "Xin chào", "voice": "Giọng nam miền Nam - Minh Khang"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"], "audio/mpeg")
        self.assertEqual(response.content, b"abc123")
        self.assertEqual(tts.calls, [("Xin chào", VOICE_MALE)])

    def test_uses_default_voice_when_voice_missing(self):
        tts = FakeTts()
        client, _ = build_client(tts=tts, voice=VOICE_FEMALE)
        client.post("/api/tts", data={"text": "Xin chào"})
        self.assertEqual(tts.calls[0][1], VOICE_FEMALE)

    def test_rejects_empty_text(self):
        tts = FakeTts()
        client, _ = build_client(tts=tts)
        response = client.post("/api/tts", data={"text": "   "})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(tts.calls, [], "không được gọi engine khi văn bản trống")

    def test_rejects_text_over_limit(self):
        tts = FakeTts()
        client, _ = build_client(tts=tts)
        response = client.post("/api/tts", data={"text": "a" * (MAX_TTS_CHARS + 1)})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(tts.calls, [])


class SttTests(unittest.TestCase):
    def test_transcribes_uploaded_audio(self):
        stt = FakeStt(text="khách xác nhận")
        client, _ = build_client(stt=stt)
        response = client.post("/api/stt", files={"audio": ("a.mp3", b"AUDIO", "audio/mpeg")})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["text"], "khách xác nhận")
        self.assertEqual(stt.calls, [(b"AUDIO", "vi")])

    def test_rejects_empty_audio(self):
        stt = FakeStt()
        client, _ = build_client(stt=stt)
        response = client.post("/api/stt", files={"audio": ("a.mp3", b"", "audio/mpeg")})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(stt.calls, [])

    def test_rejects_oversized_audio(self):
        stt = FakeStt()
        client, _ = build_client(stt=stt, max_audio_bytes=4)
        response = client.post("/api/stt", files={"audio": ("a.mp3", b"12345", "audio/mpeg")})
        self.assertEqual(response.status_code, 413)
        self.assertEqual(stt.calls, [])


if __name__ == "__main__":
    unittest.main()
