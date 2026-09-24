/**
 * Bộ nhớ đệm audio tổng hợp, để không phải gọi backend lại cho cùng một câu.
 *
 * Hữu ích thật trong hai tình huống hay gặp:
 * - Bấm "Nghe thử" nhiều lần cho cùng một bước kịch bản.
 * - Chạy lại mô phỏng với cùng khách hàng (lời thoại và biến động không đổi).
 *
 * Lớp thuần, không phụ thuộc DOM, nên test được bằng `node:test`.
 */

/** Khoá đệm: cùng giọng + cùng nội dung thì cùng audio. */
export function speechCacheKey(text: string, voiceLabel: string): string {
  return `${voiceLabel.trim()}::${text.trim()}`;
}

/**
 * Cache LRU tối giản. Dùng `Map` vì nó giữ thứ tự chèn, nên phần tử đầu tiên là
 * phần tử cũ nhất — đúng thứ tự cần loại khi vượt sức chứa.
 */
export class AudioCache {
  private readonly maxEntries: number;
  private readonly store = new Map<string, Blob>();

  constructor(maxEntries = 32) {
    // Ít nhất 1 để cache luôn dùng được; đặt 0 là cách tắt vô tình, nên chặn lại.
    this.maxEntries = Math.max(1, maxEntries);
  }

  get size(): number {
    return this.store.size;
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  get(key: string): Blob | undefined {
    const value = this.store.get(key);
    if (value === undefined) return undefined;
    // Chạm vào thì đưa lên cuối để không bị loại sớm (đúng ngữ nghĩa LRU).
    this.store.delete(key);
    this.store.set(key, value);
    return value;
  }

  set(key: string, value: Blob): void {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, value);
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next();
      if (oldest.done) break;
      this.store.delete(oldest.value);
    }
  }

  clear(): void {
    this.store.clear();
  }

  /** Chỉ dùng cho test: thứ tự khoá từ cũ nhất tới mới nhất. */
  keysInOrder(): string[] {
    return [...this.store.keys()];
  }
}

/**
 * Có nên tải trước đoạn kế tiếp không. Trả về chỉ số cần tải trước, hoặc `null`.
 *
 * Không tải trước khi đang ở đoạn cuối (không còn gì để tải), và không tải trước
 * đoạn đã có trong cache.
 */
export function nextPrefetchIndex(segments: Array<{ id: string }>, currentIndex: number, cached: (id: string) => boolean): number | null {
  const next = currentIndex + 1;
  if (next < 0 || next >= segments.length) return null;
  if (cached(segments[next].id)) return null;
  return next;
}

/* ------------------------------------------------------------------ *
 * Phát streaming bằng MediaSource
 * ------------------------------------------------------------------ */

type MediaSourceCtor = {
  isTypeSupported(type: string): boolean;
  new (): MediaSource;
};

function mediaSourceCtor(): MediaSourceCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { MediaSource?: MediaSourceCtor };
  return w.MediaSource;
}

/**
 * Trình duyệt có phát dần MP3 qua MediaSource được không.
 *
 * Đã kiểm chứng bằng trình duyệt thật (Chrome): `MediaSource.isTypeSupported("audio/mpeg")`
 * trả true và `SourceBuffer` nhận đủ ~4,2 giây audio từ edge-tts. `false` chủ yếu gặp ở
 * Firefox (MSE chỉ nhận fMP4/WebM); khi đó lớp gọi tự lùi về phát cả tệp.
 */
export function mseMp3Supported(): boolean {
  const ctor = mediaSourceCtor();
  if (!ctor) return false;
  try {
    return ctor.isTypeSupported("audio/mpeg");
  } catch {
    return false;
  }
}

export interface StreamPlayback {
  /** Kết thúc khi audio phát xong, khi lỗi, hoặc khi `stop()` được gọi. */
  done: Promise<void>;
  stop: () => void;
}

/**
 * Phát dần audio MP3 từ một `Response` (đường `/api/tts/stream`).
 *
 * Nối từng khối vào `SourceBuffer` ngay khi mạng trả về, nên người dùng nghe được
 * trước khi toàn bộ câu được tổng hợp xong.
 */
export function playMp3Stream(response: Response, audioRef?: { current: HTMLAudioElement | null }): StreamPlayback {
  const ctor = mediaSourceCtor();
  const audio = new Audio();
  if (audioRef) audioRef.current = audio;

  let stopped = false;
  let settle: () => void = () => {};
  const done = new Promise<void>((resolve) => {
    settle = resolve;
  });

  const finish = () => {
    if (stopped) return;
    stopped = true;
    settle();
  };

  if (!ctor) {
    // Không có MediaSource: kết thúc ngay để lớp gọi tự lùi về phát cả tệp.
    settle();
    return { done, stop: () => {} };
  }

  const mediaSource = new ctor();
  const url = URL.createObjectURL(mediaSource);
  audio.src = url;
  audio.onended = finish;
  audio.onerror = finish;

  const release = () => {
    URL.revokeObjectURL(url);
    if (audioRef && audioRef.current === audio) audioRef.current = null;
  };

  const pump = async () => {
    const source = mediaSource.addSourceBuffer("audio/mpeg");
    const reader = response.body?.getReader();
    if (!reader) {
      // Không đọc dần được: đành chờ cả tệp rồi phát.
      const blob = await response.blob();
      settle();
      void blob;
      return;
    }
    let started = false;
    for (;;) {
      const { done: finished, value } = await reader.read();
      if (finished) break;
      if (stopped) return;
      if (!value) continue;
      // Nối từng khối và chờ `updateend`: gọi appendBuffer chồng nhau sẽ ném lỗi.
      await new Promise<void>((resolve, reject) => {
        const onUpdateEnd = () => {
          source.removeEventListener("updateend", onUpdateEnd);
          resolve();
        };
        source.addEventListener("updateend", onUpdateEnd);
        try {
          source.appendBuffer(value);
        } catch (err) {
          source.removeEventListener("updateend", onUpdateEnd);
          reject(err);
        }
      });
      if (!started) {
        started = true;
        // Phát sau khối đầu tiên để giảm thời gian chờ nghe.
        await audio.play().catch(() => {
          // Bị chặn autoplay: vẫn coi như phát xong để không treo vòng lặp gọi.
          finish();
        });
      }
    }
    if (!stopped) {
      try {
        mediaSource.endOfStream();
      } catch {
        // Chưa đủ dữ liệu để kết thúc sạch; audio.onended sẽ lo phần còn lại.
      }
    }
  };

  mediaSource.addEventListener("sourceopen", () => {
    pump().catch(finish);
  });

  return {
    done: done.finally(release),
    stop: () => {
      if (stopped) return;
      stopped = true;
      audio.pause();
      settle();
    },
  };
}
