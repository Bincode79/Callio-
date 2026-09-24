/**
 * Kiểm tra khả năng phát streaming của trình duyệt với audio từ `/api/tts/stream`.
 *
 * Mục đích duy nhất: trả lời câu hỏi "MediaSource có nhận MP3 của edge-tts không".
 * Kết quả được ghi vào phần tử `#result` để đọc được từ công cụ tự động.
 */

const out = document.getElementById("result");
const log = (line) => {
  out.textContent += `\n${line}`;
};

function finish(cls) {
  out.classList.add(cls);
  document.title = cls === "ok" ? "MEDIACHECK:OK" : "MEDIACHECK:FAIL";
}

async function main() {
  out.textContent = "Đang kiểm tra…";

  const hasMse = typeof MediaSource !== "undefined";
  log(`MediaSource có sẵn: ${hasMse}`);
  if (!hasMse) {
    log("Kết luận: trình duyệt không có MediaSource.");
    finish("bad");
    return;
  }

  const canMpeg = MediaSource.isTypeSupported("audio/mpeg");
  log(`MediaSource.isTypeSupported("audio/mpeg"): ${canMpeg}`);

  // Lấy một đoạn audio thật từ backend.
  const form = new FormData();
  form.append("text", "Dạ em chào anh chị, đây là đoạn kiểm tra phát trực tuyến.");
  let response;
  try {
    response = await fetch("/api/tts/stream", { method: "POST", body: form });
  } catch (err) {
    log(`Không gọi được backend: ${err}`);
    log("Kết luận: backend chưa chạy, không kết luận được về MSE.");
    finish("bad");
    return;
  }
  log(`HTTP ${response.status}, content-type: ${response.headers.get("content-type")}`);
  if (!response.ok) {
    log("Kết luận: backend trả lỗi, không kết luận được về MSE.");
    finish("bad");
    return;
  }

  const buffer = await response.arrayBuffer();
  log(`Nhận ${buffer.byteLength} byte audio`);

  if (canMpeg) {
    const mediaSource = new MediaSource();
    const audio = new Audio();
    audio.src = URL.createObjectURL(mediaSource);
    const played = await new Promise((resolve) => {
      mediaSource.addEventListener("sourceopen", () => {
        let source;
        try {
          source = mediaSource.addSourceBuffer("audio/mpeg");
        } catch (err) {
          log(`addSourceBuffer ném lỗi: ${err}`);
          resolve(false);
          return;
        }
        source.addEventListener("error", () => log("SourceBuffer phát sinh sự kiện error"));
        source.addEventListener("updateend", () => {
          // Quan trọng: kiểm tra trình duyệt có NHẬN dữ liệu MP3 không, tách biệt với
          // việc phát được hay không (phát có thể bị chặn bởi chính sách autoplay).
          log(`SourceBuffer đã nhận: ${source.buffered.length > 0 ? source.buffered.end(0) : 0} giây audio`);
          try {
            mediaSource.endOfStream();
          } catch {
            // endOfStream có thể ném nếu buffer chưa đủ; không quan trọng ở đây.
          }
        });
        try {
          source.appendBuffer(buffer);
        } catch (err) {
          log(`appendBuffer ném lỗi (MSE không nhận MP3): ${err}`);
          resolve(false);
          return;
        }
        audio
          .play()
          .then(() => resolve(true))
          .catch((err) => {
            // Nêu rõ lỗi để phân biệt bị chặn autoplay với MSE không hoạt động.
            log(`audio.play() bị từ chối: ${err.name} - ${err.message}`);
            resolve(false);
          });
      });
      setTimeout(() => resolve(false), 4000);
    });
    log(`Phát được qua MediaSource: ${played}`);
  }

  log(
    canMpeg
      ? "Kết luận: trình duyệt NÀY báo hỗ trợ audio/mpeg qua MediaSource."
      : "Kết luận: trình duyệt NÀY KHÔNG hỗ trợ audio/mpeg qua MediaSource (thường gặp: Chrome chỉ nhận fMP4/WebM).",
  );
  finish(canMpeg ? "ok" : "bad");
}

main();
