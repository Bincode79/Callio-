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

  it("gọi ra tạo cuộc gọi mới đang đàm thoại cho đúng khách", () => {
    const state = freshState();
    const customer = state.customers[0];
    const before = state.calls.length;

    const next = reducer(state, { type: "createCall", customerId: customer.id, queue: "Kinh doanh - Miền Bắc" });
    const created = next.calls[0];

    assert.equal(next.calls.length, before + 1);
    assert.equal(created.customerId, customer.id);
    assert.equal(created.direction, "outbound");
    assert.equal(created.status, "talking", "cuộc gọi ra vừa tạo phải đang đàm thoại");
    assert.equal(created.agent, state.currentUser.name);
    assert.equal(created.queue, "Kinh doanh - Miền Bắc");
    assert.equal(created.durationSec, 0);
  });

  it("không tạo cuộc gọi cho khách không tồn tại", () => {
    const state = freshState();
    const next = reducer(state, { type: "createCall", customerId: "KH-KHONG-CO", queue: "Hàng đợi" });
    assert.equal(next, state);
  });

  it("chuyển máy đổi hàng đợi của đúng cuộc gọi", () => {
    const state = freshState();
    const target = state.calls[0];
    const otherQueueBefore = state.calls[1]?.queue;

    const next = reducer(state, { type: "transferCall", id: target.id, queue: "CSKH - Miền Nam" });
    assert.equal(next.calls.find((call) => call.id === target.id)?.queue, "CSKH - Miền Nam");
    assert.equal(next.calls.find((call) => call.id === state.calls[1].id)?.queue, otherQueueBefore, "cuộc gọi khác không đổi");
  });

  it("lưu ghi chú thì ghi vào hành trình khách hàng", () => {
    const state = freshState();
    const target = state.calls[0];
    const customer = state.customers.find((item) => item.id === target.customerId);
    assert.ok(customer, "cuộc gọi phải trỏ tới một khách hàng có thật");
    const eventsBefore = customer.timeline.length;

    const next = reducer(state, { type: "saveCallNote", id: target.id, note: "Khách quan tâm gói Growth" });
    const updatedCall = next.calls.find((call) => call.id === target.id);
    const updatedCustomer = next.customers.find((item) => item.id === target.customerId);

    assert.equal(updatedCall?.note, "Khách quan tâm gói Growth");
    assert.equal(updatedCustomer?.timeline.length, eventsBefore + 1, "ghi chú phải vào hành trình khách hàng");
    assert.equal(updatedCustomer?.timeline[0]?.detail, "Khách quan tâm gói Growth");
    assert.equal(updatedCustomer?.timeline[0]?.channel, "call");
  });

  it("không ghi gì khi cuộc gọi không tồn tại", () => {
    const state = freshState();
    const next = reducer(state, { type: "saveCallNote", id: "CALL-KHONG-CO", note: "x" });
    assert.equal(next, state);
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

  it("gửi báo giá ghi vào hành trình khách hàng", () => {
    const state = freshState();
    const task = state.telesalesTasks[0];
    const customer = state.customers.find((item) => item.id === task.customerId);
    assert.ok(customer, "task phải trỏ tới khách hàng có thật");
    const eventsBefore = customer.timeline.length;

    const next = reducer(state, { type: "sendQuote", taskId: task.id });
    const updatedCustomer = next.customers.find((item) => item.id === task.customerId);

    assert.match(next.telesalesTasks.find((item) => item.id === task.id)?.lastResult ?? "", /báo giá/);
    assert.equal(updatedCustomer?.timeline.length, eventsBefore + 1);
    assert.equal(updatedCustomer?.timeline[0]?.title, "Đã gửi báo giá");
  });

  it("đặt lịch demo ghi vào hành trình khách hàng", () => {
    const state = freshState();
    const task = state.telesalesTasks[0];
    const customer = state.customers.find((item) => item.id === task.customerId);
    assert.ok(customer);
    const eventsBefore = customer.timeline.length;

    const next = reducer(state, { type: "scheduleDemo", taskId: task.id });
    const updatedCustomer = next.customers.find((item) => item.id === task.customerId);

    assert.equal(updatedCustomer?.timeline.length, eventsBefore + 1);
    assert.equal(updatedCustomer?.timeline[0]?.title, "Đã đặt lịch hẹn demo");
  });

  it("không ghi gì khi task không tồn tại", () => {
    const state = freshState();
    assert.equal(reducer(state, { type: "sendQuote", taskId: "TS-KHONG-CO" }), state);
    assert.equal(reducer(state, { type: "scheduleDemo", taskId: "TS-KHONG-CO" }), state);
  });
});

