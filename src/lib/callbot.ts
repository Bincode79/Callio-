import { TIME_ZONE } from "./format";
import type { CallbotCampaign, CallbotResult, CallbotScriptStep, CallbotTurn, Customer } from "./types";

/**
 * Câu trả lời của khách theo từng nhánh kịch bản, dùng để dựng hội thoại mô
 * phỏng. Cố ý viết trung tính về giới tính vì danh sách khách hàng có cả nam và
 * nữ, không thể suy ra cách xưng hô từ tên.
 */
const CUSTOMER_REPLIES: Record<CallbotScriptStep["branch"], Array<{ text: string; intent: string; sentiment: CallbotTurn["sentiment"] }>> = {
  "tiep-tuc": [
    { text: "Dạ anh/chị nghe đây ạ.", intent: "Nghe máy", sentiment: "trung-tinh" },
    { text: "Ừ em nói đi.", intent: "Nghe máy", sentiment: "trung-tinh" },
    { text: "Alo, ai đấy ạ?", intent: "Nghe máy", sentiment: "trung-tinh" },
    // Tình huống thực tế: khách đã mệt vì bị gọi nhiều lần.
    { text: "Thôi đừng gọi cho tôi nữa.", intent: "Yêu cầu dừng liên hệ", sentiment: "tieu-cuc" },
  ],
  "xac-nhan": [
    { text: "Dạ đúng rồi em, cứ giao theo thông tin đó nhé.", intent: "Xác nhận", sentiment: "tich-cuc" },
    { text: "Đúng rồi em, xác nhận giúp anh/chị.", intent: "Xác nhận", sentiment: "tich-cuc" },
    { text: "Chưa rõ lắm, em đọc lại giúp anh/chị nhé.", intent: "Cần làm rõ", sentiment: "trung-tinh" },
  ],
  "chuyen-nhan-vien": [
    { text: "Ừ em chuyển máy giúp anh/chị nhé.", intent: "Đồng ý chuyển máy", sentiment: "tich-cuc" },
    { text: "Thôi để anh/chị gọi lại sau.", intent: "Từ chối", sentiment: "tieu-cuc" },
  ],
  "ket-thuc": [
    { text: "Cảm ơn em nhé.", intent: "Kết thúc", sentiment: "tich-cuc" },
    { text: "Ừ chào em.", intent: "Kết thúc", sentiment: "trung-tinh" },
  ],
};

/** Kết quả cuộc gọi suy ra từ nhánh của bước cuối mà trợ lý ảo đi tới. */
const OUTCOME_BY_BRANCH: Record<CallbotScriptStep["branch"], CallbotResult["outcome"]> = {
  "tiep-tuc": "xac-nhan",
  "xac-nhan": "xac-nhan",
  "chuyen-nhan-vien": "hen-goi-lai",
  "ket-thuc": "xac-nhan",
};

export interface SimulationOutcome {
  turns: CallbotTurn[];
  outcome: CallbotResult["outcome"];
  durationSec: number;
  sentiment: CallbotResult["sentiment"];
  stepReached: number;
  qualityScore: number;
  transcript: string;
  /** Có giá trị khi quy tắc khung giờ chặn không cho đặt cuộc gọi. */
  blocked?: { reason: string };
  /** Quy tắc chuyển nhân viên đã can thiệp vì khách phản hồi tiêu cực. */
  escalated: boolean;
  /** Khách yêu cầu không làm phiền và quy tắc tương ứng đang bật. */
  optedOut: boolean;
  /** SMS xác nhận sẽ được gửi sau cuộc gọi thành công. */
  smsSent: boolean;
  /** Cuộc gọi dừng trước khi đọc hết kịch bản (khách từ chối hoặc yêu cầu dừng). */
  stoppedEarly: boolean;
}

/** Các cụm từ cho thấy khách không muốn bị liên hệ tiếp. */
const OPT_OUT_PHRASES = ["đừng gọi", "đừng liên lạc", "không làm phiền", "không muốn nhận"];
/** Giờ và phút hiện tại theo múi giờ vận hành của tổng đài. */
function currentTimeInZone(): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  const [hour, minute] = parts.split(":").map(Number);
  return { hour: hour ?? 0, minute: minute ?? 0 };
}

function toMinutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

/** Khung giờ cho phép gọi đã bao gồm thời điểm hiện tại chưa. */
export function isWithinWindow(windowStart: string, windowEnd: string): boolean {
  const now = currentTimeInZone();
  const current = now.hour * 60 + now.minute;
  const start = toMinutes(windowStart);
  const end = toMinutes(windowEnd);
  // Khung giờ qua nửa đêm (ví dụ 22:00 - 06:00) thì so theo hai đoạn.
  return start <= end ? current >= start && current <= end : current >= start || current <= end;
}

