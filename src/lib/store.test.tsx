import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { initialState, reducer } from "./store.tsx";
import type { AppState } from "./store.tsx";
import { callbotCampaigns, customers, leads } from "./data.ts";
import type { CallbotResult } from "./types.ts";

/** State sạch cho mỗi ca test; initialState là hằng dùng chung nên phải tách bản sao. */
function freshState(): AppState {
  return structuredClone(initialState);
}

function campaignIn(state: AppState, id: string) {
  const campaign = state.callbotCampaigns.find((item) => item.id === id);
  if (!campaign) throw new Error(`Không tìm thấy chiến dịch ${id}`);
  return campaign;
}

describe("hội thoại đa kênh", () => {
  it("phân công thì gán người phụ trách và xoá số chưa đọc", () => {
    const state = freshState();
    const target = state.conversations.find((item) => item.unread > 0);
    assert.ok(target, "cần một hội thoại đang có tin chưa đọc để kiểm tra");

    const next = reducer(state, { type: "assignConversation", id: target.id, assignee: "Nguyễn Thị Hồng Nhung" });
    const updated = next.conversations.find((item) => item.id === target.id);

    assert.equal(updated?.assignee, "Nguyễn Thị Hồng Nhung");
    assert.equal(updated?.unread, 0, "phân công xong thì không còn tin chưa đọc");
    assert.equal(updated?.status, "dang-mo");
  });

  it("trả lời thì thêm tin vào cuối và chuyển sang chờ khách", () => {
    const state = freshState();
    const target = state.conversations[0];
    const before = target.messages.length;

    const next = reducer(state, { type: "replyConversation", id: target.id, body: "Dạ em gửi báo giá ạ." });
    const updated = next.conversations.find((item) => item.id === target.id);

    assert.equal(updated?.messages.length, before + 1);
    assert.equal(updated?.messages[updated.messages.length - 1]?.body, "Dạ em gửi báo giá ạ.");
    assert.equal(updated?.messages[updated.messages.length - 1]?.direction, "out");
    assert.equal(updated?.status, "cho-khach", "đã trả lời thì chờ phản hồi của khách");
    assert.equal(updated?.unread, 0);
  });

  it("đóng hội thoại thì đánh dấu đã xử lý", () => {
    const state = freshState();
    const target = state.conversations[0];

    const next = reducer(state, { type: "resolveConversation", id: target.id });
    assert.equal(next.conversations.find((item) => item.id === target.id)?.status, "da-xu-ly");
  });

  it("không đụng tới hội thoại khác", () => {
    const state = freshState();
    const before = structuredClone(state.conversations);
    const target = state.conversations[0];

    const next = reducer(state, { type: "resolveConversation", id: target.id });
    const untouched = next.conversations.filter((item) => item.id !== target.id);

    assert.deepEqual(untouched, before.filter((item) => item.id !== target.id));
  });
});

describe("chia lead cho sales", () => {
  it("tạo hồ sơ khách hàng mới từ lead và gắn task đúng người", () => {
    const state = freshState();
    const lead = leads.find((item) => item.status === "moi");
    assert.ok(lead, "cần một lead chờ chia để kiểm tra");
    const customersBefore = state.customers.length;

    const next = reducer(state, { type: "addLeadToTasks", leadId: lead.id, assignee: "Trần Quốc Bảo" });

    const task = next.telesalesTasks[0];
    const owner = next.customers.find((customer) => customer.id === task.customerId);

    assert.equal(next.leads.find((item) => item.id === lead.id)?.status, "da-chia");
    assert.equal(next.leads.find((item) => item.id === lead.id)?.assignedTo, "Trần Quốc Bảo");
    assert.ok(owner, "task phải trỏ tới một hồ sơ khách hàng có thật");
    assert.equal(owner?.name, lead.name, "hồ sơ phải là của chính lead đó, không phải khách bất kỳ");
    assert.equal(owner?.phone, lead.phone);
    assert.equal(next.customers.length, customersBefore + 1, "chưa có hồ sơ thì phải tạo mới");
  });

  it("khớp hồ sơ sẵn có theo số điện thoại thay vì tạo trùng", () => {
    const state = freshState();
    const existing = state.customers[0];
    // Dựng một lead trùng số với khách đã có, không phân biệt dấu cách trong số.
    const duplicated = { ...leads[0], id: "LD-TRUNG-SO", phone: existing.phone, name: existing.name, status: "moi" as const };
    const withLead: AppState = { ...state, leads: [duplicated, ...state.leads] };
    const customersBefore = withLead.customers.length;

    const next = reducer(withLead, { type: "addLeadToTasks", leadId: duplicated.id, assignee: "Lê Minh Sơn" });
    const task = next.telesalesTasks[0];

    assert.equal(task.customerId, existing.id, "phải dùng lại hồ sơ cũ");
    assert.equal(next.customers.length, customersBefore, "không được tạo hồ sơ trùng");
  });

  it("bỏ qua lead không tồn tại mà không làm hỏng state", () => {
    const state = freshState();
    const next = reducer(state, { type: "addLeadToTasks", leadId: "LD-KHONG-CO", assignee: "Ai đó" });

    assert.equal(next, state, "không tìm thấy lead thì trả về nguyên state");
  });
});

