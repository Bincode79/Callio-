import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fillVariables, hasOptedOut, hasTerminalStep, isWithinWindow, resultFromSimulation, simulateCall, variablesInScript } from "./callbot.ts";
import { callbotCampaigns, customers } from "./data.ts";
import type { CallbotCampaign } from "./types.ts";

// Ném lỗi ngay khi nạp thay vì dùng khẳng định non-null: nếu dữ liệu mẫu đổi
// khiến không tìm thấy chiến dịch, ta muốn biết ngay chứ không phải lỗi khó hiểu
// ở giữa bộ test.
const foundBase = callbotCampaigns.find((campaign) => campaign.id === "CB01");
if (!foundBase) throw new Error("Không tìm thấy chiến dịch mẫu CB01 trong dữ liệu");
const base: CallbotCampaign = foundBase;
const customer = customers[0];

/**
 * Tắt quy tắc khung giờ cho các ca không kiểm tra khung giờ. Bộ test chạy được ở
 * mọi thời điểm trong ngày, mà `quietHours` mặc định bật và sẽ chặn hết cuộc gọi
 * nếu chạy ngoài giờ làm việc.
 */
function withRules(patch: Partial<CallbotCampaign["rules"]>, overrides: Partial<CallbotCampaign> = {}): CallbotCampaign {
  return { ...base, ...overrides, rules: { ...base.rules, quietHours: false, ...patch } };
}

describe("quy tắc khung giờ (quietHours)", () => {
  // Khung giờ chắc chắn không chứa thời điểm chạy test, để không phụ thuộc giờ hệ thống.
  const closedWindow = { windowStart: "03:00", windowEnd: "03:01" };

  it("chặn cuộc gọi ngoài khung giờ và trả về lý do", () => {
    const result = simulateCall(withRules({ quietHours: true }, closedWindow), customer, 0);

    assert.equal(result.turns.length, 0, "không được sinh hội thoại khi bị chặn");
    assert.equal(result.stepReached, 0);
    assert.equal(result.outcome, "hen-goi-lai", "cuộc gọi bị chặn phải được xếp lịch gọi lại");
    assert.ok(result.blocked, "phải có thông tin chặn");
    assert.match(result.blocked.reason, /03:00/);
    assert.equal(result.durationSec, 0);
  });

  it("cho gọi ngoài khung giờ khi quy tắc đã tắt", () => {
    const result = simulateCall(withRules({ quietHours: false }, closedWindow), customer, 0);

    assert.ok(result.turns.length > 0, "tắt quy tắc thì phải gọi được");
    assert.equal(result.blocked, undefined);
  });

  it("không nhầm khung giờ thường với khung qua nửa đêm", () => {
    assert.equal(isWithinWindow("00:00", "23:59"), true, "khung bao trọn ngày luôn đúng");
    // Khung 00:00 - 00:01 chỉ đúng trong một phút mỗi ngày.
    const now = new Date();
    const inTinyWindow = now.getHours() === 0 && now.getMinutes() <= 1;
    assert.equal(isWithinWindow("00:00", "00:01"), inTinyWindow);
  });
});

describe("quy tắc không làm phiền (autoStopOptOut)", () => {
  it("dừng ngay khi khách yêu cầu không liên hệ, và ghi nhận lại", () => {
    const runs = Array.from({ length: 12 }, (_, variant) => simulateCall(withRules({ autoStopOptOut: true }), customer, variant));
    const optedOut = runs.filter((run) => run.optedOut);

    assert.ok(optedOut.length > 0, "phải có ít nhất một ca khách yêu cầu dừng");

    for (const run of optedOut) {
      const lastTurn = run.turns[run.turns.length - 1];
      assert.equal(lastTurn?.intent, "Ghi nhận không làm phiền", "phải kết thúc bằng lời ghi nhận");
      assert.equal(run.outcome, "tu-choi");
      assert.ok(run.stepReached < base.script.length, "phải dừng trước khi đọc hết kịch bản");
    }
  });

  it("không dừng vì lý do opt-out khi quy tắc đã tắt", () => {
    const runs = Array.from({ length: 12 }, (_, variant) => simulateCall(withRules({ autoStopOptOut: false }), customer, variant));
    assert.equal(runs.some((run) => run.optedOut), false);
  });

  it("nhận diện yêu cầu dừng có dấu lẫn không dấu", () => {
    assert.equal(hasOptedOut("Thôi đừng gọi cho tôi nữa"), true);
    assert.equal(hasOptedOut("KHONG LAM PHIEN"), true);
    assert.equal(hasOptedOut("Dạ đúng rồi em"), false);
    assert.equal(hasOptedOut(""), false);
  });
});

