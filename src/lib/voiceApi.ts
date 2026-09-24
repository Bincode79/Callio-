/**
 * Cầu nối tới backend giọng nói của Callio (xem `backend/voice`).
 *
 * Giao diện ưu tiên backend khi có (giọng tiếng Việt tốt hơn, cùng một giọng cho
 * mọi thiết bị), và tự lùi về Web Speech API của trình duyệt khi backend không
 * chạy. Nhờ vậy bản demo vẫn dùng được mà không cần cài Python.
 */

/** Tiền tố URL của backend; đổi bằng VITE_VOICE_API khi deploy tách cổng. */
export function voiceApiBase(): string {
  const configured = import.meta.env?.VITE_VOICE_API;
  return typeof configured === "string" && configured.trim() !== "" ? configured.trim().replace(/\/$/, "") : "";
}

/** Khoá localStorage cho token do người dùng đặt trong giao diện. */
export const VOICE_TOKEN_STORAGE_KEY = "callio.voiceToken";

/**
 * Token gửi kèm request, theo thứ tự ưu tiên: giá trị người dùng đặt trong giao diện
 * (localStorage) rồi tới biến môi trường `VITE_VOICE_TOKEN`. Trả chuỗi rỗng nghĩa là
 * backend để mở.
 */
export function voiceApiToken(): string {
  try {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(VOICE_TOKEN_STORAGE_KEY) : null;
    if (stored && stored.trim() !== "") return stored.trim();
  } catch {
    // localStorage có thể bị chặn (chế độ riêng tư); bỏ qua và dùng biến môi trường.
  }
  const fromEnv = import.meta.env?.VITE_VOICE_TOKEN;
  return typeof fromEnv === "string" ? fromEnv.trim() : "";
}

/** Header xác thực, rỗng khi không có token. Hàm thuần để test được. */
export function authHeaders(token = voiceApiToken()): Record<string, string> {
  const clean = token.trim();
  return clean ? { Authorization: `Bearer ${clean}` } : {};
}

/** Lưu token người dùng nhập vào giao diện; truyền chuỗi rỗng để xoá. */
export function setVoiceApiToken(token: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (token.trim() === "") localStorage.removeItem(VOICE_TOKEN_STORAGE_KEY);
    else localStorage.setItem(VOICE_TOKEN_STORAGE_KEY, token.trim());
  } catch {
    // Không lưu được thì thôi; request vẫn dùng token trong phiên qua biến môi trường.
  }
}

/**
 * Kiểm tra backend có sống không. Dùng `health` vì nó nhẹ và không kích hoạt việc
 * nạp model.
 */
export async function probeVoiceApi(timeoutMs = 1500): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${voiceApiBase()}/api/health`, { signal: controller.signal });
    if (!response.ok) return false;
    const body = (await response.json()) as { ok?: unknown };
    return body?.ok === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Đọc văn bản thành audio MP3 qua backend. */
export async function synthesizeSpeech(text: string, voiceLabel: string, signal?: AbortSignal): Promise<Blob> {
  const form = new FormData();
  form.append("text", text);
  form.append("voice", voiceLabel);
  const response = await fetch(`${voiceApiBase()}/api/tts`, {
    method: "POST",
    body: form,
    headers: authHeaders(),
    signal,
  });
  if (!response.ok) {
    throw new Error(response.status === 401 ? "Máy chủ giọng đọc yêu cầu token" : `TTS thất bại (${response.status})`);
  }
  return response.blob();
}

/** Nhận diện giọng nói từ dữ liệu ghi âm qua backend. */
export async function transcribeSpeech(audio: Blob, signal?: AbortSignal): Promise<string> {
  const form = new FormData();
  // Tên tệp cần đuôi để server biết định dạng; MediaRecorder thường trả webm/ogg.
  form.append("audio", audio, "recording.webm");
  const response = await fetch(`${voiceApiBase()}/api/stt`, { method: "POST", body: form, headers: authHeaders(), signal });
  if (!response.ok) {
    throw new Error(response.status === 401 ? "Máy chủ giọng đọc yêu cầu token" : `STT thất bại (${response.status})`);
  }
  const body = (await response.json()) as { text?: unknown };
  return typeof body.text === "string" ? body.text : "";
}

/**
 * Nhãn nhãn cho ô chọn nguồn giọng đọc, hiển thị cho người dùng biết đang dùng
 * giọng thật từ backend hay giọng của trình duyệt.
 */
export function voiceSourceLabel(backend: boolean, deviceVoice: boolean): string {
  if (backend) return "Giọng tiếng Việt từ máy chủ Callio.";
  if (deviceVoice) return "Đang đọc bằng giọng tiếng Việt có sẵn trên thiết bị.";
  return "Thiết bị chưa có giọng tiếng Việt; sẽ đọc bằng giọng gần nhất.";
}
