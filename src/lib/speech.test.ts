import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSpeechSegments, parseVoiceLabel, pickVoice } from "./speech.ts";
import { callbotCampaigns, customers } from "./data.ts";

const customer = customers[0];

describe("suy hồ sơ giọng đọc từ nhãn", () => {
  it("nhận đúng giới tính nữ dù nhãn có chữ nam", () => {
    const profile = parseVoiceLabel("Giọng nữ miền Nam - Thuỳ Dương");
    assert.equal(profile.gender, "nu", "nữ phải được nhận trước nam để không bị nhầm là nam");
    assert.equal(profile.region, "nam");
  });

  it("nhận đúng giọng nam miền Bắc", () => {
    const profile = parseVoiceLabel("Giọng nam miền Bắc - Đức Thịnh");
    assert.equal(profile.gender, "nam");
    assert.equal(profile.region, "bac");
  });

  it("giọng nữ đọc cao hơn giọng nam", () => {
    const female = parseVoiceLabel("Giọng nữ miền Bắc - Linh An");
    const male = parseVoiceLabel("Giọng nam miền Bắc - Đức Thịnh");
    assert.ok(female.pitch > male.pitch, "pitch giọng nữ phải lớn hơn giọng nam");
    assert.equal(female.lang, "vi-VN");
  });

  it("nhãn lạ vẫn trả hồ sơ hợp lệ thay vì lỗi", () => {
    const profile = parseVoiceLabel("Giọng đặc biệt");
    assert.equal(profile.lang, "vi-VN");
    assert.ok(profile.pitch > 0);
    assert.ok(profile.rate > 0);
  });
});

describe("chọn giọng trình duyệt", () => {
  const voices = [
    { name: "Google US English", lang: "en-US" },
    { name: "Vietnamese Hanoi", lang: "vi-VN" },
    { name: "Vietnamese Saigon Female", lang: "vi-VN" },
  ];

  it("luôn ưu tiên giọng tiếng Việt, kể cả khi giọng ngoại khớp miền/giới tính hơn", () => {
    // Giọng tiếng Anh tên khớp cả miền Nam lẫn nữ nên điểm thô cao hơn giọng Việt
    // chung chung; nếu bỏ ưu tiên tiếng Việt thì test này sẽ đỏ.
    const mixed = [
      { name: "South Vietnam Female English", lang: "en-US" },
      { name: "Vietnamese", lang: "vi-VN" },
    ];
    const picked = pickVoice(mixed, parseVoiceLabel("Giọng nữ miền Nam"));
    assert.equal(picked?.lang, "vi-VN", "phải chọn giọng tiếng Việt dù điểm thô thấp hơn");
  });

  it("chọn giọng miền Nam khi hồ sơ là miền Nam", () => {
    const picked = pickVoice(voices, parseVoiceLabel("Giọng nữ miền Nam"));
    assert.equal(picked?.name, "Vietnamese Saigon Female");
  });

  it("vẫn chọn được khi thiết bị chỉ có giọng nước ngoài", () => {
    const picked = pickVoice([{ name: "Google US English", lang: "en-US" }], parseVoiceLabel("Giọng nam miền Bắc"));
    assert.equal(picked?.name, "Google US English", "không có tiếng Việt thì dùng giọng gần nhất");
  });

  it("trả về undefined khi máy chưa nạp giọng nào", () => {
    assert.equal(pickVoice([], parseVoiceLabel("Giọng nữ miền Bắc")), undefined);
  });
});

describe("dựng đoạn đọc từ kịch bản", () => {
  const campaign = callbotCampaigns[0];

  it("điền biến động theo khách hàng đang xem trước", () => {
    const segments = buildSpeechSegments(campaign.script, customer, campaign);
    assert.ok(segments.length > 0, "kịch bản mẫu phải có lời thoại");
    for (const segment of segments) {
      assert.equal(segment.text.includes("{ten_khach}"), false, "không được sót biến chưa thay");
      assert.ok(segment.text.trim().length > 0);
    }
  });

  it("bỏ trống lời thoại thì không sinh đoạn đọc", () => {
    const segments = buildSpeechSegments(
      [
        { id: "a", label: "A", say: "   ", expect: "", branch: "tiep-tuc" },
        { id: "b", label: "B", say: "Kính chào quý khách", expect: "", branch: "ket-thuc" },
      ],
      customer,
      campaign,
    );
    assert.equal(segments.length, 1);
    assert.equal(segments[0].id, "b");
  });

  it("giữ mã bước làm id để giao diện tô sáng đúng bước", () => {
    const segments = buildSpeechSegments(campaign.script, customer, campaign);
    assert.deepEqual(
      segments.map((segment) => segment.id),
      campaign.script.map((step) => step.id),
    );
  });
});