describe("workflow", () => {
  it("sửa bước thì chỉ đụng đúng bước được chọn", () => {
    const state = freshState();
    const workflow = state.workflows[0];
    const node = workflow.nodes[0];
    const otherNodesBefore = workflow.nodes.slice(1);

    const next = reducer(state, {
      type: "updateWorkflowNode",
      workflowId: workflow.id,
      nodeId: node.id,
      patch: { title: "Bước đã sửa", detail: "Mô tả mới" },
    });
    const updated = next.workflows.find((item) => item.id === workflow.id);

    assert.equal(updated?.nodes[0]?.title, "Bước đã sửa");
    assert.equal(updated?.nodes[0]?.detail, "Mô tả mới");
    assert.deepEqual(updated?.nodes.slice(1), otherNodesBefore);
  });

  it("tạo workflow mới ở dạng bản nháp, chèn lên đầu", () => {
    const state = freshState();
    const before = state.workflows.length;

    const next = reducer(state, { type: "createWorkflow", draft: { name: "Workflow kiểm thử", trigger: "Lead mới từ Ads" } });
    const created = next.workflows[0];

    assert.equal(next.workflows.length, before + 1);
    assert.equal(created.name, "Workflow kiểm thử");
    assert.equal(created.status, "ban-nhap");
    assert.equal(created.runsToday, 0);
    assert.equal(created.nodes.length, 1, "workflow mới chỉ có bước kích hoạt");
    assert.deepEqual(created.runs, []);
  });

  it("chạy thử workflow đang hoạt động thì ghi thêm một lượt chạy", () => {
    const state = freshState();
    const workflow = state.workflows.find((item) => item.status === "dang-chay");
    assert.ok(workflow, "cần một workflow đang chạy");
    const runsBefore = workflow.runs.length;

    const next = reducer(state, { type: "runWorkflow", id: workflow.id });
    const updated = next.workflows.find((item) => item.id === workflow.id);

    assert.equal(updated?.runs.length, runsBefore + 1);
    assert.equal(updated?.runsToday, workflow.runsToday + 1);
    assert.equal(updated?.runs[0]?.ok, true);
  });

  it("không chạy thử workflow đang tạm dừng hoặc bản nháp", () => {
    const state = freshState();
    const paused = state.workflows.find((item) => item.status === "tam-dung") ?? state.workflows.find((item) => item.status === "ban-nhap");
    assert.ok(paused, "cần một workflow không hoạt động");

    const next = reducer(state, { type: "runWorkflow", id: paused.id });
    assert.equal(next.workflows.find((item) => item.id === paused.id)?.runsToday, paused.runsToday, "không được tăng lượt chạy");
    assert.equal(next.workflows.find((item) => item.id === paused.id)?.runs.length, paused.runs.length);
  });

  it("không làm gì khi chạy workflow không tồn tại", () => {
    const state = freshState();
    assert.equal(reducer(state, { type: "runWorkflow", id: "WF-KHONG-CO" }), state);
  });
});

