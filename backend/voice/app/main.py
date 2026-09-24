"""API giọng nói của Callio: /api/tts (đọc) và /api/stt (nghe).

Chạy: `uvicorn app.main:app --port 8000` trong thư mục `backend/voice`.
"""

from __future__ import annotations

import hmac

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse

from .config import Settings, get_settings
from .engines import Engines, build_engines
from .voices import resolve_voice

# Giới hạn độ dài văn bản đọc để một request không kéo dài vô hạn; 2000 ký tự
# thừa cho một bước kịch bản callbot.
MAX_TTS_CHARS = 2000

# Ngôn ngữ nguồn nhận diện; sản phẩm chỉ phục vụ tiếng Việt.
STT_LANGUAGE = "vi"


def create_app(settings: Settings | None = None, engines: Engines | None = None) -> FastAPI:
    """Dựng app. Tham số cho phép test tiêm cấu hình và engine giả."""
    settings = settings or get_settings()
    engines = engines or build_engines(settings)

    app = FastAPI(title="Callio Voice API", version="1.1.0")
    app.state.settings = settings
    app.state.engines = engines

    if settings.allowed_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(settings.allowed_origins),
            allow_methods=["POST", "GET"],
            allow_headers=["*"],
        )

    def require_token(authorization: str | None = Header(default=None)) -> None:
        """Kiểm tra bearer token nếu `CALLIO_AUTH_TOKEN` được đặt.

        So sánh bằng `hmac.compare_digest` để tránh rò rỉ thời gian; so khớp chuỗi
        thường (`==`) có thể lộ dần token qua thời gian phản hồi.
        """
        if not settings.auth_token:
            return
        expected = f"Bearer {settings.auth_token}"
        if authorization is None or not hmac.compare_digest(authorization, expected):
            raise HTTPException(status_code=401, detail="Thiếu hoặc sai token xác thực")

    @app.get("/api/health")
    async def health() -> dict[str, object]:
        return {
            "ok": True,
            "voice": settings.voice,
            "whisperModel": settings.whisper_model,
            "ttsProvider": settings.tts_provider,
            "sttProvider": settings.stt_provider,
            "authRequired": bool(settings.auth_token),
        }

    @app.post("/api/tts")
    async def tts(text: str = Form(...), voice: str | None = Form(None), _: None = Depends(require_token)) -> Response:
        clean = text.strip()
        if clean == "":
            raise HTTPException(status_code=400, detail="Văn bản đọc đang trống")
        if len(clean) > MAX_TTS_CHARS:
            raise HTTPException(status_code=400, detail=f"Văn bản quá dài (tối đa {MAX_TTS_CHARS} ký tự)")
        try:
            audio = await engines.tts.synthesize(clean, resolve_voice(voice, settings.voice))
        except Exception as exc:  # noqa: BLE001 - trả lỗi có kiểm soát cho client
            raise HTTPException(status_code=502, detail=f"Không tổng hợp được giọng đọc: {exc}") from exc
        return Response(content=audio, media_type="audio/mpeg")

    @app.post("/api/tts/stream")
    async def tts_stream(text: str = Form(...), voice: str | None = Form(None), _: None = Depends(require_token)) -> StreamingResponse:
        """Như /api/tts nhưng phát dần từng đoạn audio, giảm thời gian chờ nghe.

        Lỗi xảy ra *sau* khi đã gửi header không thể đổi thành mã HTTP lỗi nữa, nên
        chỉ kiểm tra tham số trước khi stream; lỗi giữa chừng sẽ cắt luồng.
        """
        clean = text.strip()
        if clean == "":
            raise HTTPException(status_code=400, detail="Văn bản đọc đang trống")
        if len(clean) > MAX_TTS_CHARS:
            raise HTTPException(status_code=400, detail=f"Văn bản quá dài (tối đa {MAX_TTS_CHARS} ký tự)")

        async def body():
            try:
                async for chunk in engines.tts.stream(clean, resolve_voice(voice, settings.voice)):
                    yield chunk
            except Exception:  # noqa: BLE001 - cắt luồng nếu nhà cung cấp lỗi giữa chừng
                return

        return StreamingResponse(body(), media_type="audio/mpeg")

    @app.post("/api/stt")
    async def stt(
        audio: UploadFile = File(...),
        language: str = Form(STT_LANGUAGE),
        _: None = Depends(require_token),
    ) -> dict[str, str]:
        data = await audio.read()
        if not data:
            raise HTTPException(status_code=400, detail="Tệp audio rỗng")
        if len(data) > settings.max_audio_bytes:
            raise HTTPException(status_code=413, detail="Tệp audio vượt giới hạn cho phép")
        try:
            text = engines.stt.transcribe(data, language)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=f"Không nhận diện được giọng nói: {exc}") from exc
        return {"text": text}

    return app


app = create_app()
