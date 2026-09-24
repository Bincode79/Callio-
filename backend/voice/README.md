# Voice API — Callio

Backend nhỏ, mã nguồn mở, **miễn phí và không cần API key**, cấp giọng tiếng Việt
thật cho ứng dụng Callio:

- `POST /api/tts` — đọc văn bản thành audio MP3 (thư viện `edge-tts`).
- `POST /api/stt` — nhận diện giọng nói tiếng Việt (mô hình `faster-whisper` chạy cục bộ).
- `GET /api/health` — kiểm tra backend còn sống.

Giao diện **không bắt buộc** phải có backend: nếu backend không chạy, ứng dụng tự lùi
về Web Speech API của trình duyệt.

## Chạy nhanh

```bash
python3 -m pip install -r requirements.txt
./run.sh                       # http://localhost:8000
```

Trong lúc phát triển, Vite đã cấu hình chuyển tiếp `/api` sang `http://localhost:8000`,
nên chỉ cần chạy `npm run dev` song song là giao diện tự nhận backend.

## Biến môi trường

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `CALLIO_VOICE` | `vi-VN-HoaiMyNeural` | Giọng mặc định khi client không gửi nhãn. |
| `CALLIO_WHISPER_MODEL` | `small` | Kích thước model Whisper: `tiny`/`base`/`small`/`medium`. Máy yếu dùng `tiny`/`base`. |
| `CALLIO_WHISPER_DEVICE` | `cpu` | `cpu` hoặc `cuda`. |
| `CALLIO_WHISPER_COMPUTE_TYPE` | `int8` | `int8` cho CPU; `float16` cho GPU. |
| `CALLIO_MAX_AUDIO_BYTES` | `10485760` | Giới hạn kích thước tệp audio tải lên. |
| `CALLIO_ALLOWED_ORIGINS` | (trống) | Danh sách origin CORS, cách nhau dấu phẩy, khi chạy khác cổng. |
| `CALLIO_AUTH_TOKEN` | (trống) | Nếu đặt, `/api/tts` và `/api/stt` đòi `Authorization: Bearer <token>`. |
| `CALLIO_TTS_PROVIDER` | `local` | `local` (edge-tts) hoặc `openai` (endpoint OpenAI-compatible). |
| `CALLIO_STT_PROVIDER` | `local` | `local` (faster-whisper) hoặc `openai`. |
| `CALLIO_TTS_BASE_URL` | (trống) | Bắt buộc khi `CALLIO_TTS_PROVIDER=openai`. |
| `CALLIO_TTS_MODEL` | `tts-1` | Tên model gửi cho nhà cung cấp TTS. |
| `CALLIO_TTS_VOICE` | (trống) | Ép một mã giọng của engine đích (ví dụ tên giọng VieNeu-TTS). |
| `CALLIO_STT_BASE_URL` | (trống) | Bắt buộc khi `CALLIO_STT_PROVIDER=openai`. |
| `CALLIO_STT_MODEL` | `whisper-1` | Tên model gửi cho nhà cung cấp STT. |
| `CALLIO_PROVIDER_API_KEY` | (trống) | Bearer key gửi cho nhà cung cấp OpenAI-compatible (nếu cần). |

## Đổi engine sang mã nguồn mở khác

Backend nói giao thức OpenAI (`POST /v1/audio/speech`, `POST /v1/audio/transcriptions`),
nên chỉ cần trỏ tới server tương thích là đổi được engine, không sửa mã:

```bash
# TTS: VieNeu-TTS qua server OpenAI-compatible
CALLIO_TTS_PROVIDER=openai \
CALLIO_TTS_BASE_URL=http://localhost:8xxx \
CALLIO_TTS_MODEL=vieneu \
./run.sh

# STT: PhoWhisper qua speaches
CALLIO_STT_PROVIDER=openai \
CALLIO_STT_BASE_URL=http://localhost:9000 \
CALLIO_STT_MODEL=Systran/faster-whisper-small \
./run.sh
```

Chọn `openai` mà thiếu `BASE_URL` thì server báo lỗi ngay lúc khởi động, không để
request đầu tiên thất bại khó hiểu.


## Lưu ý trung thực

- **edge-tts dùng dịch vụ không chính thức của Microsoft.** Miễn phí và không cần key,
  nhưng không có cam kết về SLA và có thể hỏng/bị chặn bất kỳ lúc nào. Không nên dùng
  cho sản phẩm thương mại cần ổn định; khi đó dùng Azure AI Speech hoặc tự host model
  như VieNeu-TTS.
- **faster-whisper chạy hoàn toàn cục bộ** (mã nguồn mở, không gọi dịch vụ ngoài). Lần
  chạy đầu tải model; `small` cho chất lượng tiếng Việt tốt hơn `tiny`/`base` rõ rệt
  nhưng chậm hơn trên CPU.
- Giới hạn hiện tại: chưa có hàng đợi, chưa streaming, chưa giới hạn tần suất. Khi đặt
  `CALLIO_AUTH_TOKEN` thì đã có xác thực bearer token; ngoài ra vẫn nên chạy sau mạng
  nội bộ hoặc sau reverse proxy.

## Test

```bash
python3 -m unittest discover -s tests -t . -v
```

Test tiêm engine giả nên **không cần mạng, không cần model**, chạy trong ~0.1 giây.
