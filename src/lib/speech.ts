import { useCallback, useEffect, useState } from "react";
import { fillVariables } from "./callbot";
import type { CallbotCampaign, CallbotScriptStep, Customer } from "./types";

/**
 * Hồ sơ giọng đọc suy ra từ nhãn hiển thị của sản phẩm. Đây là lớp thuần, tách
 * khỏi Web Speech API để kiểm thử được bằng `node:test`.
 */
export interface SpeechProfile {
  lang: string;
  pitch: number;
  rate: number;
  gender: "nam" | "nu";
  region: "bac" | "nam";
}

export interface VoiceLike {
  name: string;
  lang: string;
}

export const DEFAULT_VOICE_LANG = "vi-VN";

/**
 * Tách nhãn như "Giọng nữ miền Bắc - Linh An" thành tham số đọc. Không suy ra
 * được gì thì trả về hồ sơ trung tính thay vì ném lỗi, vì nhãn do người dùng thấy
 * chứ không phải dữ liệu có ràng buộc.
 */
export function parseVoiceLabel(label: string): SpeechProfile {
  const lower = label.toLowerCase();
  // "nữ" tách biệt với "nam" (nam vừa là giới tính vừa là miền Nam), nên nhận
  // diện giới tính bằng "nữ" trước rồi mới mặc định là nam.
  const gender: SpeechProfile["gender"] = lower.includes("nữ") ? "nu" : lower.includes("nam") ? "nam" : "nu";
  const region: SpeechProfile["region"] = lower.includes("miền nam") ? "nam" : "bac";
  return {
    lang: DEFAULT_VOICE_LANG,
    // Giọng nữ đọc cao hơn và giọng nam trầm hơn một chút; đây là mức chỉnh nhỏ
    // để khác biệt nghe ra được mà không làm giọng máy.
    pitch: gender === "nu" ? 1.12 : 0.9,
    rate: 1,
    gender,
    region,
  };
}

/** Điểm khớp giữa một giọng của trình duyệt và hồ sơ mong muốn; càng cao càng hợp. */
function scoreVoice(voice: VoiceLike, profile: SpeechProfile): number {
  const name = voice.name.toLowerCase();
  let score = 0;
  // Không cộng điểm cho tiếng Việt ở đây: việc ưu tiên tiếng Việt do `pickVoice`
  // lọc trước, để chỉ có một nguồn quyết định thay vì hai chỗ cùng suy luận.
  if (profile.region === "nam" && /nam|south|saigon|hcm/.test(name)) score += 2;
  if (profile.region === "bac" && /bac|north|hanoi|ha noi/.test(name)) score += 2;
  if (profile.gender === "nu" && /nu|female|woman|linh|duong|thu/.test(name)) score += 1;
  if (profile.gender === "nam" && /male|man|thinh|khang|minh/.test(name)) score += 1;
  return score;
}

/**
 * Chọn giọng trình duyệt hợp nhất với hồ sơ. Ưu tiên tuyệt đối giọng tiếng Việt;
 * nếu máy không có thì lấy giọng điểm cao nhất trong những gì đang có, và trả về
 * `undefined` khi trình duyệt chưa nạp được giọng nào.
 */
export function pickVoice<T extends VoiceLike>(voices: readonly T[], profile: SpeechProfile): T | undefined {
  const vietnamese = voices.filter((voice) => voice.lang.toLowerCase().startsWith("vi"));
  const pool = vietnamese.length > 0 ? vietnamese : voices;
  if (pool.length === 0) return undefined;
  return pool.reduce((best, voice) => (scoreVoice(voice, profile) > scoreVoice(best, profile) ? voice : best));
}

/** Một đoạn cần đọc: mã định danh để gắn trạng thái và nội dung đã điền biến. */
export interface SpeechSegment {
  id: string;
  text: string;
}

/**
 * Dựng danh sách đoạn đọc từ kịch bản: chỉ lời của trợ lý ảo, đã điền biến động
 * theo khách hàng đang xem trước, để nghe thử đúng như cuộc gọi thật.
 */
export function buildSpeechSegments(script: CallbotScriptStep[], customer: Customer, campaign: CallbotCampaign): SpeechSegment[] {
  return script
    .map((step) => ({ id: step.id, text: fillVariables(step.say, customer, campaign).trim() }))
    .filter((segment) => segment.text.length > 0);
}

/** Trình duyệt hiện tại có hỗ trợ tổng hợp giọng nói hay không. */
export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

interface UseSpeechValue {
  supported: boolean;
  /** Giọng thật của trình duyệt khớp với từng hồ sơ, để giao diện nói rõ đang dùng gì. */
  voices: SpeechSynthesisVoice[];
  /** Mã đoạn đang đọc, hoặc mã danh sách khi đang đọc cả kịch bản. */
  speakingId: string | null;
  speak: (text: string, profile: SpeechProfile, id: string) => boolean;
  speakSegments: (segments: SpeechSegment[], profile: SpeechProfile, batchId: string, onSegment?: (index: number) => void) => boolean;
  stop: () => void;
}

/**
 * Bọc Web Speech API thành hook React: nạp danh sách giọng (có thể về muộn nên
 * phải nghe `voiceschanged`), đọc từng đoạn và dừng sạch khi rời trang.
 */
export function useSpeech(): UseSpeechValue {
  const supported = speechSupported();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const load = () => setVoices(synth.getVoices());
    load();
    // Chrome nạp giọng bất đồng bộ; không nghe sự kiện này thì danh sách rỗng.
    synth.addEventListener("voiceschanged", load);
    return () => {
      synth.removeEventListener("voiceschanged", load);
      synth.cancel();
    };
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, [supported]);

  const applyProfile = useCallback(
    (utterance: SpeechSynthesisUtterance, profile: SpeechProfile) => {
      utterance.lang = profile.lang;
      utterance.pitch = profile.pitch;
      utterance.rate = profile.rate;
      const match = pickVoice(window.speechSynthesis.getVoices(), profile);
      if (match) {
        utterance.voice = match;
        utterance.lang = match.lang || profile.lang;
      }
    },
    [],
  );

  const speak = useCallback(
    (text: string, profile: SpeechProfile, id: string) => {
      if (!supported || text.trim() === "") return false;
      const synth = window.speechSynthesis;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      applyProfile(utterance, profile);
      utterance.onend = () => setSpeakingId((current) => (current === id ? null : current));
      utterance.onerror = () => setSpeakingId((current) => (current === id ? null : current));
      synth.speak(utterance);
      setSpeakingId(id);
      return true;
    },
    [supported, applyProfile],
  );

  const speakSegments = useCallback(
    (segments: SpeechSegment[], profile: SpeechProfile, batchId: string, onSegment?: (index: number) => void) => {
      if (!supported || segments.length === 0) return false;
      const synth = window.speechSynthesis;
      synth.cancel();
      segments.forEach((segment, index) => {
        const utterance = new SpeechSynthesisUtterance(segment.text);
        applyProfile(utterance, profile);
        // Đọc tuần tự: mỗi đoạn phát xong mới sang đoạn sau để hội thoại có nhịp,
        // và báo chỉ số đang đọc để giao diện tô sáng đúng bước.
        utterance.onstart = () => onSegment?.(index);
        if (index === segments.length - 1) {
          utterance.onend = () => setSpeakingId((current) => (current === batchId ? null : current));
        }
        utterance.onerror = () => setSpeakingId((current) => (current === batchId ? null : current));
        synth.speak(utterance);
      });
      setSpeakingId(batchId);
      return true;
    },
    [supported, applyProfile],
  );

  return { supported, voices, speakingId, speak, speakSegments, stop };
}