export function hasOptedOut(text: string): boolean {
  const normalized = plain(text);
  // Phải chuẩn hoá cả từ khoá, nếu không thì chuỗi đã bỏ dấu sẽ không bao giờ
  // khớp được với cụm còn dấu.
  return OPT_OUT_PHRASES.some((phrase) => normalized.includes(plain(phrase)));
}

/** Bỏ dấu để so khớp từ khoá trong phiên âm mà không phân biệt dấu. */
function plain(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

/**
 * Điền biến động trong lời thoại bằng dữ liệu thật của khách hàng để bản xem
 * trước và phiên âm khớp với hồ sơ đang gọi.
 */
export function fillVariables(text: string, customer: Customer, campaign: CallbotCampaign): string {
  return text
    .replace(/\{ten_khach\}/g, customer.name)
    .replace(/\{ma_don\}/g, `DH-${customer.code.replace(/\D/g, "")}`)
    .replace(/\{san_pham\}/g, customer.company)
    .replace(/\{ngay_giao\}/g, new Date(Date.now() + 2 * 86400000).toLocaleDateString("vi-VN"))
    .replace(/\{gio_hen\}/g, campaign.windowStart)
    .replace(/\{ten_sale\}/g, customer.owner);
}

/**
 * Mô phỏng một cuộc gọi tự động tất định: trợ lý ảo đọc lần lượt các bước kịch
 * bản, khách phản hồi theo nhánh, và kết quả được suy ra từ bước cuối cùng.
 *
 * Quy tắc vận hành của chiến dịch được áp dụng trong lúc mô phỏng:
 * khung giờ chặn trước khi gọi, khách yêu cầu không làm phiền thì dừng và ghi
 * nhận, phản hồi tiêu cực thì chuyển nhân viên, và SMS xác nhận sau khi thành công.
 *
 * `variant` giúp chạy nhiều kịch bản khác nhau cho cùng một khách hàng (dùng khi
 * gọi lại hoặc khi cần kết quả khác với lần trước).
 */
export function simulateCall(
  campaign: CallbotCampaign,
  customer: Customer,
  variant = 0,
): SimulationOutcome {
  // Quy tắc khung giờ: không gọi ngoài giờ cho phép thì dừng trước khi bấm số.
  if (campaign.rules.quietHours && !isWithinWindow(campaign.windowStart, campaign.windowEnd)) {
    return {
      turns: [],
      outcome: "hen-goi-lai",
      durationSec: 0,
      sentiment: "trung-tinh",
      stepReached: 0,
      qualityScore: 0,
      transcript: "",
      blocked: {
        reason: `Ngoài khung giờ cho phép ${campaign.windowStart} - ${campaign.windowEnd}`,
      },
      escalated: false,
      optedOut: false,
      smsSent: false,
      stoppedEarly: false,
    };
  }

  const turns: CallbotTurn[] = [];
  let clock = 0;
  let stepReached = 0;
  let optedOut = false;
  let escalated = false;
  let stoppedEarly = false;

  for (const [index, step] of campaign.script.entries()) {
    clock += 3 + (index % 3);
    turns.push({
      id: `${campaign.id}-${customer.id}-t${index}-bot`,
      speaker: "bot",
      text: fillVariables(step.say, customer, campaign),
      atSec: clock,
      intent: step.label,
    });

    const replies = CUSTOMER_REPLIES[step.branch];
    const reply = replies[(variant + index) % replies.length];
    clock += 2 + (index % 4);
    turns.push({
      id: `${campaign.id}-${customer.id}-t${index}-khach`,
      speaker: "khach",
      text: reply.text,
      atSec: clock,
      sentiment: reply.sentiment,
      intent: reply.intent,
    });

    stepReached = index + 1;

    // Quy tắc không làm phiền: khách yêu cầu dừng thì ghi nhận và kết thúc ngay,
    // kèm lời xin lỗi để cuộc gọi không kết thúc đột ngột.
    if (campaign.rules.autoStopOptOut && hasOptedOut(reply.text)) {
      optedOut = true;
      clock += 2;
      turns.push({
        id: `${campaign.id}-${customer.id}-t${index}-optout`,
        speaker: "bot",
        text: "Dạ em xin lỗi đã làm phiền anh/chị. Em ghi nhận và sẽ không liên hệ lại ạ.",
        atSec: clock,
        intent: "Ghi nhận không làm phiền",
      });
      stoppedEarly = true;
      break;
    }

    // Khách từ chối giữa cuộc gọi thì dừng ngay, không đọc các bước sau.
    if (reply.intent === "Từ chối") {
      // Quy tắc chuyển nhân viên: phản hồi tiêu cực được nối máy thay vì kết thúc.
      if (campaign.rules.escalateNegative) {
        escalated = true;
        clock += 2;
        turns.push({
          id: `${campaign.id}-${customer.id}-t${index}-escalate`,
          speaker: "bot",
          text: "Dạ em xin lỗi vì đã làm anh/chị chưa hài lòng. Em kết nối anh/chị với chuyên viên phụ trách ngay ạ.",
          atSec: clock,
          intent: "Chuyển nhân viên",
        });
      } else {
        clock += 2;
        turns.push({
          id: `${campaign.id}-${customer.id}-t${index}-end`,
          speaker: "bot",
          text: "Dạ em xin lỗi đã làm phiền anh/chị. Em chúc anh/chị một ngày tốt lành ạ.",
          atSec: clock,
          intent: "Kết thúc sớm",
        });
      }
      stoppedEarly = true;
      break;
    }
  }

  const lastBranch = campaign.script[Math.min(stepReached, campaign.script.length) - 1]?.branch ?? "ket-thuc";
  const declined = turns.some((turn) => turn.intent === "Từ chối");
  // Bị chuyển nhân viên nghĩa là cần người thật gọi lại, không phải khách từ chối hẳn.
  const outcome: CallbotResult["outcome"] = escalated
    ? "hen-goi-lai"
    : declined || optedOut
      ? "tu-choi"
      : OUTCOME_BY_BRANCH[lastBranch];

  const customerTurns = turns.filter((turn) => turn.speaker === "khach");
  const positive = customerTurns.filter((turn) => turn.sentiment === "tich-cuc").length;
  const negative = customerTurns.filter((turn) => turn.sentiment === "tieu-cuc").length;
  const sentiment: CallbotResult["sentiment"] = negative > 0 ? "tieu-cuc" : positive > 0 ? "tich-cuc" : "trung-tinh";

  const durationSec = clock + 3;
  // Điểm chất lượng: đi hết kịch bản, khách tích cực và không bị từ chối.
  const completion = stepReached / Math.max(1, campaign.script.length);
  const qualityScore = Math.round(Math.min(10, completion * 7 + (sentiment === "tich-cuc" ? 2.5 : sentiment === "trung-tinh" ? 1.5 : 0.5)) * 10) / 10;

  // Quy tắc SMS xác nhận: chỉ gửi khi cuộc gọi kết thúc có xác nhận của khách.
  const smsSent = campaign.rules.sendConfirmSms && outcome === "xac-nhan";

  return {
    turns,
    outcome,
    durationSec,
    sentiment,
    stepReached,
    qualityScore,
    escalated,
    optedOut,
    smsSent,
    transcript: turns
      .filter((turn) => turn.speaker === "khach")
      .map((turn) => turn.text)
      .join(" "),
    stoppedEarly,
  };
}

/** Chuyển kết quả mô phỏng thành bản ghi để lưu vào chiến dịch. */
export function resultFromSimulation(
  campaign: CallbotCampaign,
  customer: Customer,
  simulation: SimulationOutcome,
  index: number,
): CallbotResult {
  return {
    id: `CBR-LIVE-${Date.now()}-${index}`,
    customerId: customer.id,
    outcome: simulation.outcome,
    durationSec: simulation.durationSec,
    at: new Date().toISOString(),
    transcript: simulation.transcript,
    sentiment: simulation.sentiment,
    turns: simulation.turns,
    recordingUrl: `callio://recordings/${campaign.id}/${customer.id}-${index}.wav`,
    qualityScore: simulation.qualityScore,
    stepReached: simulation.stepReached,
    blockedReason: simulation.blocked?.reason,
    escalated: simulation.escalated,
    optedOut: simulation.optedOut,
    smsSent: simulation.smsSent,
  };
}

/** Đếm số lượt khách phản hồi tiêu cực để cảnh báo chất lượng chiến dịch. */
export function countNegativeTurns(result: CallbotResult): number {
  return (result.turns ?? []).filter((turn) => turn.speaker === "khach" && turn.sentiment === "tieu-cuc").length;
}

/** Kiểm tra kịch bản có bước kết thúc hay không, tránh cuộc gọi không lối ra. */
export function hasTerminalStep(script: CallbotScriptStep[]): boolean {
  return script.some((step) => step.branch === "ket-thuc");
}

/** Tìm các biến động đang dùng trong kịch bản. */
export function variablesInScript(script: CallbotScriptStep[]): string[] {
  const found = new Set<string>();
  for (const step of script) {
    for (const match of step.say.matchAll(/\{[a-z_]+\}/g)) found.add(match[0]);
  }
  return [...found];
}

export { plain };