describe("quy tắc chuyển nhân viên (escalateNegative)", () => {
  it("nối máy chuyên viên thay vì kết thúc khi khách từ chối", () => {
    const runs = Array.from({ length: 12 }, (_, variant) => simulateCall(withRules({ escalateNegative: true }), customer, variant));
    const escalated = runs.filter((run) => run.escalated);

    assert.ok(escalated.length > 0, "phải có ca được chuyển nhân viên");

    for (const run of escalated) {
      assert.equal(run.outcome, "hen-goi-lai", "chuyển nhân viên cần người thật gọi lại, không phải từ chối hẳn");
      assert.ok(run.turns.some((turn) => turn.intent === "Chuyển nhân viên"));
    }
  });

  it("giữ nguyên kết quả từ chối khi quy tắc đã tắt", () => {
    const runs = Array.from({ length: 12 }, (_, variant) => simulateCall(withRules({ escalateNegative: false }), customer, variant));

    assert.equal(runs.some((run) => run.escalated), false);
    assert.ok(runs.some((run) => run.outcome === "tu-choi"), "khách từ chối vẫn phải ra kết quả từ chối");
  });
});

describe("quy tắc SMS xác nhận (sendConfirmSms)", () => {
  it("chỉ gửi SMS khi cuộc gọi kết thúc có xác nhận", () => {
    const runs = Array.from({ length: 12 }, (_, variant) => simulateCall(withRules({ sendConfirmSms: true }), customer, variant));

    assert.ok(runs.some((run) => run.outcome === "xac-nhan"), "cần có ca xác nhận để kiểm tra");
    for (const run of runs) {
      assert.equal(run.smsSent, run.outcome === "xac-nhan", `kết quả ${run.outcome} thì smsSent phải là ${run.outcome === "xac-nhan"}`);
    }
  });

  it("không gửi SMS khi quy tắc đã tắt", () => {
    const runs = Array.from({ length: 12 }, (_, variant) => simulateCall(withRules({ sendConfirmSms: false }), customer, variant));

    assert.equal(runs.some((run) => run.smsSent), false);
    assert.ok(runs.some((run) => run.outcome === "xac-nhan"), "kết quả xác nhận vẫn phải xuất hiện");
  });
});

describe("điền biến động trong lời thoại", () => {
  it("thay biến bằng dữ liệu thật của khách hàng", () => {
    const filled = fillVariables("Chào {ten_khach}, đơn {ma_don} giao ngày {ngay_giao}.", customer, base);

    assert.ok(filled.includes(customer.name), "phải điền tên khách");
    assert.ok(filled.includes(customer.code.replace(/\D/g, "")), "mã đơn lấy từ mã khách");
    assert.equal(filled.includes("{ten_khach}"), false, "không được sót biến chưa thay");
    assert.equal(filled.includes("{ma_don}"), false);
    assert.equal(filled.includes("{ngay_giao}"), false);
  });

  it("liệt kê đúng các biến đang dùng trong kịch bản", () => {
    const variables = variablesInScript([
      { id: "a", label: "A", say: "Chào {ten_khach}", expect: "", branch: "tiep-tuc" },
      { id: "b", label: "B", say: "Đơn {ma_don} của {ten_khach}", expect: "", branch: "ket-thuc" },
    ]);

    assert.deepEqual(variables.sort(), ["{ma_don}", "{ten_khach}"]);
  });
});

describe("kiểm tra hợp lệ kịch bản", () => {
  it("phát hiện kịch bản thiếu bước kết thúc", () => {
    assert.equal(hasTerminalStep([{ id: "a", label: "A", say: "x", expect: "", branch: "tiep-tuc" }]), false);
    assert.equal(
      hasTerminalStep([
        { id: "a", label: "A", say: "x", expect: "", branch: "tiep-tuc" },
        { id: "b", label: "B", say: "y", expect: "", branch: "ket-thuc" },
      ]),
      true,
    );
  });
});

describe("chuyển kết quả mô phỏng thành bản ghi", () => {
  it("giữ lại cờ can thiệp của quy tắc", () => {
    const simulation = simulateCall(withRules({ quietHours: true, syncToCrm: true }, { windowStart: "03:00", windowEnd: "03:01" }), customer, 0);
    const record = resultFromSimulation(base, customer, simulation, 0);

    assert.equal(record.customerId, customer.id);
    assert.equal(record.outcome, "hen-goi-lai");
    assert.ok(record.blockedReason, "bản ghi phải giữ lý do bị chặn để xem lại");
    assert.equal(record.escalated, false);
    assert.equal(record.optedOut, false);
  });
});
