import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AudioCache, nextPrefetchIndex, speechCacheKey } from "./voiceCache.ts";

// Blob có sẵn trong Node 18+; dùng chuỗi bọc lại cho gọn.
const blob = (label: string) => new Blob([label]);

describe("khoá đệm audio", () => {
  it("cùng giọng và cùng nội dung thì cùng khoá", () => {
    assert.equal(speechCacheKey("Xin chào", "Giọng nữ miền Bắc"), speechCacheKey("Xin chào", "Giọng nữ miền Bắc"));
  });

  it("khác giọng thì khác khoá, tránh phát nhầm giọng", () => {
    assert.notEqual(speechCacheKey("Xin chào", "Giọng nữ miền Bắc"), speechCacheKey("Xin chào", "Giọng nam miền Nam"));
  });

  it("khác nội dung thì khác khoá", () => {
    assert.notEqual(speechCacheKey("Một", "A"), speechCacheKey("Hai", "A"));
  });

  it("bỏ khoảng trắng thừa để tăng tỉ lệ trúng đệm", () => {
    assert.equal(speechCacheKey("  Xin chào  ", " A "), speechCacheKey("Xin chào", "A"));
  });
});

describe("đệm audio LRU", () => {
  it("lưu và đọc lại được", () => {
    const cache = new AudioCache(4);
    cache.set("a", blob("A"));
    assert.equal(cache.has("a"), true);
    assert.equal(cache.get("a")?.size, 1);
  });

  it("trả undefined cho khoá chưa có", () => {
    assert.equal(new AudioCache(4).get("x"), undefined);
  });

  it("loại phần tử cũ nhất khi vượt sức chứa", () => {
    const cache = new AudioCache(2);
    cache.set("a", blob("A"));
    cache.set("b", blob("B"));
    cache.set("c", blob("C"));

    assert.equal(cache.has("a"), false, "phần tử cũ nhất phải bị loại");
    assert.equal(cache.has("b"), true);
    assert.equal(cache.has("c"), true);
    assert.equal(cache.size, 2);
  });

  it("đọc lại một khoá thì khoá đó thành mới nhất", () => {
    const cache = new AudioCache(2);
    cache.set("a", blob("A"));
    cache.set("b", blob("B"));
    cache.get("a"); // chạm vào a -> a mới nhất, b cũ nhất

    cache.set("c", blob("C"));
    assert.equal(cache.has("a"), true, "khoá vừa đọc không được bị loại");
    assert.equal(cache.has("b"), false, "khoá cũ nhất bị loại");
  });

  it("ghi đè khoá cũ không làm tăng kích thước", () => {
    const cache = new AudioCache(2);
    cache.set("a", blob("A"));
    cache.set("a", blob("AA"));
    assert.equal(cache.size, 1);
  });

  it("giữ đúng thứ tự từ cũ tới mới", () => {
    const cache = new AudioCache(3);
    cache.set("a", blob("A"));
    cache.set("b", blob("B"));
    cache.set("c", blob("C"));
    assert.deepEqual(cache.keysInOrder(), ["a", "b", "c"]);
  });

  it("sức chứa 0 vẫn hoạt động (không làm mất cache hoàn toàn)", () => {
    const cache = new AudioCache(0);
    cache.set("a", blob("A"));
    assert.equal(cache.size, 1, "sức chứa tối thiểu là 1 để tránh tắt cache ngoài ý muốn");
  });

  it("clear xoá hết", () => {
    const cache = new AudioCache(4);
    cache.set("a", blob("A"));
    cache.clear();
    assert.equal(cache.size, 0);
  });
});

describe("quyết định tải trước", () => {
  const segments = [{ id: "s1" }, { id: "s2" }, { id: "s3" }];

  it("tải trước đoạn kế tiếp khi chưa có trong đệm", () => {
    assert.equal(nextPrefetchIndex(segments, 0, () => false), 1);
  });

  it("không tải trước khi đoạn kế tiếp đã có trong đệm", () => {
    assert.equal(nextPrefetchIndex(segments, 0, (id) => id === "s2"), null);
  });

  it("không tải trước khi đang ở đoạn cuối", () => {
    assert.equal(nextPrefetchIndex(segments, 2, () => false), null);
  });

  it("không tải trước khi danh sách rỗng", () => {
    assert.equal(nextPrefetchIndex([], 0, () => false), null);
  });
});