describe("kết quả cuộc gọi Callbot", () => {
  const result = (patch: Partial<CallbotResult> = {}): CallbotResult => ({
    id: "CBR-TEST",
    customerId: customers[0].id,
    outcome: "xac-nhan",
    durationSec: 30,
    at: new Date().toISOString(),
    transcript: "Dạ đúng rồi em.",
    sentiment: "tich-cuc",
    ...patch,
  });

  it("cộng đúng số liệu theo kết quả cuộc gọi", () => {
    const state = freshState();
    const before = campaignIn(state, "CB01");

    const next = reducer(state, { type: "recordCallResult", campaignId: "CB01", result: result() });
    const after = campaignIn(next, "CB01");

    assert.equal(after.connected, before.connected + 1);
    assert.equal(after.confirmed, before.confirmed + 1);
    assert.equal(after.rejected, before.rejected, "xác nhận thì không tăng số từ chối");
    assert.equal(after.results[0]?.id, "CBR-TEST", "kết quả mới nhất nằm đầu danh sách");
  });

  it("không tính là đã kết nối khi khách không nghe máy", () => {
    const state = freshState();
    const before = campaignIn(state, "CB01");

    const next = reducer(state, { type: "recordCallResult", campaignId: "CB01", result: result({ outcome: "khong-nghe" }) });
    const after = campaignIn(next, "CB01");

    assert.equal(after.connected, before.connected, "không nghe máy thì chưa kết nối được");
    assert.equal(after.confirmed, before.confirmed);
  });

  it("ghi vào hành trình khách hàng khi quy tắc đồng bộ CRM đang bật", () => {
    const state = freshState();
    const customer = state.customers[0];
    const campaign = campaignIn(state, "CB01");
    assert.equal(campaign.rules.syncToCrm, true, "ca này cần chiến dịch đang bật đồng bộ CRM");
    const eventsBefore = customer.timeline.length;

    const next = reducer(state, { type: "recordCallResult", campaignId: "CB01", result: result() });
    const updated = next.customers.find((item) => item.id === customer.id);

    assert.equal(updated?.timeline.length, eventsBefore + 1);
    assert.match(updated?.timeline[0]?.title ?? "", /Callbot/, "sự kiện phải ghi rõ là do Callbot gọi");
    assert.equal(updated?.timeline[0]?.actor, "Callbot AI");
    assert.equal(updated?.lastContactAt, next.callbotCampaigns[0]?.results[0]?.at, "phải cập nhật tương tác cuối");
  });

  it("không đụng hành trình khách hàng khi quy tắc đồng bộ CRM đã tắt", () => {
    const state = freshState();
    // Chiến dịch khảo sát mẫu cố ý tắt đồng bộ CRM.
    const survey = campaignIn(state, "CB03");
    assert.equal(survey.rules.syncToCrm, false, "ca này cần chiến dịch đang tắt đồng bộ CRM");
    const customer = state.customers.find((item) => item.id === survey.results[0]?.customerId) ?? state.customers[0];
    const eventsBefore = customer.timeline.length;
    const lastContactBefore = customer.lastContactAt;

    const next = reducer(state, {
      type: "recordCallResult",
      campaignId: "CB03",
      result: result({ customerId: customer.id, outcome: "hen-goi-lai" }),
    });
    const updated = next.customers.find((item) => item.id === customer.id);

    assert.equal(updated?.timeline.length, eventsBefore, "tắt đồng bộ thì không được ghi hành trình");
    assert.equal(updated?.lastContactAt, lastContactBefore, "và không được đổi tương tác cuối");
    assert.ok(campaignIn(next, "CB03").results[0], "kết quả vẫn phải lưu vào chiến dịch");
  });

  it("không làm gì khi chiến dịch không tồn tại", () => {
    const state = freshState();
    const next = reducer(state, { type: "recordCallResult", campaignId: "CB-KHONG-CO", result: result() });
    assert.equal(next, state);
  });
});