describe("tệp lead", () => {
  it("đồng bộ chuyển lead chờ phân loại sang đã phân loại", () => {
    const state = freshState();
    const pendingBefore = state.leads.filter((lead) => lead.status === "moi").length;
    assert.ok(pendingBefore > 0, "cần lead chờ phân loại để kiểm tra");

    const next = reducer(state, { type: "syncLeads" });
    assert.equal(next.leads.filter((lead) => lead.status === "moi").length, 0, "không còn lead chờ phân loại");
    assert.equal(next.leads.filter((lead) => lead.status === "da-phan-loai").length, pendingBefore + state.leads.filter((lead) => lead.status === "da-phan-loai").length);
  });

  it("đồng bộ không kéo lead đã chia hoặc đã loại trở lại", () => {
    const state = freshState();
    const assigned = state.leads.find((lead) => lead.status === "da-chia");
    const discarded = state.leads.find((lead) => lead.status === "loai");

    const next = reducer(state, { type: "syncLeads" });
    if (assigned) assert.equal(next.leads.find((lead) => lead.id === assigned.id)?.status, "da-chia");
    if (discarded) assert.equal(next.leads.find((lead) => lead.id === discarded.id)?.status, "loai");
  });

  it("gộp lead trùng và bỏ cờ trùng", () => {
    const state = freshState();
    const duplicatesBefore = state.leads.filter((lead) => lead.duplicate).length;
    assert.ok(duplicatesBefore > 0, "cần lead trùng để kiểm tra");

    const next = reducer(state, { type: "mergeDuplicateLeads" });
    assert.equal(next.leads.filter((lead) => lead.duplicate).length, 0, "sau khi gộp không còn cờ trùng");
  });

  it("báo rõ khi không có lead trùng để gộp", () => {
    const state = freshState();
    const noDuplicates: AppState = { ...state, leads: state.leads.map((lead) => ({ ...lead, duplicate: false })) };
    const next = reducer(noDuplicates, { type: "mergeDuplicateLeads" });
    assert.deepEqual(next.leads, noDuplicates.leads, "không có gì để gộp thì giữ nguyên tệp");
  });
});

describe("hồ sơ khách hàng", () => {
  const draft = {
    name: "Đặng Văn Mới",
    company: "Công ty TNHH Thử Nghiệm",
    phone: "0988111222",
    email: "moi@thunghiem.vn",
    address: "Đà Nẵng",
    source: "website" as const,
    note: "Cần tư vấn gói tổng đài.",
  };

  it("tạo hồ sơ mới với mã riêng và gắn vào hành trình", () => {
    const state = freshState();
    const before = state.customers.length;

    const next = reducer(state, { type: "createCustomer", draft });
    const created = next.customers[0];

    assert.equal(next.customers.length, before + 1);
    assert.equal(created.name, draft.name);
    assert.equal(created.phone, draft.phone);
    assert.equal(created.source, "website");
    assert.equal(created.status, "lead");
    assert.equal(created.owner, state.currentUser.name, "hồ sơ tạo thủ công thuộc về người đang đăng nhập");
    assert.ok(created.timeline.some((event) => event.title === "Tạo hồ sơ khách hàng"), "phải ghi lại sự kiện tạo hồ sơ");
    assert.equal(created.totalValue, 0, "hồ sơ mới chưa có giá trị pipeline");
  });

  it("không cấp mã trùng với khách hàng sẵn có", () => {
    const state = freshState();
    const existingCodes = new Set(state.customers.map((customer) => customer.code));

    const next = reducer(state, { type: "createCustomer", draft });
    assert.equal(existingCodes.has(next.customers[0].code), false, "mã khách hàng phải là duy nhất");
  });
});

