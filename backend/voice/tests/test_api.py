"""Test API giọng nói bằng `unittest` có sẵn trong Python (không thêm runner).

Engine được tiêm bản giả nên test không cần mạng, không cần model và chạy nhanh.
"""

from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from app.config import Settings
from app.engines import Engines, build_engines
from app.main import MAX_TTS_CHARS, create_app
from app.providers import OpenAICompatibleStt, OpenAICompatibleTts
from app.voices import VOICE_FEMALE, VOICE_MALE, resolve_voice


class FakeTts:
    """Trả dữ liệu cố định và ghi lại tham số nhận được để khẳng định."""

    def __init__(self, payload: bytes = b"MP3DATA", chunks: list[bytes] | None = None) -> None:
        self.payload = payload
        # Mặc định phát hai đoạn để kiểm tra gộp/streaming liền mạch.
        self.chunks = chunks if chunks is not None else [b"PART1", b"PART2"]
        self.calls: list[tuple[str, str]] = []

    async def synthesize(self, text: str, voice: str) -> bytes:
        self.calls.append((text, voice))
        return self.payload

    async def stream(self, text: str, voice: str):
        self.calls.append((text, voice))
        for chunk in self.chunks:
            yield chunk


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


class FakeHttpResponse:
    def __init__(self, content=b"", json_body=None, status_code=200):
        self.content = content
        self._json = json_body
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self):
        return self._json


class FakeHttpClient:
    """Ghi lại request và trả phản hồi dựng sẵn, để test provider không cần mạng."""

    def __init__(self, response):
        self.response = response
        self.calls = []

    def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return self.response


class OpenAiCompatibleTtsTests(unittest.TestCase):
    def test_posts_openai_speech_payload(self):
        client = FakeHttpClient(FakeHttpResponse(content=b"AUDIO"))
        provider = OpenAICompatibleTts("http://tts.local/", "vieneu", api_key="secret", client=client)

        import asyncio

        audio = asyncio.run(provider.synthesize("Xin chào", VOICE_FEMALE))

        self.assertEqual(audio, b"AUDIO")
        url, kwargs = client.calls[0]
        self.assertEqual(url, "http://tts.local/v1/audio/speech", "phải bỏ dấu / thừa ở base_url")
        self.assertEqual(kwargs["json"]["input"], "Xin chào")
        self.assertEqual(kwargs["json"]["voice"], VOICE_FEMALE)
        self.assertEqual(kwargs["json"]["model"], "vieneu")
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer secret")

    def test_voice_override_wins(self):
        client = FakeHttpClient(FakeHttpResponse(content=b"AUDIO"))
        provider = OpenAICompatibleTts("http://tts.local", "m", client=client, voice_override="giong-rieng")

        import asyncio

        asyncio.run(provider.synthesize("x", VOICE_FEMALE))
        self.assertEqual(client.calls[0][1]["json"]["voice"], "giong-rieng")

    def test_empty_audio_raises(self):
        client = FakeHttpClient(FakeHttpResponse(content=b""))
        provider = OpenAICompatibleTts("http://tts.local", "m", client=client)
        import asyncio

        with self.assertRaises(RuntimeError):
            asyncio.run(provider.synthesize("x", VOICE_FEMALE))

    def test_no_auth_header_when_no_key(self):
        client = FakeHttpClient(FakeHttpResponse(content=b"AUDIO"))
        provider = OpenAICompatibleTts("http://tts.local", "m", client=client)
        import asyncio

        asyncio.run(provider.synthesize("x", VOICE_FEMALE))
        self.assertNotIn("Authorization", client.calls[0][1]["headers"])


class OpenAiCompatibleSttTests(unittest.TestCase):
    def test_posts_transcription_and_reads_text(self):
        client = FakeHttpClient(FakeHttpResponse(json_body={"text": "dạ đúng rồi"}))
        provider = OpenAICompatibleStt("http://stt.local/", "phowhisper", api_key="k", client=client)

        text = provider.transcribe(b"AUDIO", "vi")

        self.assertEqual(text, "dạ đúng rồi")
        url, kwargs = client.calls[0]
        self.assertEqual(url, "http://stt.local/v1/audio/transcriptions")
        self.assertEqual(kwargs["data"]["model"], "phowhisper")
        self.assertEqual(kwargs["data"]["language"], "vi")
        self.assertIn("file", kwargs["files"])

    def test_missing_text_field_raises(self):
        client = FakeHttpClient(FakeHttpResponse(json_body={"error": "no text"}))
        provider = OpenAICompatibleStt("http://stt.local", "m", client=client)
        with self.assertRaises(RuntimeError):
            provider.transcribe(b"AUDIO", "vi")


