import type {
  CallDirection,
  CallStatus,
  CampaignStatus,
  Channel,
  ConversationStatus,
  CustomerStatus,
  LeadSource,
  PipelineStage,
} from "./types";

export const channelMeta: Record<Channel, { label: string; short: string; color: string; bg: string }> = {
  call: { label: "Cuộc gọi", short: "Gọi", color: "#0f8b98", bg: "#e5f7f9" },
  zalo: { label: "Zalo OA", short: "Zalo", color: "#0b7fdb", bg: "#e7f2fe" },
  facebook: { label: "Facebook", short: "FB", color: "#2563eb", bg: "#e8eeff" },
  email: { label: "Email", short: "Mail", color: "#b45309", bg: "#fdf1e0" },
  sms: { label: "SMS Brandname", short: "SMS", color: "#7c3aed", bg: "#f1ebfe" },
  website: { label: "Website / Form", short: "Web", color: "#0f766e", bg: "#e6f5f3" },
  note: { label: "Ghi chú nội bộ", short: "Note", color: "#64748b", bg: "#eef2f6" },
};

export const customerStatusMeta: Record<CustomerStatus, { label: string; color: string; bg: string }> = {
  lead: { label: "Lead mới", color: "#1d4ed8", bg: "#e8eeff" },
  potential: { label: "Tiềm năng", color: "#b45309", bg: "#fdf1e0" },
  customer: { label: "Đang giao dịch", color: "#0f8b98", bg: "#e5f7f9" },
  loyal: { label: "Khách trung thành", color: "#15803d", bg: "#e7f7ec" },
  churn: { label: "Nguy cơ rời bỏ", color: "#be123c", bg: "#fdeaee" },
};

export const leadSourceMeta: Record<LeadSource, { label: string; color: string }> = {
  facebook: { label: "Facebook Ads", color: "#2563eb" },
  google: { label: "Google Ads", color: "#dc2626" },
  tiktok: { label: "TikTok Ads", color: "#0f172a" },
  zalo: { label: "Zalo OA", color: "#0b7fdb" },
  website: { label: "Website", color: "#0f766e" },
  hotline: { label: "Hotline", color: "#b45309" },
  referral: { label: "Giới thiệu", color: "#7c3aed" },
  event: { label: "Sự kiện / Hội thảo", color: "#be185d" },
};

export const pipelineMeta: Record<PipelineStage, { label: string; color: string }> = {
  moi: { label: "Mới tiếp cận", color: "#64748b" },
  "dang-tu-van": { label: "Đang tư vấn", color: "#0b7fdb" },
  "bao-gia": { label: "Đã báo giá", color: "#b45309" },
  "dam-phan": { label: "Đàm phán", color: "#7c3aed" },
  thang: { label: "Thắng - Đã chốt", color: "#15803d" },
  thua: { label: "Thua - Không chốt", color: "#be123c" },
};

export const pipelineOrder: PipelineStage[] = ["moi", "dang-tu-van", "bao-gia", "dam-phan", "thang", "thua"];

export const conversationStatusMeta: Record<ConversationStatus, { label: string; color: string; bg: string }> = {
  moi: { label: "Mới", color: "#1d4ed8", bg: "#e8eeff" },
  "dang-mo": { label: "Đang mở", color: "#0f8b98", bg: "#e5f7f9" },
  "cho-khach": { label: "Chờ khách", color: "#b45309", bg: "#fdf1e0" },
  "da-xu-ly": { label: "Đã xử lý", color: "#15803d", bg: "#e7f7ec" },
};

export const callStatusMeta: Record<CallStatus, { label: string; color: string; bg: string }> = {
  ringing: { label: "Đang đổ chuông", color: "#b45309", bg: "#fdf1e0" },
  talking: { label: "Đang đàm thoại", color: "#0f8b98", bg: "#e5f7f9" },
  "wrap-up": { label: "Đang ghi chú", color: "#7c3aed", bg: "#f1ebfe" },
  completed: { label: "Hoàn tất", color: "#15803d", bg: "#e7f7ec" },
  missed: { label: "Nhỡ / Không nghe", color: "#be123c", bg: "#fdeaee" },
};

export const callDirectionMeta: Record<CallDirection, string> = {
  inbound: "Cuộc gọi vào",
  outbound: "Cuộc gọi ra",
};

export const campaignStatusMeta: Record<CampaignStatus, { label: string; color: string; bg: string }> = {
  nhap: { label: "Bản nháp", color: "#64748b", bg: "#eef2f6" },
  "dang-chay": { label: "Đang chạy", color: "#0f8b98", bg: "#e5f7f9" },
  "tam-dung": { label: "Tạm dừng", color: "#b45309", bg: "#fdf1e0" },
  "hoan-thanh": { label: "Hoàn thành", color: "#15803d", bg: "#e7f7ec" },
};

export const callbotGoalMeta: Record<string, { label: string; color: string }> = {
  "xac-nhan-don": { label: "Xác nhận đơn hàng", color: "#0f8b98" },
  "nhac-lich": { label: "Nhắc lịch hẹn", color: "#b45309" },
  "tu-van": { label: "Tư vấn tự động", color: "#2563eb" },
  "khao-sat": { label: "Khảo sát khách hàng", color: "#7c3aed" },
};

