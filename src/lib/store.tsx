import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import {
  agents,
  calls,
  callbotCampaigns,
  conversations,
  customers,
  leads,
  messageTemplates,
  messagingCampaigns,
  telesalesTasks,
  workflows,
} from "./data";
import { digitsOnly, formatDuration, leadSourceMeta } from "./format";
import type {
  CallRecord,
  CallbotCampaign,
  CallbotResult,
  CallbotRules,
  CallbotScriptStep,
  Channel,
  Conversation,
  Customer,
  Lead,
  LeadSource,
  MessageTemplate,
  MessagingCampaign,
  TelesalesTask,
  Workflow,
  WorkflowNode,
} from "./types";

export interface AppState {
  customers: Customer[];
  conversations: Conversation[];
  calls: CallRecord[];
  callbotCampaigns: CallbotCampaign[];
  telesalesTasks: TelesalesTask[];
  templates: MessageTemplate[];
  messagingCampaigns: MessagingCampaign[];
  leads: Lead[];
  workflows: Workflow[];
  agents: typeof agents;
  currentUser: { name: string; role: string; team: string };
  toasts: Array<{ id: number; message: string; tone: "success" | "info" | "warn" }>;
}

export type Action =
  | { type: "assignConversation"; id: string; assignee: string }
  | { type: "resolveConversation"; id: string }
  | { type: "replyConversation"; id: string; body: string }
  | { type: "updateCall"; id: string; patch: Partial<CallRecord> }
  | { type: "createCall"; customerId: string; queue: string }
  | { type: "transferCall"; id: string; queue: string }
  | { type: "saveCallNote"; id: string; note: string }
  | { type: "completeTask"; id: string; outcome: NonNullable<TelesalesTask["outcome"]> }
  | { type: "snoozeTask"; id: string }
  | { type: "sendQuote"; taskId: string }
  | { type: "scheduleDemo"; taskId: string }
  | { type: "updateWorkflowNode"; workflowId: string; nodeId: string; patch: Partial<Pick<WorkflowNode, "title" | "detail">> }
  | { type: "createWorkflow"; draft: { name: string; trigger: string } }
  | { type: "runWorkflow"; id: string }
  | { type: "addLeadToTasks"; leadId: string; assignee: string }
  | { type: "syncLeads" }
  | { type: "mergeDuplicateLeads" }
  | {
      type: "createCustomer";
      draft: { name: string; company: string; phone: string; email: string; address: string; source: LeadSource; note: string };
    }
  | { type: "discardLead"; leadId: string }
  | { type: "toggleWorkflow"; id: string }
  | { type: "toggleCampaign"; id: string }
  | { type: "duplicateCampaign"; id: string }
  | { type: "createCampaign"; draft: { name: string; goal: CallbotCampaign["goal"]; voice: string; total: number; windowStart: string; windowEnd: string; concurrency: number; retry: number } }
  | { type: "updateCampaignVoice"; id: string; voice: string }
  | { type: "updateScriptStep"; campaignId: string; stepId: string; patch: Partial<CallbotScriptStep> }
  | { type: "addScriptStep"; campaignId: string; afterStepId?: string }
  | { type: "deleteScriptStep"; campaignId: string; stepId: string }
  | { type: "moveScriptStep"; campaignId: string; stepId: string; direction: "up" | "down" }
  | { type: "recordCallResult"; campaignId: string; result: CallbotResult }
  | { type: "updateCampaignConfig"; id: string; patch: Partial<Pick<CallbotCampaign, "windowStart" | "windowEnd" | "concurrency" | "retry" | "total">> }
  | { type: "toggleCampaignRule"; id: string; rule: keyof CallbotRules }
  | { type: "toggleMessagingCampaign"; id: string }
  | {
      type: "createMessagingCampaign";
      draft: {
        name: string;
        channel: Channel;
        brandname: string;
        audience: string;
        body: string;
        scheduledAt: string;
        /** Gửi ngay (đang chạy) hay chỉ lưu ở dạng bản nháp. */
        start: boolean;
      };
    }
  | { type: "duplicateMessagingCampaign"; id: string }
  | { type: "updateTemplate"; id: string; patch: Partial<Pick<MessageTemplate, "name" | "body" | "category">> }
  | { type: "toast"; message: string; tone?: "success" | "info" | "warn" }
  | { type: "dismissToast"; id: number };

/**
 * State khởi tạo, dùng chung cho `AppProvider` và cho test reducer.
 *
 * Export để test có thể dựng lại state sạch: bộ test phải chạy được nhiều lần
 * mà không bị ảnh hưởng lẫn nhau.
 */
export const initialState: AppState = {
  customers,
  conversations,
  calls,
  callbotCampaigns,
  telesalesTasks,
  templates: messageTemplates,
  messagingCampaigns,
  leads,
  workflows,
  agents,
  currentUser: { name: "Nguyễn Thị Hồng Nhung", role: "Quản lý vận hành", team: "Khối Kinh doanh & CSKH" },
  toasts: [],
};

let toastId = 1;

