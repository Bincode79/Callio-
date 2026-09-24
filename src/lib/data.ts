import { toAsciiSlug } from "./format";
import type {
  Agent,
  CallbotResult,
  CallRecord,
  CallbotCampaign,
  Channel,
  Conversation,
  Customer,
  Lead,
  LeadSource,
  MessagingCampaign,
  MessageTemplate,
  PipelineStage,
  TelesalesTask,
  Workflow,
} from "./types";

// Neo dữ liệu demo theo thời điểm hiện tại để thời gian tương đối luôn mới.
const NOW = Date.now();

function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

const rand = seeded(20260923);

function pick<T>(items: T[]): T {
  return items[Math.floor(rand() * items.length)];
}

function between(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function iso(minutesAgo: number): string {
  return new Date(NOW - minutesAgo * 60000).toISOString();
}

const owners = [
  "Nguyễn Thị Hồng Nhung",
  "Trần Quốc Bảo",
  "Lê Minh Sơn",
  "Phạm Thu Trang",
  "Đỗ Minh Hằng",
  "Vũ Đức Anh",
  "Ngô Thị Lan Anh",
  "Hoàng Văn Kiên",
];

const seedCustomers: Array<[string, string, string, LeadSource, PipelineStage, number, string]> = [
  ["Nguyễn Văn Thành", "Công ty TNHH Thành Đạt Logistics", "0912345678", "facebook", "dam-phan", 148_000_000, "Quan tâm gói tổng đài 20 agent, cần báo giá lại sau khi cân đối ngân sách quý 4."],
  ["Trần Thị Mai Anh", "Chuỗi trà sữa Mai Anh", "0987654321", "tiktok", "bao-gia", 62_400_000, "Muốn dùng Callbot nhắc lịch đặt hàng cho 8 chi nhánh."],
  ["Lê Hoàng Nam", "Bất động sản Hoàng Nam Land", "0905123456", "google", "dang-tu-van", 320_000_000, "Đội sales 35 người, cần luật chia khách và báo cáo KPI."],
  ["Phạm Thu Hà", "Phòng khám Đa khoa An Khang", "0938222111", "zalo", "thang", 96_000_000, "Đã ký hợp đồng CRM + tổng đài, đang triển khai onboarding."],
  ["Đỗ Quang Huy", "Huy Phát Furniture", "0977333444", "website", "moi", 0, "Điền form website, cần gọi lại trong 24h."],
  ["Vũ Thanh Tùng", "Tùng Anh Nội thất", "0966555777", "hotline", "bao-gia", 54_000_000, "Quan tâm gói Telesales, đang so sánh với đối thủ."],
  ["Ngô Bảo Châu", "Học viện Ngoại ngữ Bảo Châu", "0944777888", "event", "dam-phan", 210_000_000, "Cần tư vấn chiến dịch tuyển sinh đa kênh."],
  ["Hoàng Minh Tuấn", "Tuấn Minh Pharma", "0912999888", "referral", "thang", 78_000_000, "Khách giới thiệu từ An Khang, hài lòng với tổng đài."],
  ["Bùi Thị Kim Ngân", "Kim Ngân Cosmetics", "0932111222", "facebook", "dang-tu-van", 45_000_000, "Muốn chạy chiến dịch SMS chăm sóc khách hàng."],
  ["Trịnh Đức Long", "Long Thịnh Construction", "0908777666", "google", "moi", 0, "Lead mới từ Google Ads, chưa liên hệ được."],
  ["Lý Thị Thanh Vân", "Vân Anh Spa & Clinic", "0918333444", "tiktok", "bao-gia", 88_000_000, "Cần Callbot nhắc lịch hẹn cho 3 cơ sở."],
  ["Nguyễn Đình Khoa", "Khoa Nam Electronics", "0987111555", "zalo", "thua", 0, "Chọn nhà cung cấp khác do ngân sách, hẹn lại năm sau."],
  ["Đặng Thu Phương", "Phương Nam Education", "0903999000", "website", "dang-tu-van", 132_000_000, "Cần tích hợp form website về Ulead."],
  ["Trần Văn Sỹ", "Sỹ Thành Auto Parts", "0938555111", "hotline", "dam-phan", 66_000_000, "Đang đàm phán hợp đồng 12 tháng."],
  ["Phan Thị Diễm Quỳnh", "Quỳnh Anh Bakery", "0912777333", "facebook", "thang", 39_600_000, "Chốt gói Starter, upsell lên Growth sau 2 tháng."],
  ["Lâm Quốc Cường", "Cường Thịnh Real Estate", "0977888999", "google", "dang-tu-van", 420_000_000, "Đội sales lớn, cần demo riêng cho ban giám đốc."],
  ["Hồ Ngọc Bích", "Bích Ngọc Travel", "0936444222", "tiktok", "moi", 0, "Lead từ livestream, cần gọi lại buổi chiều."],
  ["Nguyễn Trung Hiếu", "Hiếu Phát Agriculture", "0915666777", "referral", "bao-gia", 74_000_000, "Quan tâm tổng đài ghi âm và báo cáo cuộc gọi."],
  ["Đoàn Thị Hồng", "Hồng Đoàn Fashion", "0948888000", "zalo", "dang-tu-van", 51_000_000, "Cần quản lý hội thoại Zalo tập trung cho 6 sale."],
  ["Tạ Minh Quân", "Quân Đạt Steel", "0968333111", "event", "dam-phan", 186_000_000, "Gặp tại hội thảo, đang xin báo giá chi tiết theo module."],
  ["Võ Thị Ngọc Hân", "Ngọc Hân Logistics", "0903666999", "facebook", "thang", 112_000_000, "Đã ký, cần đào tạo đội CSKH 15 người."],
  ["Chu Bá Khiêm", "Khiêm An Insurance", "0919444888", "google", "moi", 0, "Lead mới, cần phân loại và chia cho sales Hà Nội."],
  ["Nguyễn Thị Bích Loan", "Bích Loan Pharmacy", "0983777222", "hotline", "dang-tu-van", 28_800_000, "Quan tâm Callbot xác nhận đơn thuốc."],
  ["Trương Công Định", "Định Thành Machinery", "0939222444", "website", "bao-gia", 145_000_000, "Cần tích hợp tổng đài với ERP hiện tại."],
];

const statusForStage: Record<PipelineStage, Customer["status"]> = {
  moi: "lead",
  "dang-tu-van": "potential",
  "bao-gia": "potential",
  "dam-phan": "potential",
  thang: "customer",
  thua: "churn",
};

const channels: Channel[] = ["call", "zalo", "facebook", "email", "sms", "website", "note"];

const timelineSeeds: Record<Channel, Array<[string, string]>> = {
  call: [
    ["Cuộc gọi ra", "Tư vấn gói tổng đài, khách yêu cầu gửi báo giá qua email."],
    ["Cuộc gọi vào", "Khách gọi hỏi tiến độ triển khai và cần hỗ trợ cấu hình."],
    ["Cuộc gọi nhỡ", "Không nghe máy, đã để lại tin nhắn thoại và hẹn gọi lại."],
  ],
  zalo: [
    ["Tin nhắn Zalo", "Đã gửi bảng giá và video demo qua Zalo OA."],
    ["Tin nhắn Zalo", "Khách hỏi thêm về chính sách hoàn tiền 30 ngày."],
  ],
  facebook: [
    ["Tin nhắn Facebook", "Khách inbox từ quảng cáo, cần tư vấn gói phù hợp."],
    ["Bình luận Facebook", "Đã phản hồi bình luận về tính năng chia khách tự động."],
  ],
  email: [
    ["Email gửi đi", "Đã gửi hồ sơ năng lực và bảng so sánh gói dịch vụ."],
    ["Email nhận về", "Khách phản hồi cần bổ sung phụ lục bảo mật dữ liệu."],
  ],
  sms: [
    ["SMS Brandname", "Đã gửi tin nhắc lịch hẹn demo lúc 14h00."],
    ["SMS Brandname", "Tin xác nhận đơn hàng đã được gửi tự động."],
  ],
  website: [
    ["Form website", "Khách để lại thông tin qua form 'Đăng ký tư vấn'."],
    ["Chat website", "Khách chat trực tuyến hỏi về bản dùng thử miễn phí."],
  ],
  note: [
    ["Ghi chú nội bộ", "Quản lý đã duyệt mức chiết khấu 8% cho hợp đồng 12 tháng."],
    ["Ghi chú nội bộ", "Khách là người quyết định cuối cùng, ưu tiên follow sát."],
  ],
};

function buildTimeline(customerIndex: number, owner: string): Customer["timeline"] {
  const events: Customer["timeline"] = [];
  const count = between(4, 7);
  let minutesAgo = between(30, 200);
  for (let i = 0; i < count; i += 1) {
    const channel = i === 0 ? "website" : channels[Math.floor(rand() * 4)];
    const [title, detail] = pick(timelineSeeds[channel]);
    events.push({
      id: `ev-${customerIndex}-${i}`,
      channel,
      title,
      detail,
      at: iso(minutesAgo),
      actor: i % 3 === 0 ? "Callbot AI" : owner,
      direction: channel === "call" || channel === "note" ? "out" : rand() > 0.5 ? "in" : "out",
    });
    minutesAgo += between(240, 3200);
  }
  return events.sort((a, b) => (a.at < b.at ? 1 : -1));
}

export const customers: Customer[] = seedCustomers.map((row, index) => {
  const [name, company, phone, source, stage, value, note] = row;
  const owner = owners[index % owners.length];
  const timeline = buildTimeline(index, owner);
  const dealCount = stage === "thang" ? between(2, 4) : stage === "thua" ? 1 : between(1, 3);
  const createdAt = iso(between(4000, 60000));
  return {
    id: `KH${String(index + 1).padStart(4, "0")}`,
    code: `KH-${String(1024 + index)}`,
    name,
    company,
    phone,
    email: `${toAsciiSlug(name.split(" ").slice(-2).join("")).toLowerCase()}@${toAsciiSlug(company.split(" ").slice(-1)[0]).toLowerCase()}.vn`,
    address: pick(["Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Hải Phòng", "Bình Dương", "Cần Thơ"]),
    status: statusForStage[stage],
    source,
    owner,
    tags:
      stage === "thang"
        ? ["Khách hàng", "Upsell"]
        : stage === "thua"
          ? ["Cần chăm lại"]
          : source === "facebook" || source === "tiktok"
            ? ["Ads", "Quan tâm nhanh"]
            : ["Tiềm năng"],
    createdAt,
    lastContactAt: timeline[0]?.at ?? createdAt,
    score: stage === "thang" ? between(78, 96) : stage === "thua" ? between(12, 34) : between(45, 88),
    totalValue: value,
    dealCount,
    note,
    timeline,
    deals: Array.from({ length: dealCount }, (_, dealIndex) => ({
      id: `DEAL-${index}-${dealIndex}`,
      name: dealIndex === 0 ? `${company} - Gói ${pick(["Starter", "Growth", "Business"])}` : `Add-on ${pick(["Callbot", "SMS Brandname", "Zalo OA", "Tổng đài"])}`,
      value: Math.round(value / (dealIndex + 1)),
      stage,
      owner,
      closedAt: stage === "thang" ? iso(between(500, 4000)) : undefined,
    })),
  };
});

export const agents: Agent[] = [
  { id: "AG01", name: "Nguyễn Thị Hồng Nhung", extension: "101", team: "Tổng đài CSKH", status: "talking", callsToday: 48, talkTimeMin: 186, answerRate: 94, avatarSeed: "AG01" },
  { id: "AG02", name: "Trần Quốc Bảo", extension: "102", team: "Telesales Hà Nội", status: "online", callsToday: 62, talkTimeMin: 214, answerRate: 91, avatarSeed: "AG02" },
  { id: "AG03", name: "Lê Minh Sơn", extension: "103", team: "Telesales Hà Nội", status: "wrap-up", callsToday: 55, talkTimeMin: 172, answerRate: 88, avatarSeed: "AG03" },
  { id: "AG04", name: "Phạm Thu Trang", extension: "104", team: "Tổng đài CSKH", status: "online", callsToday: 41, talkTimeMin: 149, answerRate: 96, avatarSeed: "AG04" },
  { id: "AG05", name: "Đỗ Minh Hằng", extension: "105", team: "Telesales Miền Nam", status: "break", callsToday: 37, talkTimeMin: 128, answerRate: 84, avatarSeed: "AG05" },
  { id: "AG06", name: "Vũ Đức Anh", extension: "106", team: "Telesales Miền Nam", status: "talking", callsToday: 58, talkTimeMin: 201, answerRate: 90, avatarSeed: "AG06" },
  { id: "AG07", name: "Ngô Thị Lan Anh", extension: "107", team: "Tổng đài CSKH", status: "online", callsToday: 44, talkTimeMin: 158, answerRate: 92, avatarSeed: "AG07" },
  { id: "AG08", name: "Hoàng Văn Kiên", extension: "108", team: "Telesales Hà Nội", status: "offline", callsToday: 0, talkTimeMin: 0, answerRate: 0, avatarSeed: "AG08" },
];

const queues = ["CSKH - Khiếu nại", "CSKH - Bảo hành", "Kinh doanh - Miền Bắc", "Kinh doanh - Miền Nam", "Hotline 1900 3236"];

export const calls: CallRecord[] = Array.from({ length: 46 }, (_, index) => {
  const customer = customers[index % customers.length];
  const agent = agents[index % agents.length];
  const live = index < 5;
  const status: CallRecord["status"] = live
    ? index % 2 === 0
      ? "talking"
      : "ringing"
    : rand() > 0.22
      ? "completed"
      : "missed";
  const durationSec = live ? between(20, 240) : status === "missed" ? 0 : between(45, 900);
  return {
    id: `CALL-${2400 + index}`,
    customerId: customer.id,
    direction: index % 3 === 0 ? "inbound" : "outbound",
    status,
    agent: agent.name,
    queue: queues[index % queues.length],
    startedAt: iso(live ? between(1, 12) : between(20, 3000)),
    durationSec,
    waitSec: between(0, 45),
    recording: status === "completed",
    sentiment: status === "missed" ? "trung-tinh" : pick<CallRecord["sentiment"]>(["tich-cuc", "tich-cuc", "trung-tinh", "tieu-cuc"]),
    note:
      status === "missed"
        ? "Khách không nghe máy, hệ thống đã gửi SMS nhắc lại."
        : pick([
            "Khách quan tâm gói Growth, hẹn gửi báo giá trong ngày.",
            "Đã xử lý khiếu nại, khách hài lòng và đánh giá 5 sao.",
            "Khách cần báo giá lại theo số lượng agent thực tế.",
            "Xác nhận đơn hàng thành công, chuyển bộ phận giao vận.",
            "Tư vấn tính năng Callbot, khách hẹn demo tuần sau.",
          ]),
  };
});

export const conversations: Conversation[] = Array.from({ length: 26 }, (_, index) => {
  const customer = customers[(index * 3) % customers.length];
  const channel = pick<Channel>(["zalo", "facebook", "sms", "email", "website", "call"]);
  const status = pick<Conversation["status"]>(["moi", "dang-mo", "cho-khach", "da-xu-ly"]);
  const messageCount = between(3, 7);
  const slaMinutes = pick([15, 30, 60, 120]);
  // Hội thoại đang mở thường nằm trong hạn SLA; chỉ một số ít bị quá hạn.
  const updatedMinutesAgo =
    status === "da-xu-ly" ? between(120, 2400) : Math.max(1, Math.round(slaMinutes * (rand() > 0.78 ? between(105, 190) / 100 : between(5, 70) / 100)));
  return {
    id: `CV-${8100 + index}`,
    customerId: customer.id,
    channel,
    subject: pick([
      "Hỏi báo giá gói tổng đài",
      "Cần hỗ trợ cấu hình Callbot",
      "Khiếu nại chất lượng cuộc gọi",
      "Xác nhận đơn hàng và thời gian giao",
      "Đăng ký dùng thử 3 ngày",
      "Yêu cầu xuất hoá đơn VAT",
      "Tư vấn luật chia khách cho sales",
    ]),
    status,
    assignee: pick(owners),
    unread: status === "moi" ? between(1, 5) : 0,
    updatedAt: iso(updatedMinutesAgo),
    slaMinutes,
    messages: Array.from({ length: messageCount }, (_, messageIndex) => ({
      id: `MSG-${index}-${messageIndex}`,
      direction: messageIndex % 2 === 0 ? "in" : "out",
      body: pick([
        "Chào anh/chị, em đang tìm hiểu phần mềm cho đội sales 20 người.",
        "Dạ em gửi anh/chị bảng giá và video demo, anh/chị xem qua giúp em nhé.",
        "Bên mình có hỗ trợ tích hợp tổng đài với CRM sẵn có không ạ?",
        "Có anh/chị, Callio hỗ trợ API và webhook để đồng bộ hai chiều.",
        "Cho em xin thêm thông tin về chính sách hoàn tiền ạ.",
        "Dạ bên em cam kết hoàn tiền trong 30 ngày nếu không hài lòng.",
        "Em muốn đặt lịch demo trực tiếp cho ban giám đốc tuần này.",
      ]),
      at: iso(updatedMinutesAgo + (messageCount - messageIndex) * 12),
      sender: messageIndex % 2 === 0 ? customer.name : pick(owners),
    })),
  };
});

export const callbotCampaigns: CallbotCampaign[] = [
  {
    id: "CB01",
    name: "Xác nhận đơn hàng tháng 9",
    goal: "xac-nhan-don",
    status: "dang-chay",
    voice: "Giọng nữ miền Bắc - Linh An",
    total: 4200,
    connected: 3186,
    confirmed: 2415,
    rejected: 318,
    callback: 453,
    startDate: "2026-09-18",
    windowStart: "08:30",
    windowEnd: "20:00",
    concurrency: 30,
    retry: 2,
    rules: { quietHours: true, autoStopOptOut: true, escalateNegative: true, sendConfirmSms: true, syncToCrm: true },
    script: [
      { id: "S1", label: "Chào hỏi", say: "Dạ em chào anh/chị, em gọi từ Callio về đơn hàng mã {ma_don}.", expect: "Khách lên tiếng xác nhận đang nghe máy", branch: "tiep-tuc" },
      { id: "S2", label: "Xác nhận đơn", say: "Đơn hàng của mình gồm {san_pham}, dự kiến giao ngày {ngay_giao}. Anh/chị xác nhận giúp em đúng không ạ?", expect: "Có / Không", branch: "xac-nhan" },
      { id: "S3", label: "Xử lý thay đổi", say: "Dạ nếu cần đổi địa chỉ hoặc thời gian giao, em kết nối anh/chị với nhân viên hỗ trợ nhé.", expect: "Đồng ý kết nối", branch: "chuyen-nhan-vien" },
      { id: "S4", label: "Kết thúc", say: "Dạ em cảm ơn anh/chị, chúc anh/chị một ngày tốt lành.", expect: "Khách kết thúc cuộc gọi", branch: "ket-thuc" },
    ],
    results: Array.from({ length: 10 }, (_, index) => ({
      id: `CBR-${index}`,
      customerId: customers[index % customers.length].id,
      outcome: pick<CallbotResult["outcome"]>(["xac-nhan", "xac-nhan", "hen-goi-lai", "tu-choi", "khong-nghe"]),
      durationSec: between(28, 145),
      at: iso(between(5, 900)),
      transcript: pick([
        "Khách xác nhận đơn, yêu cầu giao buổi sáng.",
        "Khách bận, hẹn gọi lại sau 18h.",
        "Khách muốn đổi địa chỉ nhận hàng sang văn phòng.",
        "Khách không nghe máy, hệ thống sẽ thử lại lần 2.",
      ]),
      sentiment: pick<CallbotResult["sentiment"]>(["tich-cuc", "tich-cuc", "trung-tinh", "tieu-cuc"]),
    })),
  },
  {
    id: "CB02",
    name: "Nhắc lịch hẹn demo tháng 9",
    goal: "nhac-lich",
    status: "dang-chay",
    voice: "Giọng nam miền Nam - Minh Khang",
    total: 1860,
    connected: 1425,
    confirmed: 1108,
    rejected: 96,
    callback: 221,
    startDate: "2026-09-20",
    windowStart: "09:00",
    windowEnd: "18:30",
    concurrency: 20,
    retry: 3,
    rules: { quietHours: true, autoStopOptOut: true, escalateNegative: false, sendConfirmSms: true, syncToCrm: true },
    script: [
      { id: "S1", label: "Chào hỏi", say: "Dạ em chào anh/chị, em gọi từ Callio để nhắc lịch hẹn demo.", expect: "Khách nghe máy", branch: "tiep-tuc" },
      { id: "S2", label: "Nhắc lịch", say: "Lịch demo của mình vào {gio_hen} ngày {ngay_hen} với chuyên viên {ten_sale}. Anh/chị sắp xếp tham dự được không ạ?", expect: "Có / Không / Đổi lịch", branch: "xac-nhan" },
      { id: "S3", label: "Kết thúc", say: "Dạ em cảm ơn anh/chị, hẹn gặp lại anh/chị trong buổi demo.", expect: "Khách kết thúc", branch: "ket-thuc" },
    ],
    results: Array.from({ length: 8 }, (_, index) => ({
      id: `CBR-B${index}`,
      customerId: customers[(index + 5) % customers.length].id,
      outcome: pick<CallbotResult["outcome"]>(["xac-nhan", "hen-goi-lai", "xac-nhan", "gap-may"]),
      durationSec: between(22, 90),
      at: iso(between(5, 700)),
      transcript: pick([
        "Khách xác nhận tham dự demo.",
        "Khách yêu cầu dời sang 15h cùng ngày.",
        "Thuê bao không liên lạc được.",
      ]),
      sentiment: pick<CallbotResult["sentiment"]>(["tich-cuc", "trung-tinh", "tich-cuc"]),
    })),
  },
  {
    id: "CB03",
    name: "Khảo sát hài lòng sau mua",
    goal: "khao-sat",
    status: "tam-dung",
    voice: "Giọng nữ miền Nam - Thuỳ Dương",
    total: 950,
    connected: 612,
    confirmed: 388,
    rejected: 74,
    callback: 150,
    startDate: "2026-09-12",
    windowStart: "14:00",
    windowEnd: "20:00",
    concurrency: 12,
    retry: 1,
    // Chiến dịch khảo sát chỉ thu thập ý kiến, không ghi vào hành trình CRM.
    rules: { quietHours: true, autoStopOptOut: true, escalateNegative: false, sendConfirmSms: false, syncToCrm: false },
    script: [
      { id: "S1", label: "Chào hỏi", say: "Dạ em chào anh/chị, em gọi để khảo sát mức độ hài lòng sau khi mua hàng.", expect: "Khách nghe máy", branch: "tiep-tuc" },
      { id: "S2", label: "Khảo sát", say: "Trên thang điểm 1 đến 5, anh/chị đánh giá dịch vụ bên em mấy điểm ạ?", expect: "Số từ 1-5", branch: "xac-nhan" },
      { id: "S3", label: "Kết thúc", say: "Dạ em cảm ơn đánh giá của anh/chị, em xin phép kết thúc cuộc gọi.", expect: "Khách kết thúc", branch: "ket-thuc" },
    ],
    results: Array.from({ length: 6 }, (_, index) => ({
      id: `CBR-C${index}`,
      customerId: customers[(index + 11) % customers.length].id,
      outcome: pick<CallbotResult["outcome"]>(["xac-nhan", "tu-choi", "hen-goi-lai"]),
      durationSec: between(30, 120),
      at: iso(between(500, 4000)),
      transcript: pick(["Khách đánh giá 5 điểm.", "Khách từ chối trả lời khảo sát.", "Khách hẹn gọi lại sau."]),
      sentiment: pick<CallbotResult["sentiment"]>(["tich-cuc", "trung-tinh", "tieu-cuc"]),
    })),
  },
];

export const telesalesTasks: TelesalesTask[] = Array.from({ length: 22 }, (_, index) => {
  const customer = customers[(index * 5) % customers.length];
  const done = index > 13;
  return {
    id: `TS-${500 + index}`,
    customerId: customer.id,
    listName: pick(["Data Ads tháng 9", "Khách cũ cần chăm lại", "Lead hội thảo", "Khách dùng thử hết hạn", "Data sự kiện SME"]),
    priority: pick<TelesalesTask["priority"]>(["cao", "cao", "trung-binh", "thap"]),
    attempts: between(0, 3),
    lastResult: pick(["Chưa liên hệ", "Không nghe máy", "Đã gửi báo giá", "Hẹn gọi lại", "Quan tâm gói Growth"]),
    dueAt: iso(done ? -between(60, 600) : between(10, 480)),
    script:
      index % 3 === 0
        ? "Xác nhận nhu cầu → gửi báo giá → hẹn demo"
        : index % 3 === 1
          ? "Chăm sóc khách cũ → upsell Callbot"
          : "Xác nhận đơn hàng → chốt thời gian giao",
    done,
    outcome: done ? pick<NonNullable<TelesalesTask["outcome"]>>(["chot-don", "hen-lai", "tu-choi", "khong-nghe-may"]) : undefined,
  };
});

export const messageTemplates: MessageTemplate[] = [
  { id: "T01", name: "Chào mừng khách mới", channel: "zalo", category: "cham-soc", body: "Dạ Callio xin chào anh/chị {ten_khach}. Em là {ten_sale}, chuyên viên tư vấn của anh/chị. Anh/chị cho em xin 5 phút trao đổi về nhu cầu quản lý khách hàng nhé!", usageCount: 4820, updatedAt: iso(between(200, 5000)) },
  { id: "T02", name: "Nhắc lịch hẹn", channel: "sms", category: "nhac-hen", body: "Callio nhắc anh/chị {ten_khach} có lịch hẹn {gio_hen} ngày {ngay_hen}. Vui lòng phản hồi XACNHAN để xác nhận hoặc DOI để đổi lịch.", usageCount: 3120, updatedAt: iso(between(200, 5000)) },
  { id: "T03", name: "Xác nhận đơn hàng", channel: "sms", category: "giao-dich", body: "Don hang {ma_don} cua anh/chi {ten_khach} da duoc xac nhan, giao ngay {ngay_giao}. Hotline 1900 3236.", usageCount: 6890, updatedAt: iso(between(200, 5000)) },
  { id: "T04", name: "Khuyến mãi tháng 9", channel: "zalo", category: "marketing", body: "{ten_khach} ơi, Callio giảm 30% gói Growth khi đăng ký trước 30/09. Ưu đãi chỉ áp dụng cho {so_luong} khách đăng ký sớm nhất!", usageCount: 2450, updatedAt: iso(between(200, 5000)) },
  { id: "T05", name: "Chăm sóc sau mua", channel: "email", category: "cham-soc", body: "Kính gửi anh/chị {ten_khach}, cảm ơn anh/chị đã tin chọn Callio. Đội ngũ CSKH sẽ liên hệ trong 24h để hỗ trợ cấu hình.", usageCount: 1780, updatedAt: iso(between(200, 5000)) },
  { id: "T06", name: "Nhắc thanh toán", channel: "email", category: "giao-dich", body: "Kính gửi anh/chị {ten_khach}, hoá đơn {ma_hoa_don} đến hạn ngày {ngay_hen}. Anh/chị vui lòng thanh toán để dịch vụ không bị gián đoạn.", usageCount: 940, updatedAt: iso(between(200, 5000)) },
  { id: "T07", name: "Mời hội thảo", channel: "facebook", category: "marketing", body: "Callio mời anh/chị tham dự hội thảo 'Tăng 30% hiệu suất telesales' lúc 14h00 ngày 05/10. Đăng ký ngay để nhận tài liệu độc quyền!", usageCount: 1260, updatedAt: iso(between(200, 5000)) },
];

export const messagingCampaigns: MessagingCampaign[] = [
  { id: "MC01", name: "Chúc mừng sinh nhật khách hàng", channel: "zalo", status: "dang-chay", audience: "Khách hàng có sinh nhật trong tháng", templateId: "T01", sent: 8420, delivered: 8291, opened: 6712, replied: 1184, failed: 129, scheduledAt: "2026-09-01T08:00:00+07:00", brandname: "Callio OA" },
  { id: "MC02", name: "Nhắc lịch hẹn demo tuần 39", channel: "sms", status: "dang-chay", audience: "Lead đã đặt lịch demo", templateId: "T02", sent: 1860, delivered: 1802, opened: 1640, replied: 522, failed: 58, scheduledAt: "2026-09-22T09:00:00+07:00", brandname: "CALLIO" },
  { id: "MC03", name: "Flash sale gói Growth 30%", channel: "zalo", status: "hoan-thanh", audience: "Lead tiềm năng chưa chốt", templateId: "T04", sent: 12400, delivered: 12108, opened: 8934, replied: 2140, failed: 292, scheduledAt: "2026-09-15T10:00:00+07:00", brandname: "Callio OA" },
  { id: "MC04", name: "Chăm sóc sau mua - lô 9", channel: "email", status: "hoan-thanh", audience: "Khách đã ký trong tháng 9", templateId: "T05", sent: 386, delivered: 381, opened: 302, replied: 96, failed: 5, scheduledAt: "2026-09-18T08:30:00+07:00", brandname: "support@callio.vn" },
  { id: "MC05", name: "Mời hội thảo SME tháng 10", channel: "facebook", status: "nhap", audience: "Lead từ hội thảo SME", templateId: "T07", sent: 0, delivered: 0, opened: 0, replied: 0, failed: 0, scheduledAt: "2026-10-01T09:00:00+07:00", brandname: "Callio Page" },
  { id: "MC06", name: "Nhắc thanh toán kỳ 3", channel: "email", status: "tam-dung", audience: "Khách hàng đến hạn thanh toán", templateId: "T06", sent: 214, delivered: 210, opened: 176, replied: 44, failed: 4, scheduledAt: "2026-09-20T07:30:00+07:00", brandname: "billing@callio.vn" },
];

const leadNames = [
  "Nguyễn Hải Yến", "Trần Đình Trọng", "Lê Ngọc Mai", "Phạm Văn Lâm", "Đỗ Thị Quyên",
  "Vũ Hoàng Phúc", "Ngô Thanh Hà", "Hoàng Gia Bảo", "Bùi Khánh Linh", "Trịnh Văn Đạt",
  "Lý Thuỳ Chi", "Đặng Quốc Khánh", "Trần Bảo Ngọc", "Nguyễn Đức Thắng", "Phan Mỹ Tâm",
  "Hồ Nhật Minh", "Đoàn Thị Yến", "Tạ Văn Hùng", "Chu Thị Hạnh", "Võ Minh Triết",
];

export const leads: Lead[] = leadNames.map((name, index) => {
  const source = pick<LeadSource>(["facebook", "google", "tiktok", "zalo", "website", "hotline", "referral", "event"]);
  const status = pick<Lead["status"]>(["moi", "moi", "da-phan-loai", "da-chia", "trung", "loai"]);
  return {
    id: `LD${String(9021 + index)}`,
    name,
    phone: `09${between(10000000, 99999999)}`,
    email: `${toAsciiSlug(name.split(" ").slice(-2).join("")).toLowerCase()}@gmail.com`,
    source,
    campaign: pick(["Callio_LeadGen_Sep", "Retarget_TikTok", "Search_Brand_VN", "HoiThao_SME_Q3", "Zalo_OA_Form"]),
    score: between(18, 97),
    status,
    receivedAt: iso(between(2, 4300)),
    assignedTo: status === "da-chia" ? pick(owners) : undefined,
    duplicate: status === "trung",
    note: pick([
      "Điền form, quan tâm gói tổng đài.",
      "Đã chat website, cần gọi lại trong 30 phút.",
      "Trùng số với khách hàng đã có.",
      "Ngoài tệp khách hàng mục tiêu.",
      "Lead chất lượng cao, ưu tiên chia cho sales HN.",
    ]),
  };
});

export const workflows: Workflow[] = [
  {
    id: "WF01",
    name: "Chia lead Ads tự động cho sales",
    status: "dang-chay",
    trigger: "Lead mới từ Facebook / Google Ads",
    runsToday: 486,
    successRate: 97.4,
    owner: "Nguyễn Thị Hồng Nhung",
    updatedAt: iso(between(20, 600)),
    nodes: [
      { id: "n1", type: "trigger", title: "Lead mới từ Ads", detail: "Webhook từ Facebook Lead Ads", x: 60, y: 40 },
      { id: "n2", type: "condition", title: "Kiểm tra trùng số", detail: "So khớp với CRM hiện có", x: 340, y: 40 },
      { id: "n3", type: "action", title: "Chấm điểm lead", detail: "AI scoring theo hành vi + nguồn", x: 620, y: 40 },
      { id: "n4", type: "condition", title: "Điểm >= 70?", detail: "Lead nóng thì chia ngay", x: 620, y: 210 },
      { id: "n5", type: "action", title: "Chia cho sales HN/HCM", detail: "Round-robin theo khu vực", x: 340, y: 210 },
      { id: "n6", type: "delay", title: "Chờ 30 phút", detail: "Nếu chưa liên hệ thì nhắc", x: 60, y: 210 },
      { id: "n7", type: "action", title: "Gửi SMS chào mừng", detail: "Template T01 qua Zalo OA", x: 340, y: 370 },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3", label: "Không trùng" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5", label: "Có" },
      { from: "n4", to: "n6", label: "Không" },
      { from: "n5", to: "n7" },
      { from: "n6", to: "n5" },
    ],
  },
  {
    id: "WF02",
    name: "Nhắc chăm sóc khách hàng định kỳ",
    status: "dang-chay",
    trigger: "Không tương tác 30 ngày",
    runsToday: 132,
    successRate: 92.1,
    owner: "Trần Quốc Bảo",
    updatedAt: iso(between(20, 600)),
    nodes: [
      { id: "m1", type: "trigger", title: "Không tương tác 30 ngày", detail: "Quét toàn bộ khách đang giao dịch", x: 60, y: 40 },
      { id: "m2", type: "action", title: "Tạo việc cho sale", detail: "Giao task chăm sóc cho owner", x: 340, y: 40 },
      { id: "m3", type: "delay", title: "Chờ 2 ngày", detail: "Đợi sale cập nhật kết quả", x: 620, y: 40 },
      { id: "m4", type: "condition", title: "Sale đã liên hệ?", detail: "Kiểm tra log hoạt động", x: 620, y: 210 },
      { id: "m5", type: "action", title: "Nhắc trưởng nhóm", detail: "Thông báo Zalo cho quản lý", x: 340, y: 210 },
    ],
    edges: [
      { from: "m1", to: "m2" },
      { from: "m2", to: "m3" },
      { from: "m3", to: "m4" },
      { from: "m4", to: "m5", label: "Chưa" },
    ],
  },
  {
    id: "WF03",
    name: "Callbot xác nhận đơn và cập nhật CRM",
    status: "dang-chay",
    trigger: "Đơn hàng mới tạo trên hệ thống",
    runsToday: 318,
    successRate: 89.6,
    owner: "Lê Minh Sơn",
    updatedAt: iso(between(20, 600)),
    nodes: [
      { id: "p1", type: "trigger", title: "Đơn hàng mới", detail: "Từ ERP hoặc sàn TMĐT", x: 60, y: 40 },
      { id: "p2", type: "action", title: "Gọi Callbot xác nhận", detail: "Campaign CB01 - giọng Linh An", x: 340, y: 40 },
      { id: "p3", type: "condition", title: "Khách xác nhận?", detail: "Phân tích kết quả cuộc gọi", x: 620, y: 40 },
      { id: "p4", type: "action", title: "Cập nhật trạng thái đơn", detail: "Đẩy sang bộ phận giao vận", x: 620, y: 210 },
      { id: "p5", type: "action", title: "Tạo task gọi lại", detail: "Chia cho telesales phụ trách", x: 340, y: 210 },
    ],
    edges: [
      { from: "p1", to: "p2" },
      { from: "p2", to: "p3" },
      { from: "p3", to: "p4", label: "Có" },
      { from: "p3", to: "p5", label: "Không" },
    ],
  },
  {
    id: "WF04",
    name: "Upsell khách hàng trung thành",
    status: "ban-nhap",
    trigger: "Khách đạt 3 đơn thành công",
    runsToday: 0,
    successRate: 0,
    owner: "Phạm Thu Trang",
    updatedAt: iso(between(20, 600)),
    nodes: [
      { id: "q1", type: "trigger", title: "Đủ 3 đơn thành công", detail: "Theo dõi lịch sử giao dịch", x: 60, y: 40 },
      { id: "q2", type: "action", title: "Gửi ưu đãi upsell", detail: "Template T04 qua Zalo OA", x: 340, y: 40 },
      { id: "q3", type: "delay", title: "Chờ 3 ngày", detail: "Theo dõi phản hồi", x: 620, y: 40 },
    ],
    edges: [
      { from: "q1", to: "q2" },
      { from: "q2", to: "q3" },
    ],
  },
];

export function customerById(id: string): Customer | undefined {
  return customers.find((item) => item.id === id);
}
