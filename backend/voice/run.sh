#!/usr/bin/env bash
# Chạy backend giọng nói của Callio.
#
#   ./run.sh                 # cổng 8000
#   PORT=8100 ./run.sh       # cổng khác
#   CALLIO_WHISPER_MODEL=tiny ./run.sh   # model nhẹ hơn cho máy yếu
set -euo pipefail

cd "$(dirname "$0")"

PORT="${PORT:-8000}"
HOST="${HOST:-0.0.0.0}"

if ! python3 -c "import fastapi, uvicorn" >/dev/null 2>&1; then
  echo "Thiếu dependency. Cài trước:"
  echo "  python3 -m pip install -r requirements.txt"
  exit 1
fi

echo "Voice API chạy tại http://${HOST}:${PORT} (model: ${CALLIO_WHISPER_MODEL:-small})"

# uvicorn mặc định BẬT --proxy-headers và tin loopback, nên nó tự ghi đè
# `request.client.host` bằng X-Forwarded-For — nghĩa là kẻ gửi tự đặt header là né
# được giới hạn tần suất ở tầng ứng dụng. Tắt hẳn để logic trong `app/clientid.py`
# là nơi duy nhất quyết định IP, và chỉ tin proxy khi cấu hình CALLIO_TRUSTED_PROXIES.
exec python3 -m uvicorn app.main:app --host "$HOST" --port "$PORT" --no-proxy-headers
