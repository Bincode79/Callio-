export type Channel =
  | "call"
  | "zalo"
  | "facebook"
  | "email"
  | "sms"
  | "website"
  | "note";

export type CustomerStatus = "lead" | "potential" | "customer" | "loyal" | "churn";

export type LeadSource =
  | "facebook"
  | "google"
  | "tiktok"
  | "zalo"
  | "website"
  | "hotline"
  | "referral"
  | "event";

export interface TimelineEvent {
  id: string;
  channel: Channel;
  title: string;
  detail: string;
  at: string;
  actor: string;
  direction?: "in" | "out";
}

export interface Deal {
  id: string;
  name: string;
  value: number;
  stage: PipelineStage;
  owner: string;
  closedAt?: string;
}

export type PipelineStage =
  | "moi"
  | "dang-tu-van"
  | "bao-gia"
  | "dam-phan"
  | "thang"
  | "thua";

export interface Customer {
  id: string;
  code: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  address: string;
  status: CustomerStatus;
  source: LeadSource;
  owner: string;
  tags: string[];
  createdAt: string;
  lastContactAt: string;
  score: number;
  totalValue: number;
  dealCount: number;
  note: string;
  timeline: TimelineEvent[];
  deals: Deal[];
}

export type ConversationStatus = "moi" | "dang-mo" | "cho-khach" | "da-xu-ly";

export interface Message {
  id: string;
  direction: "in" | "out";
  body: string;
  at: string;
  sender: string;
  attachment?: string;
}

export interface Conversation {
  id: string;
  customerId: string;
  channel: Channel;
  subject: string;
  status: ConversationStatus;
  assignee: string;
  unread: number;
  updatedAt: string;
  slaMinutes: number;
  messages: Message[];
}

export type CallDirection = "inbound" | "outbound";
export type CallStatus = "ringing" | "talking" | "wrap-up" | "completed" | "missed";

export interface CallRecord {
  id: string;
  customerId: string;
  direction: CallDirection;
  status: CallStatus;
  agent: string;
  queue: string;
  startedAt: string;
  durationSec: number;
  waitSec: number;
  recording: boolean;
  sentiment: "tich-cuc" | "trung-tinh" | "tieu-cuc";
  note: string;
}

export interface Agent {
  id: string;
  name: string;
  extension: string;
  team: string;
  status: "online" | "talking" | "wrap-up" | "break" | "offline";
  callsToday: number;
  talkTimeMin: number;
  answerRate: number;
  avatarSeed: string;
}

export type CampaignStatus = "nhap" | "dang-chay" | "tam-dung" | "hoan-thanh";

export interface CallbotScriptStep {
  id: string;
  label: string;
  say: string;
  expect: string;
  branch: "tiep-tuc" | "xac-nhan" | "chuyen-nhan-vien" | "ket-thuc";
}

/**
 * Quy tắc vận hành của chiến dịch gọi tự động. Các cờ này quyết định hệ thống
 * được phép làm gì trong và sau cuộc gọi, nên cần bật/tắt được chứ không chỉ hiển
 * thị cho có.
 */
export interface CallbotRules {
  /** Không gọi ngoài khung giờ cho phép. */
  quietHours: boolean;
  /** Tự dừng khi khách yêu cầu không làm phiền. */
  autoStopOptOut: boolean;
  /** Chuyển nhân viên thật khi khách phản hồi tiêu cực. */
  escalateNegative: boolean;
  /** Gửi SMS xác nhận sau cuộc gọi thành công. */
  sendConfirmSms: boolean;
  /** Ghi kết quả cuộc gọi vào hành trình khách hàng trong ACRM. */
  syncToCrm: boolean;
}

export interface CallbotCampaign {
  id: string;
  name: string;
  goal: "xac-nhan-don" | "nhac-lich" | "tu-van" | "khao-sat";
  status: CampaignStatus;
  voice: string;
  total: number;
  connected: number;
  confirmed: number;
  rejected: number;
  callback: number;
  startDate: string;
  windowStart: string;
  windowEnd: string;
  concurrency: number;
  retry: number;
  rules: CallbotRules;
  script: CallbotScriptStep[];
  results: CallbotResult[];
}

/** Một lượt nói trong cuộc gọi: trợ lý ảo hoặc khách hàng. */
export interface CallbotTurn {
  id: string;
  speaker: "bot" | "khach";
  text: string;
  atSec: number;
  sentiment?: "tich-cuc" | "trung-tinh" | "tieu-cuc";
  intent?: string;
}

export interface CallbotResult {
  id: string;
  customerId: string;
  outcome: "xac-nhan" | "tu-choi" | "hen-goi-lai" | "khong-nghe" | "gap-may";
  durationSec: number;
  at: string;
  transcript: string;
  sentiment: "tich-cuc" | "trung-tinh" | "tieu-cuc";
  turns?: CallbotTurn[];
  recordingUrl?: string;
  qualityScore?: number;
  stepReached?: number;
}

export interface TelesalesTask {
  id: string;
  customerId: string;
  listName: string;
  priority: "cao" | "trung-binh" | "thap";
  attempts: number;
  lastResult: string;
  dueAt: string;
  script: string;
  done: boolean;
  outcome?: "chot-don" | "hen-lai" | "tu-choi" | "khong-nghe-may";
}

export interface MessageTemplate {
  id: string;
  name: string;
  channel: Channel;
  category: "cham-soc" | "marketing" | "giao-dich" | "nhac-hen";
  body: string;
  usageCount: number;
  updatedAt: string;
}

export interface MessagingCampaign {
  id: string;
  name: string;
  channel: Channel;
  status: CampaignStatus;
  audience: string;
  templateId: string;
  sent: number;
  delivered: number;
  opened: number;
  replied: number;
  failed: number;
  scheduledAt: string;
  brandname: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  source: LeadSource;
  campaign: string;
  score: number;
  status: "moi" | "da-phan-loai" | "da-chia" | "trung" | "loai";
  receivedAt: string;
  assignedTo?: string;
  duplicate: boolean;
  note: string;
}

export interface WorkflowNode {
  id: string;
  type: "trigger" | "condition" | "action" | "delay";
  title: string;
  detail: string;
  x: number;
  y: number;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  label?: string;
}

export interface Workflow {
  id: string;
  name: string;
  status: "dang-chay" | "tam-dung" | "ban-nhap";
  trigger: string;
  runsToday: number;
  successRate: number;
  owner: string;
  updatedAt: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}