describe("kịch bản Callbot", () => {
  it("thêm bước vào giữa kịch bản khi chỉ định bước trước đó", () => {
    const state = freshState();
    const campaign = campaignIn(state, "CB01");
    const firstStepId = campaign.script[0].id;
    const before = campaign.script.length;

    const next = reducer(state, { type: "addScriptStep", campaignId: "CB01", afterStepId: firstStepId });
    const after = campaignIn(next, "CB01");

    assert.equal(after.script.length, before + 1);
    assert.equal(after.script[1]?.label, "Bước mới", "bước mới phải nằm ngay sau bước được chỉ định");
  });

  it("thêm bước vào cuối khi không chỉ định vị trí", () => {
    const state = freshState();
    const before = campaignIn(state, "CB01").script.length;

    const next = reducer(state, { type: "addScriptStep", campaignId: "CB01" });
    assert.equal(campaignIn(next, "CB01").script.length, before + 1);
  });

  it("xoá đúng bước được chọn", () => {
    const state = freshState();
    const target = campaignIn(state, "CB01").script[1];
    const before = campaignIn(state, "CB01").script.length;

    const next = reducer(state, { type: "deleteScriptStep", campaignId: "CB01", stepId: target.id });
    const after = campaignIn(next, "CB01");

    assert.equal(after.script.length, before - 1);
    assert.equal(after.script.some((step) => step.id === target.id), false);
  });

  it("đổi thứ tự bước lên và xuống", () => {
    const state = freshState();
    const original = campaignIn(state, "CB01").script;
    const secondId = original[1].id;
    const firstId = original[0].id;

    const movedUp = reducer(state, { type: "moveScriptStep", campaignId: "CB01", stepId: secondId, direction: "up" });
    assert.equal(campaignIn(movedUp, "CB01").script[0].id, secondId, "chuyển lên thì lên đầu");

    const movedDown = reducer(movedUp, { type: "moveScriptStep", campaignId: "CB01", stepId: secondId, direction: "down" });
    assert.equal(campaignIn(movedDown, "CB01").script[0].id, firstId, "chuyển xuống thì trở lại vị trí cũ");
  });

  it("không đổi thứ tự khi đã ở đầu hoặc cuối danh sách", () => {
    const state = freshState();
    const script = campaignIn(state, "CB01").script;

    const upAtTop = reducer(state, { type: "moveScriptStep", campaignId: "CB01", stepId: script[0].id, direction: "up" });
    assert.deepEqual(campaignIn(upAtTop, "CB01").script, script, "ở đầu thì không đổi");

    const downAtBottom = reducer(state, {
      type: "moveScriptStep",
      campaignId: "CB01",
      stepId: script[script.length - 1].id,
      direction: "down",
    });
    assert.deepEqual(campaignIn(downAtBottom, "CB01").script, script, "ở cuối thì không đổi");
  });

  it("sửa nội dung một bước mà không đụng các bước khác", () => {
    const state = freshState();
    const script = campaignIn(state, "CB01").script;
    const target = script[0];
    const othersBefore = script.slice(1);

    const next = reducer(state, {
      type: "updateScriptStep",
      campaignId: "CB01",
      stepId: target.id,
      patch: { say: "Lời thoại đã sửa" },
    });
    const after = campaignIn(next, "CB01").script;

    assert.equal(after[0].say, "Lời thoại đã sửa");
    assert.deepEqual(after.slice(1), othersBefore);
  });
});