function nextToast(state: AppState, message: string, tone: "success" | "info" | "warn"): AppState {
  const id = toastId++;
  return { ...state, toasts: [...state.toasts.slice(-2), { id, message, tone }] };
}

/**
 * Reducer thuần, export để test gọi trực tiếp mà không cần render React.
 */
export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "assignConversation": {
      const conversations = state.conversations.map((item) =>
        item.id === action.id ? { ...item, assignee: action.assignee, status: "dang-mo" as const, unread: 0 } : item,
      );
      return nextToast({ ...state, conversations }, `Đã phân công hội thoại cho ${action.assignee}`, "success");
    }
    case "resolveConversation": {
      const conversations = state.conversations.map((item) =>
        item.id === action.id ? { ...item, status: "da-xu-ly" as const, unread: 0 } : item,
      );
      return nextToast({ ...state, conversations }, "Đã đóng hội thoại và ghi log vào hành trình khách hàng", "success");
    }
    case "replyConversation": {
      const conversations = state.conversations.map((item) =>
        item.id === action.id
          ? {
              ...item,
              unread: 0,
              status: "cho-khach" as const,
              updatedAt: new Date().toISOString(),
              messages: [
                ...item.messages,
                {
                  id: `MSG-LOCAL-${item.messages.length + 1}`,
                  direction: "out" as const,
                  body: action.body,
                  at: new Date().toISOString(),
                  sender: state.currentUser.name,
                },
              ],
            }
          : item,
      );
      return nextToast({ ...state, conversations }, "Đã gửi phản hồi tới khách hàng", "success");
    }
    case "updateCall": {
      const calls = state.calls.map((item) => (item.id === action.id ? { ...item, ...action.patch } : item));
      return { ...state, calls };
    }
    case "createCall": {
      const customer = state.customers.find((item) => item.id === action.customerId);
      if (!customer) return state;
      // Cuộc gọi ra mới: đang đàm thoại, chưa có thời lượng, gắn người đang trực.
      const call: CallRecord = {
        id: `CALL-${Date.now()}`,
        customerId: customer.id,
        direction: "outbound",
        status: "talking",
        agent: state.currentUser.name,
        queue: action.queue,
        startedAt: new Date().toISOString(),
        durationSec: 0,
        waitSec: 0,
        recording: true,
        sentiment: "trung-tinh",
        note: "Cuộc gọi ra do người dùng khởi tạo",
      };
      return nextToast({ ...state, calls: [call, ...state.calls] }, `Đã kết nối cuộc gọi ra tới ${customer.name}`, "info");
    }
    case "transferCall": {
      const calls = state.calls.map((item) => (item.id === action.id ? { ...item, queue: action.queue } : item));
      return nextToast({ ...state, calls }, `Đã chuyển cuộc gọi tới hàng đợi ${action.queue}`, "info");
    }
    case "saveCallNote": {
      const target = state.calls.find((item) => item.id === action.id);
      if (!target) return state;
      const calls = state.calls.map((item) => (item.id === action.id ? { ...item, note: action.note } : item));
      // Ghi chú cuộc gọi thuộc về hồ sơ khách hàng, nên cần vào hành trình để
      // lần sau mở hồ sơ vẫn thấy, không chỉ nằm ở nhật ký tổng đài.
      const customers = state.customers.map((customer) =>
        customer.id !== target.customerId
          ? customer
          : {
              ...customer,
              lastContactAt: new Date().toISOString(),
              timeline: [
                {
                  id: `ev-callnote-${target.id}-${Date.now()}`,
                  channel: "call" as const,
                  title: "Ghi chú cuộc gọi",
                  detail: action.note,
                  at: new Date().toISOString(),
                  actor: state.currentUser.name,
                  direction: "out" as const,
                },
                ...customer.timeline,
              ],
            },
      );
      return nextToast({ ...state, calls, customers }, "Đã lưu ghi chú vào hành trình khách hàng", "success");
    }
    case "completeTask": {
      const telesalesTasks = state.telesalesTasks.map((item) =>
        item.id === action.id ? { ...item, done: true, outcome: action.outcome, lastResult: outcomeLabel(action.outcome) } : item,
      );
      return nextToast({ ...state, telesalesTasks }, `Đã ghi nhận kết quả: ${outcomeLabel(action.outcome)}`, "success");
    }
    case "snoozeTask": {
      const telesalesTasks = state.telesalesTasks.map((item) =>
        item.id === action.id
          ? { ...item, dueAt: new Date(Date.now() + 2 * 3600 * 1000).toISOString(), attempts: item.attempts + 1, lastResult: "Hẹn gọi lại sau 2 giờ" }
          : item,
      );
      return nextToast({ ...state, telesalesTasks }, "Đã dời lịch gọi lại sau 2 giờ", "info");
    }
    case "sendQuote": {
      const target = state.telesalesTasks.find((item) => item.id === action.taskId);
      if (!target) return state;
      const telesalesTasks = state.telesalesTasks.map((item) =>
        item.id === action.taskId ? { ...item, lastResult: "Đã gửi báo giá qua Zalo" } : item,
      );
      // Gửi báo giá là một tương tác thật, phải vào hành trình khách hàng để ACRM
      // nhìn thấy chứ không chỉ đổi nhãn trên task.
      const now = new Date().toISOString();
      const customers = state.customers.map((customer) =>
        customer.id !== target.customerId
          ? customer
          : {
              ...customer,
              lastContactAt: now,
              timeline: [
                {
                  id: `ev-quote-${target.id}-${Date.now()}`,
                  channel: "zalo" as const,
                  title: "Đã gửi báo giá",
                  detail: "Báo giá được gửi qua Zalo OA sau cuộc gọi telesales.",
                  at: now,
                  actor: state.currentUser.name,
                  direction: "out" as const,
                },
                ...customer.timeline,
              ],
            },
      );
      return nextToast({ ...state, telesalesTasks, customers }, "Đã gửi báo giá qua Zalo và ghi vào hành trình", "success");
    }
    case "scheduleDemo": {
      const target = state.telesalesTasks.find((item) => item.id === action.taskId);
      if (!target) return state;
      const now = new Date().toISOString();
      const telesalesTasks = state.telesalesTasks.map((item) =>
        item.id === action.taskId ? { ...item, lastResult: "Đã đặt lịch hẹn demo" } : item,
      );
      const customers = state.customers.map((customer) =>
        customer.id !== target.customerId
          ? customer
          : {
              ...customer,
              lastContactAt: now,
              timeline: [
                {
                  id: `ev-demo-${target.id}-${Date.now()}`,
                  channel: "call" as const,
                  title: "Đã đặt lịch hẹn demo",
                  detail: "Lịch hẹn demo được tạo từ cuộc gọi telesales.",
                  at: now,
                  actor: state.currentUser.name,
                  direction: "out" as const,
                },
                ...customer.timeline,
              ],
            },
      );
      return nextToast({ ...state, telesalesTasks, customers }, "Đã tạo lịch hẹn demo cho khách hàng", "success");
    }
    case "addLeadToTasks": {
      const lead = state.leads.find((item) => item.id === action.leadId);
      if (!lead) return state;

      const leads = state.leads.map((item) =>
        item.id === action.leadId ? { ...item, status: "da-chia" as const, assignedTo: action.assignee } : item,
      );

      // Lead có thể chưa tồn tại trong ACRM. Khớp theo số điện thoại trước,
      // nếu không có thì tạo hồ sơ khách hàng mới từ dữ liệu lead.
      const phoneKey = digitsOnly(lead.phone);
      const existing = state.customers.find((customer) => digitsOnly(customer.phone) === phoneKey);
      const customer = existing ?? customerFromLead(lead, action.assignee, nextCustomerCode(state.customers));

      const newTask: TelesalesTask = {
        id: `TS-${900 + state.telesalesTasks.length}`,
        customerId: customer.id,
        listName: `Ulead - ${lead.campaign}`,
        priority: lead.score >= 70 ? "cao" : "trung-binh",
        attempts: 0,
        lastResult: "Chưa liên hệ",
        dueAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        script: "Xác nhận nhu cầu → gửi báo giá → hẹn demo",
        done: false,
      };

      return nextToast(
        {
          ...state,
          leads,
          customers: existing ? state.customers : [...state.customers, customer],
          telesalesTasks: [newTask, ...state.telesalesTasks],
        },
        existing
          ? `Đã chia lead ${lead.name} cho ${action.assignee} (khớp hồ sơ ${customer.code})`
          : `Đã tạo hồ sơ ${customer.code} từ lead và chia cho ${action.assignee}`,
        "success",
      );
    }
    case "createCustomer": {
      const { draft } = action;
      const now = new Date().toISOString();
      const customer: Customer = {
        id: `KH-LOCAL-${Date.now()}`,
        code: nextCustomerCode(state.customers),
        name: draft.name,
        company: draft.company || "Chưa cập nhật",
        phone: draft.phone,
        email: draft.email,
        address: draft.address || "Chưa cập nhật",
        status: "lead",
        source: draft.source,
        owner: state.currentUser.name,
        tags: ["Tạo thủ công"],
        createdAt: now,
        lastContactAt: now,
        score: 50,
        totalValue: 0,
        dealCount: 0,
        note: draft.note || "Chưa có ghi chú.",
        timeline: [
          {
            id: `ev-${Date.now()}`,
            channel: "note",
            title: "Tạo hồ sơ khách hàng",
            detail: `Hồ sơ được tạo thủ công bởi ${state.currentUser.name}.`,
            at: now,
            actor: state.currentUser.name,
            direction: "out",
          },
        ],
        deals: [],
      };
      return nextToast({ ...state, customers: [customer, ...state.customers] }, `Đã tạo hồ sơ ${customer.code} cho ${customer.name}`, "success");
    }
    case "syncLeads": {
      // Đồng bộ chỉ đưa lead đang chờ phân loại vào tệp làm việc; lead đã chia
      // hoặc đã loại không được kéo về lại.
      const pending = state.leads.filter((lead) => lead.status === "moi").length;
      const leads = state.leads.map((item) => (item.status === "moi" ? { ...item, status: "da-phan-loai" as const } : item));
      return nextToast({ ...state, leads }, `Đã đồng bộ ${pending} lead mới và phân loại tự động`, "success");
    }
    case "mergeDuplicateLeads": {
      const duplicates = state.leads.filter((lead) => lead.duplicate);
      if (duplicates.length === 0) {
        return nextToast(state, "Không phát hiện lead trùng dữ liệu", "info");
      }
      const leads = state.leads.map((item) => (item.duplicate ? { ...item, duplicate: false, status: "da-phan-loai" as const, note: `${item.note} (đã gộp hồ sơ trùng)` } : item));
      return nextToast({ ...state, leads }, `Đã gộp ${duplicates.length} lead trùng vào hồ sơ gốc`, "success");
    }
    case "discardLead": {
      const leads = state.leads.map((item) => (item.id === action.leadId ? { ...item, status: "loai" as const } : item));
      return nextToast({ ...state, leads }, "Đã loại lead khỏi tệp", "warn");
    }
    case "toggleWorkflow": {
      const workflows = state.workflows.map((item) =>
        item.id === action.id
          ? { ...item, status: item.status === "dang-chay" ? ("tam-dung" as const) : ("dang-chay" as const) }
          : item,
      );
      const target = workflows.find((item) => item.id === action.id);
      return nextToast({ ...state, workflows }, `Workflow "${target?.name}" đã ${target?.status === "dang-chay" ? "bật" : "tạm dừng"}`, "info");
    }
    case "updateWorkflowNode": {
      const workflows = state.workflows.map((item) =>
        item.id !== action.workflowId
          ? item
          : {
              ...item,
              updatedAt: new Date().toISOString(),
              nodes: item.nodes.map((node) => (node.id === action.nodeId ? { ...node, ...action.patch } : node)),
            },
      );
      return nextToast({ ...state, workflows }, "Đã lưu cấu hình bước trong workflow", "success");
    }
    case "createWorkflow": {
      const { draft } = action;
      const workflow: Workflow = {
        id: `WF-${Date.now()}`,
        name: draft.name,
        status: "ban-nhap",
        trigger: draft.trigger,
        runsToday: 0,
        successRate: 0,
        owner: state.currentUser.name,
        updatedAt: new Date().toISOString(),
        nodes: [{ id: `wn-${Date.now()}`, type: "trigger", title: draft.trigger, detail: "Điểm bắt đầu của quy trình", x: 60, y: 40 }],
        edges: [],
        runs: [],
      };
      return nextToast({ ...state, workflows: [workflow, ...state.workflows] }, `Đã tạo workflow "${workflow.name}" ở dạng bản nháp`, "success");
    }
    case "runWorkflow": {
      const target = state.workflows.find((item) => item.id === action.id);
      if (!target) return state;
      // Một lượt chạy thử chỉ chạy được khi workflow đang hoạt động; bản nháp và
      // workflow tạm dừng phải được bật trước, nếu không sẽ báo lỗi thay vì giả vờ thành công.
      if (target.status !== "dang-chay") {
        return nextToast(state, `Chưa thể chạy "${target.name}": workflow đang ${target.status === "ban-nhap" ? "ở dạng bản nháp" : "tạm dừng"}`, "warn");
      }
      const lead = state.leads[0];
      const run = {
        id: `RUN-${target.id}-${Date.now()}`,
        leadName: lead?.name ?? "Lead mẫu",
        result: "Đã chạy thử với dữ liệu mẫu",
        ok: true,
        at: new Date().toISOString(),
      };
      const workflows = state.workflows.map((item) =>
        item.id === action.id ? { ...item, runsToday: item.runsToday + 1, updatedAt: run.at, runs: [run, ...item.runs] } : item,
      );
      return nextToast({ ...state, workflows }, `Đã chạy thử workflow "${target.name}" với dữ liệu mẫu`, "success");
    }
    case "toggleCampaign": {
      const callbotCampaigns = state.callbotCampaigns.map((item) =>
        item.id === action.id
          ? { ...item, status: item.status === "dang-chay" ? ("tam-dung" as const) : ("dang-chay" as const) }
          : item,
      );
      const target = callbotCampaigns.find((item) => item.id === action.id);
      return nextToast(
        { ...state, callbotCampaigns },
        target?.status === "dang-chay" ? `Đã chạy chiến dịch "${target.name}"` : `Đã tạm dừng chiến dịch "${target?.name}"`,
        target?.status === "dang-chay" ? "success" : "info",
      );
    }
    case "duplicateCampaign": {
      const source = state.callbotCampaigns.find((item) => item.id === action.id);
      if (!source) return state;
      const copy: CallbotCampaign = {
        ...source,
        id: `CB-${Date.now()}`,
        name: `${source.name} (bản sao)`,
        status: "nhap",
        // Bản sao bắt đầu lại từ đầu: chưa gọi, chưa có kết quả.
        connected: 0,
        confirmed: 0,
        rejected: 0,
        callback: 0,
        startDate: new Date().toISOString().slice(0, 10),
        script: source.script.map((step, index) => ({ ...step, id: `S${index + 1}-${Date.now()}` })),
        results: [],
      };
      return nextToast({ ...state, callbotCampaigns: [copy, ...state.callbotCampaigns] }, `Đã nhân bản thành "${copy.name}"`, "success");
    }
    case "createCampaign": {
      const { draft } = action;
      const template = state.callbotCampaigns.find((item) => item.goal === draft.goal) ?? state.callbotCampaigns[0];
      const campaign: CallbotCampaign = {
        id: `CB-${Date.now()}`,
        name: draft.name,
        goal: draft.goal,
        status: "nhap",
        voice: draft.voice,
        total: draft.total,
        connected: 0,
        confirmed: 0,
        rejected: 0,
        callback: 0,
        startDate: new Date().toISOString().slice(0, 10),
        windowStart: draft.windowStart,
        windowEnd: draft.windowEnd,
        concurrency: draft.concurrency,
        retry: draft.retry,
        // Chiến dịch mới mặc định bật các quy tắc an toàn, riêng đồng bộ CRM để
        // người dùng chủ động bật vì nó ghi vào hồ sơ khách hàng.
        rules: {
          quietHours: true,
          autoStopOptOut: true,
          escalateNegative: true,
          sendConfirmSms: true,
          syncToCrm: false,
        },
        script: template ? template.script.map((step, index) => ({ ...step, id: `S${index + 1}` })) : [],
        results: [],
      };
      return nextToast(
        { ...state, callbotCampaigns: [campaign, ...state.callbotCampaigns] },
        `Đã tạo chiến dịch "${campaign.name}" ở dạng bản nháp`,
        "success",
      );
    }
    case "updateCampaignVoice": {
      const callbotCampaigns = state.callbotCampaigns.map((item) => (item.id === action.id ? { ...item, voice: action.voice } : item));
      return nextToast({ ...state, callbotCampaigns }, `Đã đổi giọng đọc sang ${action.voice}`, "success");
    }
    case "updateScriptStep": {
      const callbotCampaigns = state.callbotCampaigns.map((item) =>
        item.id === action.campaignId
          ? { ...item, script: item.script.map((step) => (step.id === action.stepId ? { ...step, ...action.patch } : step)) }
          : item,
      );
      return { ...state, callbotCampaigns };
    }
    case "addScriptStep": {
      const callbotCampaigns = state.callbotCampaigns.map((item) => {
        if (item.id !== action.campaignId) return item;
        const newStep: CallbotScriptStep = {
          id: `S-${Date.now()}`,
          label: "Bước mới",
          say: "Dạ em xin phép trao đổi thêm với anh/chị ạ.",
          expect: "Khách phản hồi",
          branch: "tiep-tuc",
        };
        const at = action.afterStepId ? item.script.findIndex((step) => step.id === action.afterStepId) + 1 : item.script.length;
        const script = [...item.script];
        script.splice(at, 0, newStep);
        return { ...item, script };
      });
      return nextToast({ ...state, callbotCampaigns }, "Đã thêm bước vào kịch bản", "success");
    }
    case "deleteScriptStep": {
      const callbotCampaigns = state.callbotCampaigns.map((item) =>
        item.id === action.campaignId ? { ...item, script: item.script.filter((step) => step.id !== action.stepId) } : item,
      );
      return nextToast({ ...state, callbotCampaigns }, "Đã xoá bước khỏi kịch bản", "warn");
    }
    case "moveScriptStep": {
      const callbotCampaigns = state.callbotCampaigns.map((item) => {
        if (item.id !== action.campaignId) return item;
        const index = item.script.findIndex((step) => step.id === action.stepId);
        const target = action.direction === "up" ? index - 1 : index + 1;
        if (index < 0 || target < 0 || target >= item.script.length) return item;
        const script = [...item.script];
        [script[index], script[target]] = [script[target], script[index]];
        return { ...item, script };
      });
      return { ...state, callbotCampaigns };
    }
    case "recordCallResult": {
      const target = state.callbotCampaigns.find((item) => item.id === action.campaignId);
      if (!target) return state;

      const result = action.result;
      const callbotCampaigns = state.callbotCampaigns.map((item) =>
        item.id !== action.campaignId
          ? item
          : {
              ...item,
              connected: item.connected + (result.outcome === "khong-nghe" || result.outcome === "gap-may" ? 0 : 1),
              confirmed: item.confirmed + (result.outcome === "xac-nhan" ? 1 : 0),
              rejected: item.rejected + (result.outcome === "tu-choi" ? 1 : 0),
              callback: item.callback + (result.outcome === "hen-goi-lai" ? 1 : 0),
              results: [result, ...item.results],
            },
      );

      // Chỉ ghi vào hành trình khách hàng khi quy tắc đồng bộ CRM của chiến dịch
      // đang bật, để tắt được với chiến dịch chỉ thu thập ý kiến.
      const customerName = state.customers.find((customer) => customer.id === result.customerId)?.name ?? "Khách hàng";
      const customers = target.rules.syncToCrm
        ? state.customers.map((customer) =>
            customer.id !== result.customerId
              ? customer
              : {
                  ...customer,
                  lastContactAt: result.at,
                  timeline: [
                    {
                      id: `ev-callbot-${result.id}`,
                      channel: "call" as const,
                      title: `Callbot gọi tự động - ${callbotOutcomeLabel(result.outcome)}`,
                      detail: `Chiến dịch "${target.name}" gọi trong ${formatDuration(result.durationSec)}. Phiên âm: ${result.transcript || "không có phản hồi"}`,
                      at: result.at,
                      actor: "Callbot AI",
                      direction: "out" as const,
                    },
                    ...customer.timeline,
                  ],
                },
          )
        : state.customers;

      const syncNote = target.rules.syncToCrm ? " và đã ghi vào hành trình khách hàng" : "";
      // Các quy tắc có thể can thiệp vào cuộc gọi, nên thông báo phải nói rõ
      // chuyện gì đã xảy ra thay vì chỉ báo kết quả chung chung.
      const ruleNotes: string[] = [];
      if (result.blockedReason) ruleNotes.push(`chưa gọi được: ${result.blockedReason}`);
      if (result.escalated) ruleNotes.push("đã chuyển chuyên viên");
      if (result.optedOut) ruleNotes.push("khách yêu cầu không liên hệ lại");
      if (result.smsSent) ruleNotes.push("đã gửi SMS xác nhận");
      const ruleNote = ruleNotes.length > 0 ? ` (${ruleNotes.join(", ")})` : "";

      return nextToast(
        { ...state, callbotCampaigns, customers },
        `Đã lưu kết quả cuộc gọi với ${customerName}: ${callbotOutcomeLabel(result.outcome)}${ruleNote}${syncNote}`,
        result.blockedReason || result.optedOut ? "warn" : "success",
      );
    }
    case "updateCampaignConfig": {
      const callbotCampaigns = state.callbotCampaigns.map((item) =>
        item.id === action.id ? { ...item, ...action.patch } : item,
      );
      return nextToast({ ...state, callbotCampaigns }, "Đã cập nhật cấu hình chiến dịch", "success");
    }
    case "toggleCampaignRule": {
      const callbotCampaigns = state.callbotCampaigns.map((item) =>
        item.id !== action.id ? item : { ...item, rules: { ...item.rules, [action.rule]: !item.rules[action.rule] } },
      );
      const target = callbotCampaigns.find((item) => item.id === action.id);
      const label = CALLBOT_RULE_LABELS[action.rule];
      return nextToast(
        { ...state, callbotCampaigns },
        `Đã ${target?.rules[action.rule] ? "bật" : "tắt"} quy tắc "${label}"`,
        target?.rules[action.rule] ? "success" : "warn",
      );
    }
    case "toggleMessagingCampaign": {
      const messagingCampaigns = state.messagingCampaigns.map((item) =>
        item.id === action.id
          ? { ...item, status: item.status === "dang-chay" ? ("tam-dung" as const) : ("dang-chay" as const) }
          : item,
      );
      return nextToast({ ...state, messagingCampaigns }, "Đã cập nhật trạng thái chiến dịch nhắn tin", "info");
    }
    case "createMessagingCampaign": {
      const { draft } = action;
      const campaign: MessagingCampaign = {
        id: `MC-${Date.now()}`,
        name: draft.name,
        channel: draft.channel,
        status: draft.start ? "dang-chay" : "nhap",
        audience: draft.audience,
        templateId: "",
        sent: 0,
        delivered: 0,
        opened: 0,
        replied: 0,
        failed: 0,
        scheduledAt: draft.scheduledAt,
        brandname: draft.brandname,
      };
      // Nội dung soạn tay được lưu thành mẫu tin dùng lại, gắn vào chính chiến
      // dịch vừa tạo để thư viện mẫu phản ánh đúng thứ đã gửi.
      const template: MessageTemplate = {
        id: `T-${Date.now()}`,
        name: `${draft.name} - nội dung`,
        channel: draft.channel,
        category: "cham-soc",
        body: draft.body,
        usageCount: 0,
        updatedAt: new Date().toISOString(),
      };
      campaign.templateId = template.id;
      return nextToast(
        {
          ...state,
          messagingCampaigns: [campaign, ...state.messagingCampaigns],
          templates: [template, ...state.templates],
        },
        draft.start ? `Đã bắt đầu gửi chiến dịch "${campaign.name}"` : `Đã lưu nháp chiến dịch "${campaign.name}"`,
        draft.start ? "success" : "info",
      );
    }
    case "duplicateMessagingCampaign": {
      const source = state.messagingCampaigns.find((item) => item.id === action.id);
      if (!source) return state;
      const copy: MessagingCampaign = {
        ...source,
        id: `MC-${Date.now()}`,
        name: `${source.name} (bản sao)`,
        status: "nhap",
        // Bản sao chưa gửi, không mang theo số liệu của bản gốc.
        sent: 0,
        delivered: 0,
        opened: 0,
        replied: 0,
        failed: 0,
      };
      return nextToast({ ...state, messagingCampaigns: [copy, ...state.messagingCampaigns] }, `Đã nhân bản thành "${copy.name}"`, "success");
    }
    case "updateTemplate": {
      const templates = state.templates.map((item) => (item.id === action.id ? { ...item, ...action.patch, updatedAt: new Date().toISOString() } : item));
      return nextToast({ ...state, templates }, "Đã cập nhật mẫu tin", "success");
    }
    case "toast":
      return nextToast(state, action.message, action.tone ?? "info");
    case "dismissToast":
      return { ...state, toasts: state.toasts.filter((item) => item.id !== action.id) };
    default:
      return state;
  }
}