describe("chiến dịch nhắn tin", () => {
  const draft = {
    name: "Chăm sóc khách hàng tháng 10",
    channel: "zalo" as const,
    brandname: "Callio OA",
    audience: "Khách hàng đang giao dịch",
    body: "Dạ Callio xin chào anh/chị {ten_khach}.",
    scheduledAt: "2026-10-01T09:00",
  };

  it("tạo chiến dịch ở dạng nháp thì chưa gửi tin nào", () => {
    const state = freshState();
    const before = state.messagingCampaigns.length;

    const next = reducer(state, { type: "createMessagingCampaign", draft: { ...draft, start: false } });
    const created = next.messagingCampaigns[0];

    assert.equal(next.messagingCampaigns.length, before + 1);
    assert.equal(created.name, draft.name);
    assert.equal(created.channel, "zalo");
    assert.equal(created.brandname, "Callio OA");
    assert.equal(created.status, "nhap", "lưu nháp thì không chạy");
    assert.equal(created.sent, 0, "chiến dịch mới chưa gửi tin nào");
    assert.deepEqual(next.messagingCampaigns[0].opened, 0);
  });

  it("lên lịch gửi thì chiến dịch chạy ngay", () => {
    const state = freshState();

    const next = reducer(state, { type: "createMessagingCampaign", draft: { ...draft, start: true } });
    assert.equal(next.messagingCampaigns[0].status, "dang-chay");
  });

  it("lưu nội dung soạn tay thành mẫu tin dùng lại", () => {
    const state = freshState();
    const templatesBefore = state.templates.length;

    const next = reducer(state, { type: "createMessagingCampaign", draft: { ...draft, start: false } });
    const created = next.messagingCampaigns[0];

    assert.equal(next.templates.length, templatesBefore + 1, "nội dung soạn tay phải thành mẫu tin");
    assert.equal(next.templates[0].body, draft.body);
    assert.equal(created.templateId, next.templates[0].id, "chiến dịch phải trỏ tới mẫu vừa tạo");
  });

  it("nhân bản chiến dịch tạo bản nháp không mang theo số liệu cũ", () => {
    const state = freshState();
    const source = state.messagingCampaigns.find((item) => item.sent > 0);
    assert.ok(source, "cần một chiến dịch đã gửi tin để kiểm tra");
    const before = state.messagingCampaigns.length;

    const next = reducer(state, { type: "duplicateMessagingCampaign", id: source.id });
    const copy = next.messagingCampaigns[0];

    assert.equal(next.messagingCampaigns.length, before + 1);
    assert.equal(copy.status, "nhap");
    assert.equal(copy.sent, 0, "bản sao chưa gửi");
    assert.equal(copy.delivered, 0);
    assert.equal(copy.replied, 0);
    assert.equal(copy.audience, source.audience, "giữ nguyên tệp khách hàng");
    assert.match(copy.name, /bản sao/);
  });

  it("không làm gì khi nhân bản chiến dịch không tồn tại", () => {
    const state = freshState();
    const next = reducer(state, { type: "duplicateMessagingCampaign", id: "MC-KHONG-CO" });
    assert.equal(next, state);
  });

  it("sửa mẫu tin thì chỉ đụng mẫu được chọn", () => {
    const state = freshState();
    const target = state.templates[0];
    const othersBefore = state.templates.slice(1);

    const next = reducer(state, {
      type: "updateTemplate",
      id: target.id,
      patch: { body: "Nội dung đã sửa", category: "marketing" },
    });
    const updated = next.templates.find((item) => item.id === target.id);

    assert.equal(updated?.body, "Nội dung đã sửa");
    assert.equal(updated?.category, "marketing");
    assert.deepEqual(next.templates.slice(1), othersBefore);
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
    reducer(state, {
      type: "createMessagingCampaign",
      draft: { name: "Kiểm tra bất biến", channel: "sms", brandname: "CALLIO", audience: "Tệp", body: "Nội dung", scheduledAt: "2026-10-01T09:00", start: true },
    });
    reducer(state, {
      type: "createCustomer",
      draft: { name: "Bất biến", company: "Cty", phone: "0900000000", email: "a@b.vn", address: "HN", source: "website", note: "x" },
    });
    reducer(state, { type: "createCall", customerId: state.customers[0].id, queue: "Hàng đợi" });
    reducer(state, { type: "saveCallNote", id: state.calls[0].id, note: "ghi chú" });
    reducer(state, { type: "sendQuote", taskId: state.telesalesTasks[0].id });
    reducer(state, { type: "runWorkflow", id: state.workflows[0].id });
    reducer(state, { type: "syncLeads" });
    reducer(state, { type: "mergeDuplicateLeads" });

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