describe("quản lý chiến dịch Callbot", () => {
  it("nhân bản tạo bản sao ở dạng nháp và không mang theo kết quả cũ", () => {
    const state = freshState();
    const source = campaignIn(state, "CB01");
    const before = state.callbotCampaigns.length;

    const next = reducer(state, { type: "duplicateCampaign", id: "CB01" });
    const copy = next.callbotCampaigns[0];

    assert.equal(next.callbotCampaigns.length, before + 1);
    assert.equal(copy.status, "nhap");
    assert.equal(copy.connected, 0, "bản sao phải bắt đầu lại từ đầu");
    assert.equal(copy.confirmed, 0);
    assert.deepEqual(copy.results, []);
    assert.equal(copy.script.length, source.script.length, "kịch bản được giữ nguyên");
    assert.match(copy.name, /bản sao/);
  });

  it("bản sao có mã bước riêng, không dùng chung với chiến dịch gốc", () => {
    const state = freshState();
    const sourceIds = campaignIn(state, "CB01").script.map((step) => step.id);

    const next = reducer(state, { type: "duplicateCampaign", id: "CB01" });
    const copyIds = next.callbotCampaigns[0].script.map((step) => step.id);

    assert.equal(copyIds.some((id) => sourceIds.includes(id)), false, "trùng mã bước sẽ làm sửa bên này ảnh hưởng bên kia");
  });

  it("đổi giọng đọc của đúng chiến dịch", () => {
    const state = freshState();
    // So với chính giá trị trước đó của chiến dịch kia, để không phụ thuộc việc
    // giọng mới có tình cờ trùng giọng sẵn có của nó hay không.
    const otherVoiceBefore = campaignIn(state, "CB02").voice;
    const newVoice = otherVoiceBefore === "Giọng nam miền Nam - Minh Khang" ? "Giọng nữ miền Nam - Thuỳ Dương" : "Giọng nam miền Nam - Minh Khang";

    const next = reducer(state, { type: "updateCampaignVoice", id: "CB01", voice: newVoice });

    assert.equal(campaignIn(next, "CB01").voice, newVoice);
    assert.equal(campaignIn(next, "CB02").voice, otherVoiceBefore, "chiến dịch khác không được đổi theo");
  });

  it("đảo trạng thái chạy và tạm dừng", () => {
    const state = freshState();
    assert.equal(campaignIn(state, "CB01").status, "dang-chay");

    const paused = reducer(state, { type: "toggleCampaign", id: "CB01" });
    assert.equal(campaignIn(paused, "CB01").status, "tam-dung");

    const resumed = reducer(paused, { type: "toggleCampaign", id: "CB01" });
    assert.equal(campaignIn(resumed, "CB01").status, "dang-chay");
  });

  it("cập nhật cấu hình mà không đụng trường khác", () => {
    const state = freshState();
    const before = campaignIn(state, "CB01");

    const next = reducer(state, { type: "updateCampaignConfig", id: "CB01", patch: { concurrency: 45 } });
    const after = campaignIn(next, "CB01");

    assert.equal(after.concurrency, 45);
    assert.equal(after.windowStart, before.windowStart);
    assert.equal(after.script.length, before.script.length);
  });

  it("đảo từng quy tắc vận hành độc lập với nhau", () => {
    const state = freshState();
    const before = campaignIn(state, "CB01").rules;

    const next = reducer(state, { type: "toggleCampaignRule", id: "CB01", rule: "syncToCrm" });
    const after = campaignIn(next, "CB01").rules;

    assert.equal(after.syncToCrm, !before.syncToCrm);
    assert.equal(after.quietHours, before.quietHours, "chỉ được đổi đúng quy tắc được chọn");
    assert.equal(after.escalateNegative, before.escalateNegative);
  });

  it("chiến dịch tạo mới bật quy tắc an toàn nhưng không tự ghi vào CRM", () => {
    const state = freshState();
    const before = state.callbotCampaigns.length;

    const next = reducer(state, {
      type: "createCampaign",
      draft: {
        name: "Chiến dịch kiểm tra",
        goal: "xac-nhan-don",
        voice: "Giọng nữ miền Bắc - Linh An",
        total: 500,
        windowStart: "08:00",
        windowEnd: "17:00",
        concurrency: 10,
        retry: 1,
      },
    });
    const created = next.callbotCampaigns[0];

    assert.equal(next.callbotCampaigns.length, before + 1);
    assert.equal(created.name, "Chiến dịch kiểm tra");
    assert.equal(created.status, "nhap");
    assert.equal(created.total, 500);
    assert.equal(created.rules.quietHours, true);
    assert.equal(created.rules.autoStopOptOut, true);
    assert.equal(created.rules.syncToCrm, false, "ghi vào hồ sơ khách hàng phải do người dùng chủ động bật");
    assert.ok(created.script.length > 0, "lấy kịch bản mẫu theo mục tiêu");
  });
});