function nextCustomerCode(existing: Customer[]): string {
  const maxCode = existing.reduce((max, customer) => {
    const value = Number.parseInt(customer.code.replace(/\D/g, ""), 10);
    return Number.isNaN(value) ? max : Math.max(max, value);
  }, 1024);
  return `KH-${maxCode + 1}`;
}

/** Tạo hồ sơ ACRM từ một lead vừa được chia cho sales. */
function customerFromLead(lead: Lead, assignee: string, code: string): Customer {
  const now = new Date().toISOString();
  return {
    id: `KH${lead.id}`,
    code,
    name: lead.name,
    company: lead.campaign,
    phone: lead.phone,
    email: lead.email,
    address: "Chưa cập nhật",
    status: "lead",
    source: lead.source,
    owner: assignee,
    tags: ["Từ Ulead"],
    createdAt: now,
    lastContactAt: now,
    score: lead.score,
    totalValue: 0,
    dealCount: 0,
    note: lead.note,
    timeline: [
      {
        id: `ev-${lead.id}`,
        channel: "website",
        title: `Lead từ ${lead.campaign}`,
        detail: `Lead được chia cho ${assignee} từ chiến dịch ${lead.campaign}.`,
        at: now,
        actor: "Ulead",
        direction: "in",
      },
    ],
    deals: [],
  };
}