export const callbotOutcomeMeta: Record<string, { label: string; color: string; bg: string }> = {
  "xac-nhan": { label: "Đã xác nhận", color: "#15803d", bg: "#e7f7ec" },
  "tu-choi": { label: "Từ chối", color: "#be123c", bg: "#fdeaee" },
  "hen-goi-lai": { label: "Hẹn gọi lại", color: "#b45309", bg: "#fdf1e0" },
  "khong-nghe": { label: "Không nghe máy", color: "#64748b", bg: "#eef2f6" },
  "gap-may": { label: "Gặp máy / Nhà mạng chặn", color: "#7c3aed", bg: "#f1ebfe" },
};

export const sentimentMeta: Record<string, { label: string; color: string; bg: string }> = {
  "tich-cuc": { label: "Tích cực", color: "#15803d", bg: "#e7f7ec" },
  "trung-tinh": { label: "Trung tính", color: "#64748b", bg: "#eef2f6" },
  "tieu-cuc": { label: "Tiêu cực", color: "#be123c", bg: "#fdeaee" },
};

export const agentStatusMeta: Record<string, { label: string; color: string; dot: string }> = {
  online: { label: "Sẵn sàng", color: "#15803d", dot: "#22c55e" },
  talking: { label: "Đang đàm thoại", color: "#0f8b98", dot: "#0ea5b7" },
  "wrap-up": { label: "Đang ghi chú", color: "#7c3aed", dot: "#a78bfa" },
  break: { label: "Nghỉ giải lao", color: "#b45309", dot: "#f59e0b" },
  offline: { label: "Offline", color: "#64748b", dot: "#94a3b8" },
};

export const priorityMeta: Record<string, { label: string; color: string; bg: string }> = {
  cao: { label: "Ưu tiên cao", color: "#be123c", bg: "#fdeaee" },
  "trung-binh": { label: "Trung bình", color: "#b45309", bg: "#fdf1e0" },
  thap: { label: "Thấp", color: "#64748b", bg: "#eef2f6" },
};

export const leadStatusMeta: Record<string, { label: string; color: string; bg: string }> = {
  moi: { label: "Chờ phân loại", color: "#1d4ed8", bg: "#e8eeff" },
  "da-phan-loai": { label: "Đã phân loại", color: "#0f8b98", bg: "#e5f7f9" },
  "da-chia": { label: "Đã chia cho sales", color: "#15803d", bg: "#e7f7ec" },
  trung: { label: "Trùng dữ liệu", color: "#b45309", bg: "#fdf1e0" },
  loai: { label: "Đã loại", color: "#be123c", bg: "#fdeaee" },
};

export const workflowStatusMeta: Record<string, { label: string; color: string; bg: string }> = {
  "dang-chay": { label: "Đang chạy", color: "#15803d", bg: "#e7f7ec" },
  "tam-dung": { label: "Tạm dừng", color: "#b45309", bg: "#fdf1e0" },
  "ban-nhap": { label: "Bản nháp", color: "#64748b", bg: "#eef2f6" },
};

export const nodeTypeMeta: Record<string, { label: string; color: string; bg: string }> = {
  trigger: { label: "Kích hoạt", color: "#0f8b98", bg: "#e5f7f9" },
  condition: { label: "Điều kiện", color: "#b45309", bg: "#fdf1e0" },
  action: { label: "Hành động", color: "#15803d", bg: "#e7f7ec" },
  delay: { label: "Chờ", color: "#7c3aed", bg: "#f1ebfe" },
};

export function formatVnd(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(".", ",")} tỷ`;
  if (Math.abs(value) >= 1_000_000) return `${Math.round(value / 1_000_000)} tr`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}K`;
  return `${value}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}

export function formatPercent(value: number, digits = 0): string {
  return `${value.toFixed(digits).replace(".", ",")}%`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

// Sản phẩm phục vụ đội ngũ kinh doanh Việt Nam nên mọi mốc thời gian đều hiển thị
// theo múi giờ ICT, bất kể người xem đang ở múi giờ nào.
export const TIME_ZONE = "Asia/Ho_Chi_Minh";

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function weekdayLabel(iso: string): string {
  const short = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "short" }).format(new Date(iso));
  return WEEKDAYS[[ "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" ].indexOf(short)] ?? "";
}

export function formatDateTime(iso: string): string {
  return `${weekdayLabel(iso)}, ${dateFormatter.format(new Date(iso))} ${timeFormatter.format(new Date(iso))}`;
}

export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

/** Nhãn dd/MM ngắn gọn cho `count` ngày gần nhất, cũ nhất ở đầu. */
export function recentDayLabels(count: number): string[] {
  const dayShort = new Intl.DateTimeFormat("vi-VN", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit" });
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.now() - (count - 1 - index) * 86400000);
    return dayShort.format(date);
  });
}

export function relativeTime(iso: string, now = new Date()): string {
  const diffMin = Math.round((now.getTime() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return formatDate(iso);
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function avatarColor(seed: string): string {
  const palette = ["#0f8b98", "#2563eb", "#b45309", "#7c3aed", "#be123c", "#15803d", "#0b7fdb", "#0f766e"];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 9973;
  return palette[hash % palette.length];
}

export function maskPhone(phone: string): string {
  return phone.replace(/(\d{4})(\d{3})(\d{3})/, "$1 $2 $3");
}

/** Bỏ dấu tiếng Việt để dùng cho phần local của địa chỉ email. */
export function toAsciiSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/** Số điện thoại chỉ giữ chữ số, dùng làm khoá so khớp giữa lead và khách hàng. */
export function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}