describe("cuộc gọi tổng đài", () => {
  it("cập nhật trạng thái cuộc gọi theo mã", () => {
    const state = freshState();
    const target = state.calls.find((call) => call.status === "talking");
    assert.ok(target, "cần một cuộc gọi đang đàm thoại để kiểm tra");

    const next = reducer(state, { type: "updateCall", id: target.id, patch: { status: "completed" } });
    assert.equal(next.calls.find((call) => call.id === target.id)?.status, "completed");
  });
});

describe("việc telesales", () => {
  it("ghi nhận kết quả và đánh dấu hoàn thành", () => {
    const state = freshState();
    const task = state.telesalesTasks.find((item) => !item.done);
    assert.ok(task, "cần một việc chưa làm để kiểm tra");

    const next = reducer(state, { type: "completeTask", id: task.id, outcome: "chot-don" });
    const updated = next.telesalesTasks.find((item) => item.id === task.id);

    assert.equal(updated?.done, true);
    assert.equal(updated?.outcome, "chot-don");
    assert.equal(updated?.lastResult, "Đã chốt đơn");
  });

  it("dời lịch gọi lại thì tăng số lần gọi", () => {
    const state = freshState();
    const task = state.telesalesTasks.find((item) => !item.done);
    assert.ok(task);
    const attemptsBefore = task.attempts;

    const next = reducer(state, { type: "snoozeTask", id: task.id });
    const updated = next.telesalesTasks.find((item) => item.id === task.id);

    assert.equal(updated?.attempts, attemptsBefore + 1);
    assert.match(updated?.lastResult ?? "", /Hẹn gọi lại/);
  });
});

describe("thông báo", () => {
  it("chỉ giữ tối đa ba thông báo gần nhất", () => {
    let state = freshState();
    for (const message of ["một", "hai", "ba", "bốn", "năm"]) {
      state = reducer(state, { type: "toast", message });
    }

    assert.ok(state.toasts.length <= 3, `chỉ nên giữ vài thông báo, đang có ${state.toasts.length}`);
    assert.equal(state.toasts[state.toasts.length - 1]?.message, "năm");
  });

  it("xoá thông báo theo mã", () => {
    let state = reducer(freshState(), { type: "toast", message: "tạm" });
    const id = state.toasts[0].id;

    state = reducer(state, { type: "dismissToast", id });
    assert.equal(state.toasts.some((item) => item.id === id), false);
  });
});

describe("tính bất biến của state", () => {
  it("không sửa trực tiếp state đầu vào", () => {
    const state = freshState();
    const snapshot = structuredClone(state);

    reducer(state, { type: "resolveConversation", id: state.conversations[0].id });
    reducer(state, { type: "toggleCampaign", id: "CB01" });
    reducer(state, { type: "duplicateCampaign", id: "CB01" });
    reducer(state, { type: "discardLead", leadId: leads[0].id });

    assert.deepEqual(state, snapshot, "reducer phải trả về state mới, không sửa state cũ");
  });

  it("trả về state mới thay vì chính đối tượng cũ khi có thay đổi", () => {
    const state = freshState();
    const next = reducer(state, { type: "toggleCampaign", id: "CB01" });
    assert.notEqual(next, state);
  });

  it("bộ dữ liệu mẫu có đúng các ca đối chứng mà test dựa vào", () => {
    assert.equal(callbotCampaigns.find((c) => c.id === "CB01")?.rules.syncToCrm, true);
    assert.equal(callbotCampaigns.find((c) => c.id === "CB03")?.rules.syncToCrm, false);
    assert.ok(leads.some((lead) => lead.status === "moi"), "cần lead chờ chia");
  });
});