/** Nhãn hiển thị của từng quy tắc vận hành, dùng chung cho toast và giao diện. */
export const CALLBOT_RULE_LABELS: Record<keyof CallbotRules, string> = {
  quietHours: "Không gọi ngoài khung giờ cho phép",
  autoStopOptOut: "Tự dừng khi khách yêu cầu không làm phiền",
  escalateNegative: "Chuyển nhân viên khi khách phản hồi tiêu cực",
  sendConfirmSms: "Gửi SMS xác nhận sau cuộc gọi thành công",
  syncToCrm: "Ghi kết quả vào hành trình khách hàng",
};

function callbotOutcomeLabel(outcome: CallbotResult["outcome"]): string {
  switch (outcome) {
    case "xac-nhan":
      return "Khách đã xác nhận";
    case "tu-choi":
      return "Khách từ chối";
    case "hen-goi-lai":
      return "Khách hẹn gọi lại";
    case "gap-may":
      return "Gặp máy / nhà mạng chặn";
    default:
      return "Không nghe máy";
  }
}

function outcomeLabel(outcome: NonNullable<TelesalesTask["outcome"]>): string {
  switch (outcome) {
    case "chot-don":
      return "Đã chốt đơn";
    case "hen-lai":
      return "Hẹn gọi lại";
    case "tu-choi":
      return "Khách từ chối";
    default:
      return "Không nghe máy";
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export interface DashboardMetrics {
  totalCustomers: number;
  newLeadsToday: number;
  pipelineValue: number;
  wonValue: number;
  callsToday: number;
  answerRate: number;
  missedCalls: number;
  avgHandleSec: number;
  openConversations: number;
  slaBreached: number;
  callbotConnected: number;
  callbotConfirmed: number;
  messageSent: number;
  messageReplied: number;
  channelSplit: Array<{ channel: string; label: string; count: number; color: string }>;
  hourlyCalls: Array<{ hour: string; inbound: number; outbound: number; missed: number }>;
  sourceSplit: Array<{ source: string; label: string; count: number; color: string }>;
  stageSplit: Array<{ stage: string; label: string; count: number; value: number; color: string }>;
  funnel: Array<{ label: string; value: number }>;
  leaderboard: Array<{ name: string; calls: number; won: number; rate: number }>;
  trend: Array<{ label: string; leads: number; won: number }>;
}

export function useDashboardMetrics(): DashboardMetrics {
  const { state } = useApp();
  return useMemo(() => {
    const pipelineValue = state.customers.reduce((sum, customer) => sum + customer.totalValue, 0);
    const wonCustomers = state.customers.filter((customer) => customer.status === "customer");
    const wonValue = wonCustomers.reduce((sum, customer) => sum + customer.totalValue, 0);
    const completedCalls = state.calls.filter((call) => call.status !== "ringing" && call.status !== "talking");
    const answered = completedCalls.filter((call) => call.status === "completed");
    const missed = state.calls.filter((call) => call.status === "missed");
    const avgHandleSec = answered.length
      ? Math.round(answered.reduce((sum, call) => sum + call.durationSec, 0) / answered.length)
      : 0;

    const openConversations = state.conversations.filter((item) => item.status !== "da-xu-ly");
    const slaBreached = openConversations.filter(
      (item) => (Date.now() - new Date(item.updatedAt).getTime()) / 60000 > item.slaMinutes,
    ).length;

    const channelSplit = [
      { channel: "call", label: "Cuộc gọi", color: "#0f8b98" },
      { channel: "zalo", label: "Zalo OA", color: "#0b7fdb" },
      { channel: "facebook", label: "Facebook", color: "#2563eb" },
      { channel: "email", label: "Email", color: "#b45309" },
      { channel: "sms", label: "SMS", color: "#7c3aed" },
      { channel: "website", label: "Website", color: "#0f766e" },
    ].map((entry) => ({
      ...entry,
      count: state.conversations.filter((item) => item.channel === entry.channel).length,
    }));

    const hourlyCalls = Array.from({ length: 10 }, (_, index) => {
      const hour = 8 + index;
      const base = index < 2 ? 12 : index > 7 ? 10 : 22;
      return {
        hour: `${String(hour).padStart(2, "0")}h`,
        inbound: Math.round(base * 0.45 + (index % 3) * 4),
        outbound: Math.round(base * 0.9 + (index % 4) * 3),
        missed: Math.max(1, Math.round(base * 0.12)),
      };
    });

    const sourceOrder = ["facebook", "google", "tiktok", "zalo", "website", "hotline", "referral", "event"] as const;
    const sourceSplit = sourceOrder.map((source) => ({
      source,
      label: leadSourceMeta[source].label,
      color: leadSourceMeta[source].color,
      count: state.leads.filter((lead) => lead.source === source).length,
    }));

    const stageOrder = ["moi", "dang-tu-van", "bao-gia", "dam-phan", "thang", "thua"] as const;
    const stageLabels: Record<string, string> = {
      moi: "Mới tiếp cận",
      "dang-tu-van": "Đang tư vấn",
      "bao-gia": "Đã báo giá",
      "dam-phan": "Đàm phán",
      thang: "Thắng - Đã chốt",
      thua: "Thua - Không chốt",
    };
    const stageColors: Record<string, string> = {
      moi: "#64748b",
      "dang-tu-van": "#0b7fdb",
      "bao-gia": "#b45309",
      "dam-phan": "#7c3aed",
      thang: "#15803d",
      thua: "#be123c",
    };
    const allDeals = state.customers.flatMap((customer) => customer.deals);
    const stageSplit = stageOrder.map((stage) => {
      const deals = allDeals.filter((deal) => deal.stage === stage);
      return {
        stage,
        label: stageLabels[stage],
        count: deals.length,
        value: deals.reduce((sum, deal) => sum + deal.value, 0),
        color: stageColors[stage],
      };
    });

    const funnel = [
      { label: "Lead thu về", value: state.leads.length * 12 + 240 },
      { label: "Đã liên hệ", value: 412 },
      { label: "Đủ điều kiện", value: 268 },
      { label: "Báo giá", value: 164 },
      { label: "Chốt đơn", value: 92 },
    ];

    const leaderboard = state.agents
      .map((agent) => ({
        name: agent.name,
        calls: agent.callsToday,
        won: Math.round(agent.callsToday * (agent.answerRate / 100) * 0.18),
        rate: agent.answerRate,
      }))
      .sort((a, b) => b.calls - a.calls);

    const trend = Array.from({ length: 8 }, (_, index) => {
      const week = index + 1;
      return {
        label: `Tuần ${week}`,
        leads: 180 + Math.round(Math.sin(week) * 40) + week * 12,
        won: 22 + Math.round(Math.cos(week) * 8) + week * 3,
      };
    });

    const callbotConnected = state.callbotCampaigns.reduce((sum, campaign) => sum + campaign.connected, 0);
    const callbotConfirmed = state.callbotCampaigns.reduce((sum, campaign) => sum + campaign.confirmed, 0);
    const messageSent = state.messagingCampaigns.reduce((sum, campaign) => sum + campaign.sent, 0);
    const messageReplied = state.messagingCampaigns.reduce((sum, campaign) => sum + campaign.replied, 0);

    return {
      totalCustomers: state.customers.length,
      newLeadsToday: state.leads.filter((lead) => (Date.now() - new Date(lead.receivedAt).getTime()) / 3600000 < 24).length,
      pipelineValue,
      wonValue,
      callsToday: state.agents.reduce((sum, agent) => sum + agent.callsToday, 0),
      answerRate: completedCalls.length ? (answered.length / completedCalls.length) * 100 : 0,
      missedCalls: missed.length,
      avgHandleSec,
      openConversations: openConversations.length,
      slaBreached,
      callbotConnected,
      callbotConfirmed,
      messageSent,
      messageReplied,
      channelSplit,
      hourlyCalls,
      sourceSplit,
      stageSplit,
      funnel,
      leaderboard,
      trend,
    };
  }, [state]);
}
