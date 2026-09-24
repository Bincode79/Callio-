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
 * `variant` giúp chạy nhiều kịch bản khác nhau cho cùng một khách hàng (dùng khi
 * gọi lại hoặc khi cần kết quả khác với lần trước).
 */
export function simulateCall(
  campaign: CallbotCampaign,
  customer: Customer,
  variant = 0,
): SimulationOutcome {
  const turns: CallbotTurn[] = [];
  let clock = 0;
  let stepReached = 0;

  campaign.script.forEach((step, index) => {
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

    // Khách từ chối giữa cuộc gọi thì dừng ngay, không đọc các bước sau.
    if (reply.intent === "Từ chối") {
      clock += 2;
      turns.push({
        id: `${campaign.id}-${customer.id}-t${index}-end`,
        speaker: "bot",
        text: "Dạ em xin lỗi đã làm phiền anh/chị. Em chúc anh/chị một ngày tốt lành ạ.",
        atSec: clock,
        intent: "Kết thúc sớm",
      });
      return;
    }
  });

  const lastBranch = campaign.script[Math.min(stepReached, campaign.script.length) - 1]?.branch ?? "ket-thuc";
  const declined = turns.some((turn) => turn.intent === "Từ chối");
  const outcome: CallbotResult["outcome"] = declined ? "tu-choi" : OUTCOME_BY_BRANCH[lastBranch];

  const customerTurns = turns.filter((turn) => turn.speaker === "khach");
  const positive = customerTurns.filter((turn) => turn.sentiment === "tich-cuc").length;
  const negative = customerTurns.filter((turn) => turn.sentiment === "tieu-cuc").length;
  const sentiment: CallbotResult["sentiment"] = negative > 0 ? "tieu-cuc" : positive > 0 ? "tich-cuc" : "trung-tinh";

  const durationSec = clock + 3;
  // Điểm chất lượng: đi hết kịch bản, khách tích cực và không bị từ chối.
  const completion = stepReached / Math.max(1, campaign.script.length);
  const qualityScore = Math.round(Math.min(10, completion * 7 + (sentiment === "tich-cuc" ? 2.5 : sentiment === "trung-tinh" ? 1.5 : 0.5)) * 10) / 10;

  return {
    turns,
    outcome,
    durationSec,
    sentiment,
    stepReached,
    qualityScore,
    transcript: turns
      .filter((turn) => turn.speaker === "khach")
      .map((turn) => turn.text)
      .join(" "),
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