class BuildEnginesTests(unittest.TestCase):
    def test_defaults_to_local_engines(self):
        engines = build_engines(Settings())
        self.assertEqual(type(engines.tts).__name__, "EdgeTtsEngine")
        self.assertEqual(type(engines.stt).__name__, "FasterWhisperEngine")

    def test_builds_openai_tts(self):
        engines = build_engines(Settings(tts_provider="openai", tts_base_url="http://tts.local", tts_model="vieneu"))
        self.assertEqual(type(engines.tts).__name__, "OpenAICompatibleTts")

    def test_builds_openai_stt(self):
        engines = build_engines(Settings(stt_provider="openai", stt_base_url="http://stt.local", stt_model="phowhisper"))
        self.assertEqual(type(engines.stt).__name__, "OpenAICompatibleStt")

    def test_openai_without_base_url_fails_fast(self):
        with self.assertRaises(ValueError) as ctx:
            build_engines(Settings(tts_provider="openai"))
        self.assertIn("CALLIO_TTS_BASE_URL", str(ctx.exception))

    def test_rejects_unknown_provider(self):
        with self.assertRaises(ValueError):
            build_engines(Settings(tts_provider="lo-lang"))


class AuthTests(unittest.TestCase):
    def test_request_without_token_is_rejected_when_configured(self):
        tts = FakeTts()
        client, _ = build_client(tts=tts, auth_token="s3cret")
        response = client.post("/api/tts", data={"text": "Xin chào"})

        self.assertEqual(response.status_code, 401)
        self.assertEqual(tts.calls, [], "không được gọi engine khi thiếu token")

    def test_request_with_wrong_token_is_rejected(self):
        tts = FakeTts()
        client, _ = build_client(tts=tts, auth_token="s3cret")
        response = client.post("/api/tts", data={"text": "Xin chào"}, headers={"Authorization": "Bearer sai"})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(tts.calls, [])

    def test_request_with_correct_token_passes(self):
        tts = FakeTts()
        client, _ = build_client(tts=tts, auth_token="s3cret")
        response = client.post("/api/tts", data={"text": "Xin chào"}, headers={"Authorization": "Bearer s3cret"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(tts.calls), 1)

    def test_stt_also_requires_token(self):
        stt = FakeStt()
        client, _ = build_client(stt=stt, auth_token="s3cret")
        response = client.post("/api/stt", files={"audio": ("a.mp3", b"AUDIO", "audio/mpeg")})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(stt.calls, [])

    def test_no_token_configured_means_open_access(self):
        client, _ = build_client()
        self.assertEqual(client.post("/api/tts", data={"text": "Xin chào"}).status_code, 200)

    def test_health_reports_auth_and_providers(self):
        client, _ = build_client(auth_token="s3cret", tts_provider="openai", stt_provider="openai")
        body = client.get("/api/health").json()
        self.assertTrue(body["authRequired"])
        self.assertEqual(body["ttsProvider"], "openai")
        self.assertEqual(body["sttProvider"], "openai")


class TtsStreamTests(unittest.TestCase):
    def test_streams_chunks_in_order(self):
        tts = FakeTts(chunks=[b"AA", b"BB", b"CC"])
        client, _ = build_client(tts=tts)
        response = client.post("/api/tts/stream", data={"text": "Xin chào"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"], "audio/mpeg")
        self.assertEqual(response.content, b"AABBCC", "các đoạn phải nối đúng thứ tự")

    def test_stream_resolves_voice_like_tts(self):
        tts = FakeTts()
        client, _ = build_client(tts=tts)
        client.post("/api/tts/stream", data={"text": "Xin chào", "voice": "Giọng nam miền Nam - Minh Khang"})
        self.assertEqual(tts.calls, [("Xin chào", VOICE_MALE)])

    def test_stream_rejects_empty_text(self):
        tts = FakeTts()
        client, _ = build_client(tts=tts)
        response = client.post("/api/tts/stream", data={"text": "  "})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(tts.calls, [], "không được gọi engine khi văn bản trống")

    def test_stream_rejects_over_limit(self):
        tts = FakeTts()
        client, _ = build_client(tts=tts)
        response = client.post("/api/tts/stream", data={"text": "a" * (MAX_TTS_CHARS + 1)})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(tts.calls, [])

    def test_stream_requires_token_when_configured(self):
        tts = FakeTts()
        client, _ = build_client(tts=tts, auth_token="s3cret")
        response = client.post("/api/tts/stream", data={"text": "Xin chào"})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(tts.calls, [])

    def test_stream_accepts_correct_token(self):
        tts = FakeTts()
        client, _ = build_client(tts=tts, auth_token="s3cret")
        response = client.post("/api/tts/stream", data={"text": "Xin chào"}, headers={"Authorization": "Bearer s3cret"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"PART1PART2")


if __name__ == "__main__":
    unittest.main()