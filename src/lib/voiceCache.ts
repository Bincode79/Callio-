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
