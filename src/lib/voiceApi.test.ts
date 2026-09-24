import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authHeaders, voiceSourceLabel } from "./voiceApi.ts";

describe("nhãn nguồn giọng đọc", () => {
  it("ưu tiên nói rõ khi dùng máy chủ Callio", () => {
    assert.match(voiceSourceLabel(true, true), /máy chủ Callio/i);
    assert.match(voiceSourceLabel(true, false), /máy chủ Callio/i, "có backend thì không cần nhắc thiết bị");
  });

  it("nói rõ khi dùng giọng có sẵn của thiết bị", () => {
    assert.match(voiceSourceLabel(false, true), /thiết bị/i);
  });

  it("cảnh báo khi thiết bị thiếu giọng tiếng Việt và không có backend", () => {
    assert.match(voiceSourceLabel(false, false), /chưa có giọng tiếng Việt/i);
  });
});

describe("header xác thực", () => {
  it("không gửi header khi không có token", () => {
    assert.deepEqual(authHeaders(""), {});
  });

  it("gửi bearer token khi có", () => {
    assert.deepEqual(authHeaders("abc123"), { Authorization: "Bearer abc123" });
  });

  it("không tự thêm khoảng trắng thừa vào token", () => {
    assert.equal(authHeaders("  xyz  ").Authorization, "Bearer xyz");
  });
});
