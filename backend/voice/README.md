# Voice API — Callio

Backend nhỏ, mã nguồn mở, **miễn phí và không cần API key**, cấp giọng tiếng Việt
thật cho ứng dụng Callio:

- `POST /api/tts` — đọc văn bản thành audio MP3 (thư viện `edge-tts`).
- `POST /api/tts/stream` — như trên nhưng **phát dần từng đoạn**, giảm thời gian chờ nghe.
- `POST /api/stt` — nhận diện giọng nói tiếng Việt (mô hình `faster-whisper` chạy cục bộ).
- `GET /api/health` — kiểm tra backend còn sống, kèm provider và cờ `authRequired`.

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
| `CALLIO_RATE_LIMIT_TTS` | `60` | Số request TTS mỗi cửa sổ (0 = tắt). |
| `CALLIO_RATE_LIMIT_STT` | `20` | Số request STT mỗi cửa sổ (0 = tắt) — thấp hơn vì tốn CPU hơn. |
| `CALLIO_RATE_LIMIT_WINDOW` | `60` | Độ dài cửa sổ giới hạn, tính bằng giây. |
| `CALLIO_RATE_LIMIT_MAX_KEYS` | `10000` | Trần số bucket giữ trong bộ nhớ (chống rò rỉ khi nhiều IP). |
| `CALLIO_TRUSTED_PROXIES` | (trống) | IP proxy được tin để đọc `X-Forwarded-For`, cách nhau dấu phẩy. |

## Giới hạn tần suất

Thuật toán token bucket, khoá theo **IP thật + phạm vi** (TTS/STT riêng). `capacity=30,
window=60` nghĩa là trung bình 30 request/phút nhưng vẫn cho bùng nổ ngắn, phù hợp thao
tác người dùng. Vượt hạn mức trả **429** kèm header `Retry-After` (giây) và thông báo
tiếng Việt.

Đặt `CALLIO_RATE_LIMIT_TTS=0` hoặc `CALLIO_RATE_LIMIT_STT=0` để tắt hẳn. `/api/health`
báo lại hạn mức đang áp dụng.

### Chạy sau reverse proxy

Mặc định backend **không tin** `X-Forwarded-For`, vì ai cũng đặt được header đó để né
hạn mức. Khi chạy sau proxy (nginx, Cloudflare, Traefik…), khai báo IP proxy:

```bash
CALLIO_TRUSTED_PROXIES=10.0.0.1,10.0.0.2 ./run.sh
```

Khi đó backend lấy IP người dùng thật (phần tử ngoài cùng bên phải **không** thuộc danh
sách proxy tin cậy), nên mỗi người dùng có hạn mức riêng mà vẫn không giả mạo được.

### Bộ nhớ

Mỗi IP là một bucket. Khi vượt `CALLIO_RATE_LIMIT_MAX_KEYS`, limiter dọn bucket **đã nạp
đầy** trước (xoá không ảnh hưởng ai). Nếu vẫn vượt trần — mọi bucket đều đang bị tiêu —
nó xoá dần bucket **lâu chưa đụng nhất**. Đây là **đánh đổi có ý thức**: bảo vệ bộ nhớ
quan trọng hơn việc giữ hạn mức tuyệt đối cho một IP, và trần 10.000 khoá rất khó bị vượt
chỉ bằng cách đổi IP.



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


## Xác thực

Đặt `CALLIO_AUTH_TOKEN=<token>` để bắt buộc mọi request `/api/tts`, `/api/tts/stream` và
`/api/stt` gửi kèm `Authorization: Bearer <token>`. So sánh bằng `hmac.compare_digest`
để không rò rỉ token qua thời gian phản hồi.

Trên giao diện, mở **Callbot → Đổi giọng → Token máy chủ giọng đọc** và dán token;
giá trị được lưu trong trình duyệt (`localStorage`) và gửi kèm mọi request. Hoặc đặt
`VITE_VOICE_TOKEN` khi build.

## Lưu ý trung thực

- **edge-tts dùng dịch vụ không chính thức của Microsoft.** Miễn phí và không cần key,
  nhưng không có cam kết về SLA và có thể hỏng/bị chặn bất kỳ lúc nào. Không nên dùng
  cho sản phẩm thương mại cần ổn định; khi đó dùng Azure AI Speech hoặc tự host model
  như VieNeu-TTS.
- **faster-whisper chạy hoàn toàn cục bộ** (mã nguồn mở, không gọi dịch vụ ngoài). Lần
  chạy đầu tải model; `small` cho chất lượng tiếng Việt tốt hơn `tiny`/`base` rõ rệt
  nhưng chậm hơn trên CPU.
- Giới hạn hiện tại: chưa có hàng đợi. Đã có xác thực bearer token (`CALLIO_AUTH_TOKEN`)
  và **giới hạn tần suất** theo IP (token bucket, TTS/STT riêng); ngoài ra vẫn nên chạy
  sau mạng nội bộ hoặc sau reverse proxy.

## Test

```bash
python3 -m unittest discover -s tests -t . -v
```

Test tiêm engine giả nên **không cần mạng, không cần model**, chạy trong ~0.1 giây.
