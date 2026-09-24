import { useCallback, useEffect, useRef, useState } from "react";
import { fillVariables } from "./callbot";
import { probeVoiceApi, synthesizeSpeech, transcribeSpeech } from "./voiceApi";
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
  /** Backend giọng nói (backend/voice) có sống không; có thì ưu tiên dùng. */
  backend: boolean;
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
 *
 * Nếu backend giọng nói của Callio đang chạy (`backend/voice`), ưu tiên phát audio
 * do backend tổng hợp — giọng tiếng Việt tốt hơn và giống nhau trên mọi thiết bị.
 * `voiceLabel` là nhãn sản phẩm (ví dụ "Giọng nữ miền Bắc - Linh An") để backend
 * tự ánh xạ sang mã giọng.
 */
export function useSpeech(voiceLabel?: string): UseSpeechValue {
  const supported = speechSupported();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [backend, setBackend] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cancelledRef = useRef(false);

  // Dò backend một lần khi hook được dùng; không có thì im lặng lùi về trình duyệt.
  useEffect(() => {
    let alive = true;
    probeVoiceApi().then((ok) => {
      if (alive) setBackend(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

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

  // Nhả audio và dừng đọc khi rời trang để không rò rỉ bộ nhớ/blob URL.
  useEffect(
    () => () => {
      cancelledRef.current = true;
      audioRef.current?.pause();
      audioRef.current = null;
    },
    [],
  );

  const stop = useCallback(() => {
    cancelledRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (supported) window.speechSynthesis.cancel();
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

  /** Đọc bằng Web Speech API của trình duyệt (đường lùi khi không có backend). */
  const speakViaBrowser = useCallback(
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

  const speakSegmentsViaBrowser = useCallback(
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

  /** Đọc một đoạn bằng audio của backend; trả false nếu backend lỗi để gọi chỗ lùi. */
  const speakViaBackend = useCallback(
    async (text: string, id: string): Promise<boolean> => {
      try {
        const blob = await synthesizeSpeech(text, voiceLabel ?? "");
        // Người dùng có thể đã bấm dừng trong lúc chờ mạng; đừng phát nữa.
        if (cancelledRef.current) return true;
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          setSpeakingId((current) => (current === id ? null : current));
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          setSpeakingId((current) => (current === id ? null : current));
        };
        await audio.play();
        setSpeakingId(id);
        return true;
      } catch {
        return false;
      }
    },
    [voiceLabel],
  );

  const speak = useCallback(
    (text: string, profile: SpeechProfile, id: string) => {
      if (text.trim() === "") return false;
      cancelledRef.current = false;
      if (backend) {
        // Không chờ: giao diện báo đã bắt đầu; lỗi mạng thì lùi về trình duyệt.
        void speakViaBackend(text, id).then((ok) => {
          if (!ok) speakViaBrowser(text, profile, id);
        });
        return true;
      }
      if (!supported) return false;
      return speakViaBrowser(text, profile, id);
    },
    [backend, supported, speakViaBackend, speakViaBrowser],
  );

  const speakSegments = useCallback(
    (segments: SpeechSegment[], profile: SpeechProfile, batchId: string, onSegment?: (index: number) => void) => {
      if (segments.length === 0) return false;
      cancelledRef.current = false;
      if (backend) {
        // Đọc tuần tự qua backend để báo đúng chỉ số bước đang đọc.
        void (async () => {
          for (let index = 0; index < segments.length; index += 1) {
            if (cancelledRef.current) return;
            onSegment?.(index);
            const ok = await speakViaBackend(segments[index].text, `${batchId}-${index}`);
            if (!ok) {
              // Backend hỏng giữa chừng: đọc nốt phần còn lại bằng trình duyệt.
              speakViaBrowser(segments.slice(index).map((s) => s.text).join(" "), profile, batchId);
              return;
            }
            // Chờ đoạn hiện tại phát xong mới sang đoạn sau.
            await waitForAudioEnd(audioRef);
            if (cancelledRef.current) return;
          }
          setSpeakingId((current) => (current === batchId ? null : current));
        })();
        setSpeakingId(batchId);
        return true;
      }
      if (!supported) return false;
      return speakSegmentsViaBrowser(segments, profile, batchId, onSegment);
    },
    [backend, supported, speakViaBackend, speakViaBrowser, speakSegmentsViaBrowser],
  );

  return { supported, backend, voices, speakingId, speak, speakSegments, stop };
}

/** Chờ thẻ audio hiện tại phát xong; dùng khi đọc tuần tự qua backend. */
function waitForAudioEnd(ref: { current: HTMLAudioElement | null }): Promise<void> {
  const audio = ref.current;
  if (!audio) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      audio.removeEventListener("ended", done);
      audio.removeEventListener("error", done);
      resolve();
    };
    audio.addEventListener("ended", done);
    audio.addEventListener("error", done);
  });
}


/* ------------------------------------------------------------------ *
 * Nhận diện giọng nói (Speech Recognition)
 * ------------------------------------------------------------------ */

/** Kiểu tối thiểu của SpeechRecognition để không phụ thuộc lib DOM của trình duyệt. */
interface SpeechRecognitionResultLike {
  readonly length: number;
  item(index: number): { transcript: string; confidence: number } | undefined;
  [index: number]: { transcript: string; confidence: number } | undefined;
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    [index: number]: SpeechRecognitionResultLike | undefined;
  };
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionCtor {
  new (): SpeechRecognitionLike;
}

function recognitionCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Trình duyệt hiện tại có nhận diện giọng nói hay không (Chrome/Edge có, Safari/Firefox thường không). */
export function recognitionSupported(): boolean {
  return recognitionCtor() !== undefined;
}

/**
 * Gộp các kết quả đã hoàn tất thành một câu, bỏ qua phần interim. Tách riêng để
 * test được mà không cần trình duyệt.
 */
export function collectTranscript(event: SpeechRecognitionEventLike, fromIndex: number): string {
  let text = "";
  for (let i = fromIndex; i < event.results.length; i += 1) {
    const alt = event.results[i]?.[0];
    if (alt?.transcript) text += ` ${alt.transcript}`;
  }
  return text.trim();
}

interface UseSpeechRecognitionValue {
  supported: boolean;
  /** Backend giọng nói có sống không; có thì ghi âm rồi gửi lên `/api/stt`. */
  backend: boolean;
  listening: boolean;
  /** Câu nhận diện được gần nhất, chưa chuẩn hoá. */
  transcript: string;
  /** Mã lỗi gần nhất của trình duyệt (ví dụ "not-allowed" khi chưa cấp quyền micro). */
  error: string | null;
  start: () => boolean;
  stop: () => void;
  reset: () => void;
}

/**
 * Bọc SpeechRecognition thành hook React. Mỗi lần `start` là một phiên nghe mới;
 * kết quả được gộp dần và trả về qua `transcript`.
 *
 * Nếu backend giọng nói đang chạy, hook ghi âm qua `MediaRecorder` rồi gửi lên
 * `/api/stt` (nhận diện tiếng Việt tốt hơn trên nhiều máy); nếu không thì dùng
 * `SpeechRecognition` của trình duyệt.
 */
export function useSpeechRecognition(lang: string = DEFAULT_VOICE_LANG): UseSpeechRecognitionValue {
  const supported = recognitionSupported();
  const [backend, setBackend] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const instanceRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    let alive = true;
    probeVoiceApi().then((ok) => {
      if (alive) setBackend(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  const stop = useCallback(() => {
    instanceRef.current?.stop();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setError(null);
  }, []);

  /** Ghi âm micro rồi gửi lên backend để nhận diện. */
  const startViaBackend = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        for (const track of stream.getTracks()) track.stop();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setListening(false);
        if (blob.size === 0) {
          setError("no-speech");
          return;
        }
        transcribeSpeech(blob)
          .then((text) => setTranscript(text))
          .catch((err: unknown) => setError(err instanceof Error ? err.message : "stt-failed"));
      };
      recorderRef.current = recorder;
      setTranscript("");
      setError(null);
      recorder.start();
      setListening(true);
      return true;
    } catch (err) {
      // Thường là người dùng chưa cấp quyền micro.
      setError(err instanceof Error && err.name === "NotAllowedError" ? "not-allowed" : "mic-failed");
      setListening(false);
      return false;
    }
  }, []);

  const start = useCallback(() => {
    if (backend) {
      void startViaBackend();
      return true;
    }
    if (!supported) return false;
    const Ctor = recognitionCtor();
    if (!Ctor) return false;

    // Mỗi phiên dùng một đối tượng mới: tái sử dụng instance sau khi end có thể
    // không nhận thêm kết quả trên một số bản Chrome.
    instanceRef.current?.abort();
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      setTranscript(collectTranscript(event, event.resultIndex));
    };
    recognition.onerror = (event) => {
      setError(event.error);
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    instanceRef.current = recognition;
    setTranscript("");
    setError(null);
    try {
      recognition.start();
      setListening(true);
      return true;
    } catch (err) {
      // Gọi start khi phiên trước chưa đóng sẽ ném lỗi; coi như không bắt đầu được.
      setError(err instanceof Error ? err.message : "start-failed");
      setListening(false);
      return false;
    }
  }, [backend, startViaBackend, supported, lang]);

  useEffect(
    () => () => {
      instanceRef.current?.abort();
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    },
    [],
  );

  return { supported, backend, listening, transcript, error, start, stop, reset };
}
