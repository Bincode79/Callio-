import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp, CALLBOT_RULE_LABELS } from "../lib/store";
import {
  callbotGoalMeta,
  callbotOutcomeMeta,
  campaignStatusMeta,
  formatDuration,
  formatNumber,
  formatPercent,
  relativeTime,
  sentimentMeta,
} from "../lib/format";
import { fillVariables, hasTerminalStep, isWithinWindow, resultFromSimulation, simulateCall, variablesInScript } from "../lib/callbot";
import { PageHeader } from "../components/AppShell";
import {
  Avatar,
  Badge,
  BarChart,
  Button,
  Card,
  CardHeader,
  DataTable,
  Donut,
  EmptyState,
  KeyValue,
  Metric,
  Modal,
  ProgressBar,
  SearchInput,
  StatCard,
  Tabs,
} from "../components/ui";
import {
  IconCheck,
  IconClock,
  IconClose,
  IconMic,
  IconPause,
  IconPhone,
  IconPlay,
  IconPlus,
  IconRobot,
  IconSparkle,
  IconUsers,
} from "../components/icons";
import type { CallbotCampaign, CallbotResult, CallbotScriptStep } from "../lib/types";
import { buildSpeechSegments, parseVoiceLabel, pickVoice, useSpeech, useSpeechRecognition } from "../lib/speech";
import { voiceSourceLabel, voiceApiToken, setVoiceApiToken } from "../lib/voiceApi";
import { classifyCustomerReply, type ReplyIntent } from "../lib/callbot";

const VOICE_BARS = Array.from({ length: 26 }, (_, seed) => ({ id: `voice-${seed}`, seed }));

const VOICES = [
  "Giọng nữ miền Bắc - Linh An",
  "Giọng nam miền Bắc - Đức Thịnh",
  "Giọng nữ miền Nam - Thuỳ Dương",
  "Giọng nam miền Nam - Minh Khang",
];

const BRANCH_OPTIONS: Array<{ value: CallbotScriptStep["branch"]; label: string }> = [
  { value: "tiep-tuc", label: "Tiếp tục bước sau" },
  { value: "xac-nhan", label: "Ghi nhận xác nhận của khách" },
  { value: "chuyen-nhan-vien", label: "Chuyển sang nhân viên thật" },
  { value: "ket-thuc", label: "Kết thúc cuộc gọi" },
];

// Khai báo tường minh để `Object.keys` không làm mất kiểu khoá của CallbotRules.
const CALLBOT_RULE_KEYS = ["quietHours", "autoStopOptOut", "escalateNegative", "sendConfirmSms", "syncToCrm"] as const;

// Các lượt nói sinh ra do quy tắc vận hành can thiệp, được đánh dấu riêng trong
// hội thoại để người dùng phân biệt với lời thoại theo kịch bản.
const RULE_TURN_INTENTS = new Set(["Chuyển nhân viên", "Ghi nhận không làm phiền"]);

export function CallbotPage() {
  const { state, dispatch } = useApp();
  const [selectedId, setSelectedId] = useState(state.callbotCampaigns[0]?.id ?? "");
  const [tab, setTab] = useState("kich-ban");
  const [resultQuery, setResultQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceTokenDraft, setVoiceTokenDraft] = useState(() => voiceApiToken());
  const [playing, setPlaying] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [editingStep, setEditingStep] = useState<CallbotScriptStep | undefined>();
  const [detailResult, setDetailResult] = useState<CallbotResult | undefined>();
  const [simCustomerId, setSimCustomerId] = useState(state.customers[0]?.id ?? "");
  const [simTurns, setSimTurns] = useState<ReturnType<typeof simulateCall>["turns"]>([]);
  const [simRunning, setSimRunning] = useState(false);
  const [simVariant, setSimVariant] = useState(0);
  // Câu khách nói thật qua micro, theo chỉ số bước. Bước chưa nói thì engine dùng
  // lời mẫu, nên không cần điền đủ.
  const [spokenReplies, setSpokenReplies] = useState<string[]>([]);
  const [draft, setDraft] = useState({
    name: "",
    goal: "xac-nhan-don" as CallbotCampaign["goal"],
    voice: VOICES[0],
    total: 1000,
    windowStart: "08:30",
    windowEnd: "20:00",
    concurrency: 20,
    retry: 2,
  });
  const simTimer = useRef<number | undefined>(undefined);

  const campaign = state.callbotCampaigns.find((item) => item.id === selectedId) ?? state.callbotCampaigns[0];
  // Truyền nhãn giọng để backend tự ánh xạ sang giọng tiếng Việt thật.
  const speech = useSpeech(campaign?.voice);
  const recognition = useSpeechRecognition();
  const customerName = useCallback(
    (id: string) => state.customers.find((customer) => customer.id === id)?.name ?? "Khách hàng",
    [state.customers],
  );

  const simCustomer = state.customers.find((customer) => customer.id === simCustomerId) ?? state.customers[0];

  // Nghe thử dùng giọng thật của trình duyệt (Web Speech API). Nếu máy không có
  // giọng tiếng Việt, giao diện vẫn cho nghe bằng giọng sẵn có và nói rõ tên giọng.
  const voiceProfile = useMemo(() => parseVoiceLabel(campaign?.voice ?? ""), [campaign?.voice]);

  const speakStep = useCallback(
    (step: CallbotScriptStep) => {
      const segments = buildSpeechSegments([step], simCustomer, campaign);
      const first = segments[0];
      if (!first) {
        dispatch({ type: "toast", message: `Bước "${step.label}" chưa có lời thoại để đọc`, tone: "warn" });
        return;
      }
      if (!speech.speak(first.text, voiceProfile, step.id)) {
        dispatch({ type: "toast", message: "Trình duyệt không hỗ trợ đọc tiếng nói", tone: "warn" });
        return;
      }
      setPlaying(true);
      dispatch({ type: "toast", message: `Đang nghe thử bước "${step.label}" với giọng ${campaign.voice}`, tone: "info" });
    },
    [simCustomer, campaign, voiceProfile, speech, dispatch],
  );

  const speakWholeScript = useCallback(() => {
    const segments = buildSpeechSegments(campaign.script, simCustomer, campaign);
    if (segments.length === 0) {
      dispatch({ type: "toast", message: "Kịch bản chưa có lời thoại để đọc", tone: "warn" });
      return;
    }
    if (!speech.speakSegments(segments, voiceProfile, "toan-bo", setStepIndex)) {
      dispatch({ type: "toast", message: "Trình duyệt không hỗ trợ đọc tiếng nói", tone: "warn" });
      return;
    }
    setPlaying(true);
    dispatch({ type: "toast", message: "Đang phát thử kịch bản bằng giọng thật", tone: "info" });
  }, [campaign, simCustomer, voiceProfile, speech, dispatch]);

  const stopSpeaking = useCallback(() => {
    speech.stop();
    setPlaying(false);
    dispatch({ type: "toast", message: "Đã dừng nghe thử", tone: "info" });
  }, [speech, dispatch]);

  // Đọc xong thì tự hạ cờ phát để nút trở lại trạng thái "Nghe thử".
  useEffect(() => {
    if (speech.speakingId === null) setPlaying(false);
  }, [speech.speakingId]);

  // Dừng bộ đếm mô phỏng khi rời trang để không rò rỉ timer.
  useEffect(() => () => window.clearInterval(simTimer.current), []);

  // Chiến dịch mới (tạo hoặc nhân bản) được chèn lên đầu danh sách; tự chọn nó để
  // người dùng thấy ngay kết quả thay vì phải bấm vào danh sách.
  const campaignCount = state.callbotCampaigns.length;
  const previousCount = useRef(campaignCount);
  useEffect(() => {
    if (campaignCount > previousCount.current && state.callbotCampaigns[0]) {
      setSelectedId(state.callbotCampaigns[0].id);
    }
    previousCount.current = campaignCount;
  }, [campaignCount, state.callbotCampaigns]);

  const totals = useMemo(
    () =>
      state.callbotCampaigns.reduce(
        (acc, item) => ({
          total: acc.total + item.total,
          connected: acc.connected + item.connected,
          confirmed: acc.confirmed + item.confirmed,
          rejected: acc.rejected + item.rejected,
          callback: acc.callback + item.callback,
        }),
        { total: 0, connected: 0, confirmed: 0, rejected: 0, callback: 0 },
      ),
    [state.callbotCampaigns],
  );

  const filteredResults = useMemo(
    () =>
      (campaign?.results ?? []).filter(
        (result) =>
          resultQuery.trim() === "" ||
          [customerName(result.customerId), result.transcript, result.outcome].join(" ").toLowerCase().includes(resultQuery.toLowerCase()),
      ),
    [campaign, resultQuery, customerName],
  );

  const hourly = Array.from({ length: 12 }, (_, index) => {
    const hour = 8 + index;
    const base = index < 2 || index > 9 ? 120 : 280;
    return {
      label: `${String(hour).padStart(2, "0")}h`,
      values: [base + ((index * 37) % 90), Math.round((base + ((index * 21) % 60)) * 0.72), Math.round(base * 0.18)],
    };
  });

  /** Chạy mô phỏng: hiện dần từng lượt nói để mô phỏng cuộc gọi thật. */
  const runSimulation = useCallback(() => {
    if (!campaign || !simCustomer) return;
    window.clearInterval(simTimer.current);

    // Câu trả lời thật người dùng đã nói qua micro được đưa vào engine; chỗ nào
    // chưa nói thì engine dùng lời mẫu như trước.
    const simulation = simulateCall(campaign, simCustomer, simVariant, spokenReplies);
    setSimTurns([]);

    // Cuộc gọi bị quy tắc khung giờ chặn thì không có hội thoại để diễn; ghi
    // nhận ngay để người dùng thấy lý do thay vì màn hình trống.
    if (simulation.blocked) {
      setSimRunning(false);
      dispatch({
        type: "recordCallResult",
        campaignId: campaign.id,
        result: resultFromSimulation(campaign, simCustomer, simulation, 0),
      });
      return;
    }

    setSimRunning(true);
    let shown = 0;
    simTimer.current = window.setInterval(() => {
      shown += 1;
      setSimTurns(simulation.turns.slice(0, shown));
      if (shown >= simulation.turns.length) {
        window.clearInterval(simTimer.current);
        setSimRunning(false);
        dispatch({
          type: "recordCallResult",
          campaignId: campaign.id,
          result: resultFromSimulation(campaign, simCustomer, simulation, shown),
        });
      }
    }, 700);
  }, [campaign, simCustomer, simVariant, spokenReplies, dispatch]);

  const stopSimulation = useCallback(() => {
    window.clearInterval(simTimer.current);
    setSimRunning(false);
  }, []);

  // Bước kế tiếp sẽ nhận câu trả lời thật: bằng số câu đã nói.
  const nextReplyStep = spokenReplies.length;

  const startSpokenReply = useCallback(() => {
    if (!recognition.backend && !recognition.supported) {
      dispatch({ type: "toast", message: "Không có cách ghi âm: máy chủ chưa chạy và trình duyệt không hỗ trợ", tone: "warn" });
      return;
    }
    if (nextReplyStep >= campaign.script.length) {
      dispatch({ type: "toast", message: "Kịch bản đã hết bước để trả lời", tone: "warn" });
      return;
    }
    speech.stop();
    setPlaying(false);
    recognition.start();
    dispatch({ type: "toast", message: `Hãy nói câu trả lời cho bước ${nextReplyStep + 1}`, tone: "info" });
  }, [recognition, nextReplyStep, campaign.script.length, speech, dispatch]);

  // Khi nhận diện xong một câu thì lưu vào đúng bước để lần chạy kế tiếp dùng câu
  // nói thật thay cho lời mẫu.
  const lastCaptured = useRef<string>("");
  useEffect(() => {
    const text = recognition.transcript.trim();
    if (text === "" || text === lastCaptured.current || recognition.listening) return;
    lastCaptured.current = text;
    setSpokenReplies((current) => {
      const next = [...current];
      next[current.length] = text;
      return next;
    });
    dispatch({ type: "toast", message: `Đã ghi nhận câu trả lời: “${text}”`, tone: "success" });
  }, [recognition.transcript, recognition.listening, dispatch]);

  useEffect(() => {
    if (recognition.error === "not-allowed" || recognition.error === "service-not-allowed") {
      dispatch({ type: "toast", message: "Chưa được cấp quyền micro cho trang này", tone: "warn" });
    } else if (recognition.error === "no-speech") {
      dispatch({ type: "toast", message: "Không nghe thấy giọng nói, thử lại giúp tôi", tone: "warn" });
    }
  }, [recognition.error, dispatch]);

  const scriptIssues = useMemo(() => {
    if (!campaign) return [] as string[];
    const issues: string[] = [];
    if (campaign.script.length === 0) issues.push("Kịch bản đang trống, trợ lý ảo chưa có gì để nói.");
    if (campaign.script.length > 0 && !hasTerminalStep(campaign.script)) issues.push("Kịch bản thiếu bước kết thúc, cuộc gọi sẽ không có lối ra.");
    const emptySay = campaign.script.filter((step) => step.say.trim() === "");
    if (emptySay.length > 0) issues.push(`${emptySay.length} bước chưa có lời thoại.`);
    return issues;
  }, [campaign]);

  const previewSay = campaign && simCustomer && campaign.script[stepIndex] ? fillVariables(campaign.script[stepIndex].say, simCustomer, campaign) : "";

  // Cho biết trước cuộc gọi có bị quy tắc khung giờ chặn hay không, thay vì để
  // người dùng bấm rồi mới biết.
  const outsideWindow = Boolean(campaign?.rules.quietHours) && campaign ? !isWithinWindow(campaign.windowStart, campaign.windowEnd) : false;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Callbot AI"
        title="Trợ lý ảo gọi tự động"
        description="Thiết lập kịch bản, giọng đọc và lịch gọi tự động để xác nhận đơn hàng, nhắc lịch hẹn hoặc tư vấn khách hàng mà không cần nhân viên trực."
        actions={
          <>
            <Badge label={`${state.callbotCampaigns.filter((item) => item.status === "dang-chay").length} chiến dịch đang chạy`} color="#15803d" bg="#e7f7ec" />
            <Button variant="gold" onClick={() => setCreateOpen(true)}>
              <IconPlus size={16} /> Tạo chiến dịch
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tổng cuộc gọi AI" value={formatNumber(totals.connected)} accent="#0f8b98" icon={<IconRobot size={20} />} hint={`Trên ${formatNumber(totals.total)} số trong tệp`} />
        <StatCard label="Khách xác nhận" value={formatNumber(totals.confirmed)} accent="#15803d" icon={<IconCheck size={20} />} hint={`Tỉ lệ ${formatPercent((totals.confirmed / Math.max(1, totals.connected)) * 100, 1)}`} />
        <StatCard label="Cần gọi lại" value={formatNumber(totals.callback)} accent="#b45309" icon={<IconClock size={20} />} hint="Hệ thống tự động xếp lịch" />
        <StatCard label="Từ chối" value={formatNumber(totals.rejected)} accent="#be123c" icon={<IconPause size={20} />} hint="Đã ghi nhận lý do vào CRM" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[330px_1fr]">
        <div className="space-y-4">
          {state.callbotCampaigns.map((item) => {
            const meta = campaignStatusMeta[item.status];
            const goal = callbotGoalMeta[item.goal];
            const isActive = item.id === campaign?.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedId(item.id);
                  setStepIndex(0);
                }}
                className={`w-full rounded-3xl border p-4 text-left transition ${
                  isActive ? "border-[#0f8b98] bg-[#f2fbfc] shadow-[0_12px_35px_rgba(15,139,152,0.12)]" : "border-[#e6ebf0] bg-white hover:border-[#bfe3e8]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] font-black leading-5 text-[#111a22]">{item.name}</p>
                  <Badge label={meta.label} color={meta.color} bg={meta.bg} />
                </div>
                <p className="mt-2 text-[12px] font-bold" style={{ color: goal.color }}>
                  {goal.label}
                </p>
                <p className="mt-1.5 text-[11.5px] text-[#7b8894]">{item.voice}</p>
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center justify-between text-[11.5px] font-bold text-[#5c6a76]">
                    <span>Tiến độ gọi</span>
                    <span>
                      {formatNumber(item.connected)}/{formatNumber(item.total)}
                    </span>
                  </div>
                  <ProgressBar value={item.connected} max={item.total} color="#0f8b98" height={7} />
                </div>
                <div className="mt-3 flex items-center justify-between text-[11.5px] font-semibold text-[#8492a0]">
                  <span>Song song: {item.concurrency} luồng</span>
                  <span>Gọi lại: {item.retry} lần</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="space-y-5">
          {campaign ? (
            <>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[19px] font-black tracking-[-0.02em] text-[#111a22]">{campaign.name}</h2>
                      <Badge
                        label={campaignStatusMeta[campaign.status].label}
                        color={campaignStatusMeta[campaign.status].color}
                        bg={campaignStatusMeta[campaign.status].bg}
                      />
                    </div>
                    <p className="mt-2 text-[13px] text-[#66757f]">
                      {callbotGoalMeta[campaign.goal].label} • Khung giờ {campaign.windowStart} - {campaign.windowEnd} • Bắt đầu {campaign.startDate}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <Button
                      variant={campaign.status === "dang-chay" ? "outline" : "primary"}
                      onClick={() => dispatch({ type: "toggleCampaign", id: campaign.id })}
                    >
                      {campaign.status === "dang-chay" ? (
                        <>
                          <IconPause size={15} /> Tạm dừng
                        </>
                      ) : (
                        <>
                          <IconPlay size={15} /> Chạy chiến dịch
                        </>
                      )}
                    </Button>
                    <Button variant="gold" onClick={() => dispatch({ type: "duplicateCampaign", id: campaign.id })}>
                      <IconSparkle size={15} /> Nhân bản
                    </Button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Metric label="Tổng số" value={formatNumber(campaign.total)} />
                  <Metric label="Đã kết nối" value={formatNumber(campaign.connected)} color="#0f8b98" />
                  <Metric label="Xác nhận" value={formatNumber(campaign.confirmed)} color="#15803d" />
                  <Metric label="Hẹn gọi lại" value={formatNumber(campaign.callback)} color="#b45309" />
                  <Metric label="Từ chối" value={formatNumber(campaign.rejected)} color="#be123c" />
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_240px]">
                  <div>
                    <p className="mb-2 text-[12.5px] font-black text-[#33414d]">Lưu lượng gọi tự động theo giờ</p>
                    <BarChart data={hourly} colors={["#0f8b98", "#7cc9d2", "#f5b942"]} height={150} />
                  </div>
                  <Donut
                    size={132}
                    thickness={18}
                    centerLabel="Kết nối"
                    centerValue={formatPercent((campaign.connected / Math.max(1, campaign.total)) * 100, 0)}
                    data={[
                      { label: "Xác nhận", value: campaign.confirmed, color: "#15803d" },
                      { label: "Hẹn lại", value: campaign.callback, color: "#b45309" },
                      { label: "Từ chối", value: campaign.rejected, color: "#be123c" },
                      {
                        label: "Khác",
                        value: Math.max(1, campaign.connected - campaign.confirmed - campaign.callback - campaign.rejected),
                        color: "#94a3b8",
                      },
                    ]}
                  />
                </div>
              </Card>

              <Card>
                <CardHeader
                  title="Mô phỏng cuộc gọi trực tiếp"
                  subtitle="Chạy thử kịch bản với một khách hàng thật trong danh sách để xem trợ lý ảo nói gì và khách phản hồi ra sao"
                  action={
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        className="rounded-xl border border-[#dfe6ec] bg-white px-3 py-2 text-[12.5px] font-semibold text-[#25313d] outline-none focus:border-[#0f8b98]"
                        value={simCustomerId}
                        onChange={(event) => setSimCustomerId(event.target.value)}
                        disabled={simRunning}
                      >
                        {state.customers.slice(0, 12).map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.name}
                          </option>
                        ))}
                      </select>
                      <Button size="sm" variant="ghost" disabled={simRunning} onClick={() => setSimVariant((value) => value + 1)}>
                        Đổi tình huống
                      </Button>
                      <Button
                        size="sm"
                        variant={recognition.listening ? "danger" : "outline"}
                        onClick={() => (recognition.listening ? recognition.stop() : startSpokenReply())}
                        disabled={!recognition.backend && !recognition.supported && !recognition.listening}
                      >
                        <IconMic size={14} /> {recognition.listening ? "Đang nghe..." : "Khách nói"}
                      </Button>
                      {simRunning ? (
                        <Button size="sm" variant="outline" onClick={stopSimulation}>
                          <IconPause size={14} /> Dừng
                        </Button>
                      ) : (
                        <Button size="sm" variant="primary" onClick={runSimulation} disabled={scriptIssues.length > 0}>
                          <IconPhone size={14} /> Bắt đầu gọi
                        </Button>
                      )}
                    </div>
                  }
                />

                {scriptIssues.length > 0 ? (
                  <div className="mb-4 rounded-2xl border border-[#f3d9a4] bg-[#fdf7e8] p-4">
                    <p className="text-[12.5px] font-black text-[#8a5b00]">Cần hoàn thiện kịch bản trước khi gọi</p>
                    <ul className="mt-2 space-y-1.5">
                      {scriptIssues.map((issue) => (
                        <li key={issue} className="text-[12.5px] text-[#8a5b00]">
                          • {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {outsideWindow ? (
                  <div className="mb-4 rounded-2xl border border-[#f3d9a4] bg-[#fdf7e8] p-4">
                    <p className="text-[12.5px] font-black text-[#8a5b00]">Đang ngoài khung giờ cho phép</p>
                    <p className="mt-1.5 text-[12.5px] text-[#8a5b00]">
                      Quy tắc “Không gọi ngoài khung giờ cho phép” đang bật, và hiện tại chưa tới khung {campaign.windowStart} - {campaign.windowEnd}.
                      Bấm “Bắt đầu gọi” sẽ bị chặn và ghi nhận là cần gọi lại. Tạm tắt quy tắc ở tab Cấu hình nếu muốn chạy thử ngay.
                    </p>
                  </div>
                ) : null}

                <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
                  <div className="rounded-2xl bg-[#fbfdfe] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="flex items-center gap-2 text-[12.5px] font-black text-[#111a22]">
                        <IconRobot size={15} /> Hội thoại
                      </p>
                      {simRunning ? (
                        <Badge label="Đang gọi" color="#0b3d44" bg="#7cc9d2" />
                      ) : simTurns.length > 0 ? (
                        <Badge label="Đã kết thúc" color="#15803d" bg="#e7f7ec" />
                      ) : (
                        <span className="text-[11.5px] font-semibold text-[#98a4ae]">Chưa chạy</span>
                      )}
                    </div>

                    {simTurns.length === 0 ? (
                      <div className="grid place-items-center gap-2 py-12 text-center">
                        <span className="grid h-12 w-12 place-items-center rounded-full bg-[#e5f7f9] text-[#0f8b98]">
                          <IconRobot size={22} />
                        </span>
                        <p className="text-[13px] font-bold text-[#33414d]">Chưa có cuộc gọi nào</p>
                        <p className="max-w-sm text-[12px] text-[#7b8894]">
                          Chọn khách hàng rồi bấm “Bắt đầu gọi” để xem trợ lý ảo chạy qua từng bước kịch bản.
                        </p>
                      </div>
                    ) : (
                      <ul className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                        {simTurns.map((turn) => (
                          <li key={turn.id} className={`flex ${turn.speaker === "bot" ? "justify-start" : "justify-end"}`}>
                            <div className={`max-w-[80%] ${turn.speaker === "bot" ? "" : "text-right"}`}>
                              <div
                                className={`rounded-2xl px-4 py-3 text-[13px] leading-6 ${
                                  turn.speaker === "bot" ? "bg-[#0f8b98] text-white" : "border border-[#e8eef2] bg-white text-[#25313d]"
                                }`}
                              >
                                {turn.text}
                              </div>
                              <p className="mt-1.5 flex items-center gap-2 text-[11px] font-semibold text-[#98a4ae]">
                                <span>{turn.speaker === "bot" ? "Trợ lý ảo" : customerName(simCustomer?.id ?? "")}</span>
                                <span>• {formatDuration(turn.atSec)}</span>
                                {turn.sentiment ? (
                                  <Badge
                                    label={sentimentMeta[turn.sentiment].label}
                                    color={sentimentMeta[turn.sentiment].color}
                                    bg={sentimentMeta[turn.sentiment].bg}
                                  />
                                ) : null}
                                {turn.intent && RULE_TURN_INTENTS.has(turn.intent) ? (
                                  <Badge label={turn.intent} color="#7c3aed" bg="#f1ebfe" />
                                ) : null}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-[#edf1f5] p-4">
                      <p className="text-[12.5px] font-black text-[#111a22]">Ngữ cảnh cuộc gọi</p>
                      <div className="mt-3 space-y-3">
                        <KeyValue label="Khách hàng" value={simCustomer?.name ?? "—"} />
                        <KeyValue label="Công ty" value={simCustomer?.company ?? "—"} />
                        <KeyValue label="Giọng đọc" value={campaign.voice} />
                        <KeyValue label="Số bước kịch bản" value={`${campaign.script.length} bước`} />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#edf1f5] p-4">
                      <p className="text-[12.5px] font-black text-[#111a22]">Bản xem trước lời thoại</p>
                      <p className="mt-2 text-[11.5px] text-[#8492a0]">
                        Biến động đã được điền bằng dữ liệu thật của khách hàng đang chọn.
                      </p>
                      <p className="mt-3 rounded-xl bg-[#f8fafc] px-3.5 py-3 text-[13px] leading-6 text-[#33414d]">“{previewSay}”</p>
                    </div>

                    <div className="rounded-2xl border border-[#edf1f5] p-4">
                      <p className="flex items-center justify-between gap-2 text-[12.5px] font-black text-[#111a22]">
                        <span className="flex items-center gap-2">
                          <IconMic size={14} /> Câu trả lời thật
                        </span>
                        {spokenReplies.length > 0 ? (
                          <button
                            type="button"
                            className="text-[11.5px] font-bold text-[#0f8b98] hover:underline"
                            onClick={() => {
                              setSpokenReplies([]);
                              lastCaptured.current = "";
                              recognition.reset();
                            }}
                          >
                            Xoá hết
                          </button>
                        ) : null}
                      </p>
                      {!recognition.backend && !recognition.supported ? (
                        <p className="mt-2 text-[11.5px] leading-5 text-[#b45309]">
                          Máy chủ giọng nói chưa chạy và trình duyệt này không hỗ trợ ghi âm. Vẫn có thể chạy mô phỏng bằng lời mẫu.
                        </p>
                      ) : spokenReplies.length === 0 ? (
                        <p className="mt-2 text-[11.5px] leading-5 text-[#8492a0]">
                          Bấm “Khách nói” rồi đọc câu trả lời của khách. Câu nói thật sẽ thay lời mẫu ở bước tương ứng khi chạy mô phỏng.
                        </p>
                      ) : (
                        <ul className="mt-3 space-y-2">
                          {spokenReplies.map((reply, index) => (
                            <li key={`${index}-${reply}`} className="rounded-xl bg-[#f8fafc] px-3 py-2 text-[12px] leading-5 text-[#33414d]">
                              <span className="font-black text-[#0f8b98]">Bước {index + 1}: </span>
                              “{reply}”
                              <span className="ml-1 text-[11px] font-semibold text-[#8492a0]">
                                (xử lý: {intentLabel(classifyCustomerReply(reply).intent)})
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {recognition.listening ? (
                        <p className="mt-2 flex items-center gap-2 text-[11.5px] font-bold text-[#be123c]">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-[#be123c]" /> Đang nghe micro...
                        </p>
                      ) : null}
                    </div>

                    <div className="rounded-2xl bg-[#101f27] p-4 text-white">
                      <p className="flex items-center gap-2 text-[12.5px] font-black">
                        <IconSparkle size={15} /> AI xử lý tình huống
                      </p>
                      <ul className="mt-3 space-y-2 text-[12px] text-white/75">
                        <li>• Khách ngắt lời: chờ 2 giây rồi tiếp tục kịch bản</li>
                        <li>• Khách nói câu trả lời thật qua micro thì engine phân loại và xử lý ngay</li>
                        <li>• Tự chuyển nhân viên khi khách yêu cầu gặp người thật</li>
                        <li>• Khách từ chối giữa cuộc gọi thì dừng ngay, không đọc tiếp</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <CardHeader
                  title="Trình thiết kế kịch bản"
                  subtitle="Nghe thử giọng đọc và chỉnh từng bước hội thoại của trợ lý ảo"
                  action={
                    <Tabs
                      size="sm"
                      active={tab}
                      onChange={setTab}
                      items={[
                        { id: "kich-ban", label: "Kịch bản gọi" },
                        { id: "ket-qua", label: "Kết quả cuộc gọi", count: campaign.results.length },
                        { id: "cau-hinh", label: "Cấu hình" },
                      ]}
                    />
                  }
                />

                {tab === "kich-ban" ? (
                  <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
                    <div>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[12.5px] font-black text-[#33414d]">
                          {campaign.script.length} bước hội thoại
                        </p>
                        <Button size="sm" variant="outline" onClick={() => dispatch({ type: "addScriptStep", campaignId: campaign.id })}>
                          <IconPlus size={14} /> Thêm bước
                        </Button>
                      </div>

                      {campaign.script.length === 0 ? (
                        <EmptyState
                          title="Kịch bản đang trống"
                          hint="Thêm bước đầu tiên để trợ lý ảo có nội dung chào hỏi khi gọi."
                          action={
                            <Button size="sm" onClick={() => dispatch({ type: "addScriptStep", campaignId: campaign.id })}>
                              <IconPlus size={14} /> Thêm bước đầu tiên
                            </Button>
                          }
                        />
                      ) : (
                        <ol className="space-y-3">
                          {campaign.script.map((step, index) => (
                            <li
                              key={step.id}
                              className={`rounded-2xl border p-4 transition ${
                                stepIndex === index && playing ? "border-[#0f8b98] bg-[#f2fbfc]" : "border-[#edf1f5]"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e5f7f9] text-[12.5px] font-black text-[#0f8b98]">
                                    {index + 1}
                                  </span>
                                  <div>
                                    <p className="text-[13.5px] font-black text-[#111a22]">{step.label}</p>
                                    <p className="text-[11.5px] text-[#7b8894]">Nhánh: {branchLabel(step.branch)}</p>
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={index === 0}
                                    onClick={() => dispatch({ type: "moveScriptStep", campaignId: campaign.id, stepId: step.id, direction: "up" })}
                                    className="grid h-8 w-8 place-items-center rounded-full bg-[#f1f5f8] text-[#5c6a76] transition hover:bg-[#e5f7f9] disabled:opacity-40"
                                    aria-label="Chuyển lên"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    disabled={index === campaign.script.length - 1}
                                    onClick={() => dispatch({ type: "moveScriptStep", campaignId: campaign.id, stepId: step.id, direction: "down" })}
                                    className="grid h-8 w-8 place-items-center rounded-full bg-[#f1f5f8] text-[#5c6a76] transition hover:bg-[#e5f7f9] disabled:opacity-40"
                                    aria-label="Chuyển xuống"
                                  >
                                    ↓
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => speakStep(step)}
                                    className={`grid h-8 w-8 place-items-center rounded-full transition ${
                                      speech.speakingId === step.id ? "bg-[#0f8b98] text-white" : "bg-[#f1f5f8] text-[#0f8b98] hover:bg-[#e5f7f9]"
                                    }`}
                                    aria-label="Nghe thử"
                                    title={speech.backend ? "Nghe thử bằng giọng máy chủ Callio" : speech.supported ? "Nghe thử bằng giọng trình duyệt" : "Không có cách đọc tiếng nói"}
                                  >
                                    <IconPlay size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingStep(step)}
                                    className="grid h-8 w-8 place-items-center rounded-full bg-[#f1f5f8] text-[#5c6a76] transition hover:bg-[#e5f7f9]"
                                    aria-label="Sửa bước"
                                  >
                                    ✎
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => dispatch({ type: "deleteScriptStep", campaignId: campaign.id, stepId: step.id })}
                                    className="grid h-8 w-8 place-items-center rounded-full bg-[#fdeaee] text-[#be123c] transition hover:bg-[#fbd5dd]"
                                    aria-label="Xoá bước"
                                  >
                                    <IconClose size={13} />
                                  </button>
                                </div>
                              </div>
                              <p className="mt-3 rounded-xl bg-[#f8fafc] px-3.5 py-3 text-[13px] leading-6 text-[#33414d]">“{step.say}”</p>
                              <p className="mt-2 text-[12px] font-semibold text-[#7b8894]">
                                <span className="font-black text-[#5c6a76]">Điều kiện chuyển bước: </span>
                                {step.expect}
                              </p>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-[#edf1f5] p-4">
                        <p className="text-[12.5px] font-black text-[#111a22]">Giọng đọc AI</p>
                        <p className="mt-1.5 text-[12.5px] text-[#7b8894]">{campaign.voice}</p>
                        <div className="mt-3 flex items-end gap-1">
                          {VOICE_BARS.map((bar) => (
                            <span
                              key={bar.id}
                              className={`w-1.5 rounded-full ${playing ? "bg-[#0f8b98]" : "bg-[#cfe9ec]"}`}
                              style={{ height: `${8 + Math.abs(Math.sin(bar.seed * 0.8)) * 26}px` }}
                            />
                          ))}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => (playing ? stopSpeaking() : speakWholeScript())}
                          >
                            {playing ? <IconPause size={14} /> : <IconPlay size={14} />} {playing ? "Dừng" : "Nghe thử toàn bộ"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setVoiceOpen(true)}>
                            <IconMic size={14} /> Đổi giọng
                          </Button>
                        </div>
                        <p className="mt-2 text-[11.5px] text-[#8492a0]">
                          {speech.backend || speech.supported
                            ? voiceSourceLabel(speech.backend, speech.voices.some((voice) => voice.lang.toLowerCase().startsWith("vi")))
                            : "Trình duyệt này không hỗ trợ đọc tiếng nói, và máy chủ giọng đọc chưa chạy."}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-[#edf1f5] p-4">
                        <p className="text-[12.5px] font-black text-[#111a22]">Biến động trong kịch bản</p>
                        <p className="mt-1.5 text-[11.5px] text-[#8492a0]">Chỉ hiện những biến đang dùng trong kịch bản này.</p>
                        <ul className="mt-3 space-y-2 text-[12px]">
                          {variablesInScript(campaign.script).length === 0 ? (
                            <li className="rounded-lg bg-[#f8fafc] px-3 py-2 text-[11.5px] text-[#8492a0]">Kịch bản chưa dùng biến động nào.</li>
                          ) : (
                            variablesInScript(campaign.script).map((variable) => (
                              <li key={variable} className="flex items-center justify-between rounded-lg bg-[#f8fafc] px-3 py-2">
                                <code className="font-mono text-[11.5px] font-bold text-[#0f8b98]">{variable}</code>
                                <span className="text-[11px] font-semibold text-[#8492a0]">Tự động điền</span>
                              </li>
                            ))
                          )}
                        </ul>
                      </div>

                      <div className="rounded-2xl bg-[#101f27] p-4 text-white">
                        <p className="flex items-center gap-2 text-[12.5px] font-black">
                          <IconRobot size={15} /> AI xử lý tình huống
                        </p>
                        <ul className="mt-3 space-y-2 text-[12px] text-white/75">
                          <li>• Khách ngắt lời: chờ 2 giây rồi tiếp tục kịch bản</li>
                          <li>• Nhận diện giọng nói tiếng Việt bằng micro (nếu trình duyệt hỗ trợ)</li>
                          <li>• Tự chuyển nhân viên khi khách yêu cầu gặp người thật</li>
                          <li>• Khách từ chối giữa cuộc gọi thì dừng ngay, không đọc tiếp</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : null}

                {tab === "ket-qua" ? (
                  <div>
                    <div className="mb-4 max-w-sm">
                      <SearchInput value={resultQuery} onChange={setResultQuery} placeholder="Tìm theo khách hàng hoặc nội dung phiên âm..." />
                    </div>
                    <DataTable
                      rowKey={(row) => row.id}
                      rows={filteredResults}
                      onRowClick={(row) => setDetailResult(row)}
                      emptyLabel="Chưa có kết quả cuộc gọi"
                      columns={[
                        {
                          key: "customer",
                          label: "Khách hàng",
                          render: (row) => (
                            <div className="flex items-center gap-2.5">
                              <Avatar name={customerName(row.customerId)} size={30} />
                              <span className="font-bold text-[#111a22]">{customerName(row.customerId)}</span>
                            </div>
                          ),
                        },
                        {
                          key: "outcome",
                          label: "Kết quả",
                          render: (row) => (
                            <Badge
                              label={callbotOutcomeMeta[row.outcome].label}
                              color={callbotOutcomeMeta[row.outcome].color}
                              bg={callbotOutcomeMeta[row.outcome].bg}
                            />
                          ),
                        },
                        { key: "duration", label: "Thời lượng", render: (row) => <span className="font-black">{formatDuration(row.durationSec)}</span> },
                        { key: "transcript", label: "Phiên âm", render: (row) => <span className="text-[12.5px] text-[#5c6a76]">{row.transcript}</span> },
                        {
                          key: "sentiment",
                          label: "Cảm xúc",
                          render: (row) => (
                            <Badge label={sentimentMeta[row.sentiment].label} color={sentimentMeta[row.sentiment].color} bg={sentimentMeta[row.sentiment].bg} />
                          ),
                        },
                        {
                          key: "quality",
                          label: "Chất lượng",
                          render: (row) =>
                            typeof row.qualityScore === "number" ? (
                              <div className="w-24">
                                <ProgressBar value={row.qualityScore * 10} color={row.qualityScore >= 8 ? "#15803d" : "#b45309"} showLabel />
                              </div>
                            ) : (
                              <span className="text-[12.5px] text-[#98a4ae]">—</span>
                            ),
                        },
                        { key: "at", label: "Thời điểm", render: (row) => <span className="text-[12.5px] text-[#7b8894]">{relativeTime(row.at)}</span> },
                      ]}
                    />
                  </div>
                ) : null}

                {tab === "cau-hinh" ? (
                  <div className="space-y-5">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-3">
                        <label className="block">
                          <span className="mb-1.5 block text-[12.5px] font-bold text-[#4a5763]">Tổng số cần gọi</span>
                          <input
                            type="number"
                            min={0}
                            className="w-full rounded-xl border border-[#dfe6ec] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#0f8b98]"
                            value={campaign.total}
                            onChange={(event) =>
                              dispatch({ type: "updateCampaignConfig", id: campaign.id, patch: { total: Math.max(0, Number(event.target.value) || 0) } })
                            }
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block text-[12.5px] font-bold text-[#4a5763]">Khung giờ bắt đầu</span>
                          <input
                            type="time"
                            className="w-full rounded-xl border border-[#dfe6ec] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#0f8b98]"
                            value={campaign.windowStart}
                            onChange={(event) => dispatch({ type: "updateCampaignConfig", id: campaign.id, patch: { windowStart: event.target.value } })}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block text-[12.5px] font-bold text-[#4a5763]">Khung giờ kết thúc</span>
                          <input
                            type="time"
                            className="w-full rounded-xl border border-[#dfe6ec] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#0f8b98]"
                            value={campaign.windowEnd}
                            onChange={(event) => dispatch({ type: "updateCampaignConfig", id: campaign.id, patch: { windowEnd: event.target.value } })}
                          />
                        </label>
                      </div>

                      <div className="space-y-3">
                        <label className="block">
                          <span className="mb-1.5 block text-[12.5px] font-bold text-[#4a5763]">Số luồng gọi song song</span>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            className="w-full rounded-xl border border-[#dfe6ec] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#0f8b98]"
                            value={campaign.concurrency}
                            onChange={(event) =>
                              dispatch({
                                type: "updateCampaignConfig",
                                id: campaign.id,
                                patch: { concurrency: Math.min(100, Math.max(1, Number(event.target.value) || 1)) },
                              })
                            }
                          />
                          <span className="mt-1.5 block text-[11.5px] text-[#8492a0]">Tối đa 100 cuộc đồng thời để không vượt hạn mức nhà mạng.</span>
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block text-[12.5px] font-bold text-[#4a5763]">Số lần gọi lại khi không nghe máy</span>
                          <input
                            type="number"
                            min={0}
                            max={5}
                            className="w-full rounded-xl border border-[#dfe6ec] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#0f8b98]"
                            value={campaign.retry}
                            onChange={(event) =>
                              dispatch({
                                type: "updateCampaignConfig",
                                id: campaign.id,
                                patch: { retry: Math.min(5, Math.max(0, Number(event.target.value) || 0)) },
                              })
                            }
                          />
                        </label>
                        <div className="space-y-2 rounded-2xl bg-[#f8fafc] p-3.5">
                          <KeyValue label="Mục tiêu chiến dịch" value={callbotGoalMeta[campaign.goal].label} />
                          <KeyValue label="Giọng đọc" value={campaign.voice} />
                          <KeyValue label="Ngày bắt đầu" value={campaign.startDate} />
                          <KeyValue label="Đầu số hiển thị" value="1900 3236 (Brandname Callio)" />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-[#f8fafc] p-4">
                      <p className="text-[12.5px] font-black text-[#111a22]">Quy tắc vận hành</p>
                      <p className="mt-1.5 text-[12px] text-[#8492a0]">
                        Bật/tắt để kiểm soát những gì hệ thống được phép làm khi gọi.
                      </p>
                      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                        {CALLBOT_RULE_KEYS.map((rule) => {
                          const enabled = campaign.rules[rule];
                          return (
                            <li key={rule}>
                              <button
                                type="button"
                                onClick={() => dispatch({ type: "toggleCampaignRule", id: campaign.id, rule })}
                                className={`flex w-full items-center gap-3 rounded-xl border bg-white px-3 py-2.5 text-left transition ${
                                  enabled ? "border-[#bfe3e8]" : "border-[#edf1f5]"
                                }`}
                              >
                                <span
                                  className={`grid h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition ${
                                    enabled ? "bg-[#0f8b98]" : "bg-[#d5dee5]"
                                  }`}
                                >
                                  <span
                                    className={`h-5 w-5 rounded-full bg-white shadow transition ${enabled ? "translate-x-5" : "translate-x-0"}`}
                                  />
                                </span>
                                <span className="text-[12.5px] font-semibold text-[#33414d]">{CALLBOT_RULE_LABELS[rule]}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-[#edf1f5] p-4">
                      <p className="text-[12.5px] font-black text-[#111a22]">Nguồn dữ liệu gọi</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {["Đơn hàng mới", "Khách đến hạn chăm sóc", "Lead từ Ulead", "Danh sách tải lên"].map((option) => (
                          <label key={option} className="flex items-center gap-2 rounded-xl border border-[#dfe6ec] px-3 py-2 text-[12.5px] font-semibold text-[#33414d]">
                            <input type="checkbox" defaultChecked={option === "Đơn hàng mới"} /> {option}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </Card>
            </>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader title="So sánh hiệu quả các chiến dịch" subtitle="Tỉ lệ kết nối và xác nhận của từng mục tiêu gọi" />
        <DataTable
          rowKey={(row) => row.id}
          rows={state.callbotCampaigns}
          columns={[
            { key: "name", label: "Chiến dịch", render: (row) => <span className="font-black text-[#111a22]">{row.name}</span> },
            {
              key: "goal",
              label: "Mục tiêu",
              render: (row) => <Badge label={callbotGoalMeta[row.goal].label} color="#ffffff" bg={callbotGoalMeta[row.goal].color} />,
            },
            {
              key: "status",
              label: "Trạng thái",
              render: (row) => (
                <Badge label={campaignStatusMeta[row.status].label} color={campaignStatusMeta[row.status].color} bg={campaignStatusMeta[row.status].bg} />
              ),
            },
            { key: "connected", label: "Kết nối", render: (row) => <span className="font-black">{formatNumber(row.connected)}</span> },
            {
              key: "rate",
              label: "Tỉ lệ xác nhận",
              render: (row) => (
                <div className="w-32">
                  <ProgressBar value={row.connected ? (row.confirmed / row.connected) * 100 : 0} color="#15803d" showLabel />
                </div>
              ),
            },
            {
              key: "saving",
              label: "Giờ tiết kiệm",
              render: (row) => <span className="font-black text-[#0f8b98]">{formatNumber(Math.round((row.connected * 1.5) / 60))} giờ</span>,
            },
          ]}
        />
      </Card>

      <Modal
        open={createOpen}
        title="Tạo chiến dịch Callbot mới"
        subtitle="Trợ lý ảo sẽ tự động gọi theo kịch bản bạn thiết lập"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Huỷ
            </Button>
            <Button
              disabled={draft.name.trim() === ""}
              onClick={() => {
                dispatch({ type: "createCampaign", draft: { ...draft, name: draft.name.trim() } });
                setCreateOpen(false);
                setDraft({ ...draft, name: "" });
              }}
            >
              Tạo chiến dịch
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-[12.5px] font-bold text-[#4a5763]">Tên chiến dịch</span>
            <input
              className="w-full rounded-xl border border-[#dfe6ec] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#0f8b98]"
              placeholder="Xác nhận đơn hàng tháng 10"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-bold text-[#4a5763]">Mục tiêu</span>
            <select
              className="w-full rounded-xl border border-[#dfe6ec] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#0f8b98]"
              value={draft.goal}
              onChange={(event) => setDraft({ ...draft, goal: event.target.value as CallbotCampaign["goal"] })}
            >
              {Object.entries(callbotGoalMeta).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-bold text-[#4a5763]">Giọng đọc</span>
            <select
              className="w-full rounded-xl border border-[#dfe6ec] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#0f8b98]"
              value={draft.voice}
              onChange={(event) => setDraft({ ...draft, voice: event.target.value })}
            >
              {VOICES.map((voice) => (
                <option key={voice}>{voice}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-bold text-[#4a5763]">Khung giờ gọi</span>
            <input className="w-full rounded-xl border border-[#dfe6ec] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#0f8b98]" defaultValue="08:30 - 20:00" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-bold text-[#4a5763]">Số luồng song song</span>
            <input className="w-full rounded-xl border border-[#dfe6ec] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#0f8b98]" defaultValue="20" />
          </label>
          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-[12.5px] font-bold text-[#4a5763]">Nguồn dữ liệu gọi</span>
            <div className="flex flex-wrap gap-2">
              {["Đơn hàng mới", "Khách đến hạn chăm sóc", "Lead từ Ulead", "Danh sách tải lên"].map((option) => (
                <label key={option} className="flex items-center gap-2 rounded-xl border border-[#dfe6ec] px-3 py-2 text-[12.5px] font-semibold text-[#33414d]">
                  <input type="checkbox" defaultChecked={option === "Đơn hàng mới"} /> {option}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={voiceOpen}
        title="Chọn giọng đọc cho trợ lý ảo"
        subtitle="Giọng đọc áp dụng cho toàn bộ cuộc gọi của chiến dịch này"
        onClose={() => {
          speech.stop();
          setVoiceOpen(false);
        }}
        footer={
          <Button
            variant="ghost"
            onClick={() => {
              speech.stop();
              setVoiceOpen(false);
            }}
          >
            Đóng
          </Button>
        }
      >
        {!speech.backend && !speech.supported ? (
          <p className="mb-3 rounded-2xl bg-[#fdf1e0] px-3.5 py-3 text-[12.5px] leading-6 text-[#b45309]">
            Máy chủ giọng đọc chưa chạy và trình duyệt này không hỗ trợ đọc tiếng nói, nên không nghe thử được. Vẫn có thể chọn giọng để lưu vào chiến dịch.
          </p>
        ) : null}

        <div className="mb-4 rounded-2xl border border-[#edf1f5] p-4">
          <p className="text-[12.5px] font-black text-[#111a22]">Token máy chủ giọng đọc</p>
          <p className="mt-1 text-[11.5px] leading-5 text-[#8492a0]">
            Chỉ cần điền nếu máy chủ đặt <code className="font-mono">CALLIO_AUTH_TOKEN</code>. Token được lưu trong trình duyệt này.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              type="password"
              className="min-w-0 flex-1 rounded-xl border border-[#dfe6ec] px-3.5 py-2.5 text-[13px] outline-none focus:border-[#0f8b98]"
              placeholder="Để trống nếu máy chủ không yêu cầu"
              value={voiceTokenDraft}
              onChange={(event) => setVoiceTokenDraft(event.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setVoiceApiToken(voiceTokenDraft);
                dispatch({ type: "toast", message: voiceTokenDraft.trim() ? "Đã lưu token máy chủ giọng đọc" : "Đã xoá token máy chủ giọng đọc", tone: "success" });
              }}
            >
              Lưu token
            </Button>
          </div>
        </div>

        <ul className="space-y-2.5">
          {VOICES.map((voice) => {
            const active = campaign.voice === voice;
            const profile = parseVoiceLabel(voice);
            const matched = speech.supported ? pickVoice(speech.voices, profile) : undefined;
            const previewing = speech.speakingId === `preview-${voice}`;
            return (
              <li key={voice} className={`rounded-2xl border px-4 py-3 transition ${active ? "border-[#0f8b98] bg-[#f2fbfc]" : "border-[#edf1f5]"}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-[#e5f7f9] text-[#0f8b98]">
                      <IconMic size={16} />
                    </span>
                    <span>
                      <span className="block text-[13.5px] font-bold text-[#111a22]">{voice}</span>
                      <span className="block text-[11.5px] text-[#8492a0]">
                        {speech.backend
                          ? "Máy chủ Callio đọc bằng giọng tiếng Việt."
                          : matched
                            ? `Thiết bị đọc bằng: ${matched.name}`
                            : "Chưa tìm thấy giọng phù hợp trên thiết bị"}
                      </span>
                    </span>
                  </span>
                  {active ? <Badge label="Đang dùng" color="#15803d" bg="#e7f7ec" /> : null}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!speech.backend && !speech.supported}
                    onClick={() => {
                      const preview = `Xin chào, tôi là ${voice.replace(/^Giọng\s+/, "")}. Đây là giọng đọc của trợ lý ảo Callio.`;
                      speech.speak(preview, profile, `preview-${voice}`);
                    }}
                  >
                    {previewing ? <IconPause size={14} /> : <IconPlay size={14} />} Nghe thử
                  </Button>
                  <Button
                    size="sm"
                    variant={active ? "ghost" : "primary"}
                    onClick={() => {
                      dispatch({ type: "updateCampaignVoice", id: campaign.id, voice });
                    }}
                  >
                    {active ? "Đang dùng" : "Chọn giọng này"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </Modal>

      <Modal
        open={Boolean(editingStep)}
        title={editingStep ? `Sửa bước: ${editingStep.label}` : ""}
        subtitle="Lời thoại hỗ trợ biến động như {ten_khach}, {ma_don}, {ngay_giao}"
        onClose={() => setEditingStep(undefined)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingStep(undefined)}>
              Huỷ
            </Button>
            <Button onClick={() => setEditingStep(undefined)}>
              <IconCheck size={15} /> Xong
            </Button>
          </>
        }
      >
        {editingStep ? (
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-bold text-[#4a5763]">Tên bước</span>
              <input
                className="w-full rounded-xl border border-[#dfe6ec] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#0f8b98]"
                value={editingStep.label}
                onChange={(event) => {
                  setEditingStep({ ...editingStep, label: event.target.value });
                  dispatch({
                    type: "updateScriptStep",
                    campaignId: campaign.id,
                    stepId: editingStep.id,
                    patch: { label: event.target.value },
                  });
                }}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-bold text-[#4a5763]">Lời thoại của trợ lý ảo</span>
              <textarea
                className="h-28 w-full rounded-xl border border-[#dfe6ec] px-3.5 py-2.5 text-[13.5px] leading-6 outline-none focus:border-[#0f8b98]"
                value={editingStep.say}
                onChange={(event) => {
                  setEditingStep({ ...editingStep, say: event.target.value });
                  dispatch({
                    type: "updateScriptStep",
                    campaignId: campaign.id,
                    stepId: editingStep.id,
                    patch: { say: event.target.value },
                  });
                }}
              />
            </label>

            <div className="rounded-2xl bg-[#f8fafc] px-3.5 py-3">
              <p className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-[#8492a0]">Xem trước với khách hàng đang chọn</p>
              <p className="mt-2 text-[13px] leading-6 text-[#33414d]">
                “{simCustomer ? fillVariables(editingStep.say, simCustomer, campaign) : editingStep.say}”
              </p>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-bold text-[#4a5763]">Điều kiện chuyển bước</span>
              <input
                className="w-full rounded-xl border border-[#dfe6ec] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#0f8b98]"
                value={editingStep.expect}
                onChange={(event) => {
                  setEditingStep({ ...editingStep, expect: event.target.value });
                  dispatch({
                    type: "updateScriptStep",
                    campaignId: campaign.id,
                    stepId: editingStep.id,
                    patch: { expect: event.target.value },
                  });
                }}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-bold text-[#4a5763]">Nhánh xử lý</span>
              <select
                className="w-full rounded-xl border border-[#dfe6ec] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#0f8b98]"
                value={editingStep.branch}
                onChange={(event) => {
                  const branch = event.target.value as CallbotScriptStep["branch"];
                  setEditingStep({ ...editingStep, branch });
                  dispatch({ type: "updateScriptStep", campaignId: campaign.id, stepId: editingStep.id, patch: { branch } });
                }}
              >
                {BRANCH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(detailResult)}
        wide
        title={detailResult ? `Cuộc gọi với ${customerName(detailResult.customerId)}` : ""}
        subtitle={detailResult ? callbotOutcomeMeta[detailResult.outcome].label : ""}
        onClose={() => setDetailResult(undefined)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDetailResult(undefined)}>
              Đóng
            </Button>
            <Button
              variant="outline"
              onClick={() => dispatch({ type: "toast", message: "Đang phát bản ghi âm cuộc gọi", tone: "info" })}
            >
              <IconPlay size={15} /> Nghe bản ghi
            </Button>
          </>
        }
      >
        {detailResult ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Metric label="Thời lượng" value={formatDuration(detailResult.durationSec)} />
              <Metric label="Điểm chất lượng" value={detailResult.qualityScore ? `${detailResult.qualityScore}/10` : "—"} color="#15803d" />
              <Metric label="Số bước đã đọc" value={detailResult.stepReached ? `${detailResult.stepReached}` : "—"} />
              <Metric
                label="Cảm xúc"
                value={sentimentMeta[detailResult.sentiment].label}
                color={sentimentMeta[detailResult.sentiment].color}
              />
            </div>

            {detailResult.turns && detailResult.turns.length > 0 ? (
              <div>
                <p className="mb-3 text-[12.5px] font-black text-[#111a22]">Hội thoại đầy đủ</p>
                <ul className="max-h-[340px] space-y-3 overflow-y-auto rounded-2xl bg-[#fbfdfe] p-4">
                  {detailResult.turns.map((turn) => (
                    <li key={turn.id} className={`flex ${turn.speaker === "bot" ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[80%] ${turn.speaker === "bot" ? "" : "text-right"}`}>
                        <div
                          className={`rounded-2xl px-4 py-3 text-[13px] leading-6 ${
                            turn.speaker === "bot" ? "bg-[#0f8b98] text-white" : "border border-[#e8eef2] bg-white text-[#25313d]"
                          }`}
                        >
                          {turn.text}
                        </div>
                        <p className="mt-1.5 flex items-center gap-2 text-[11px] font-semibold text-[#98a4ae]">
                          <span>{turn.speaker === "bot" ? "Trợ lý ảo" : customerName(detailResult.customerId)}</span>
                          <span>• {formatDuration(turn.atSec)}</span>
                          {turn.intent ? <span>• {turn.intent}</span> : null}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-2xl bg-[#f8fafc] p-4">
                <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-[#8492a0]">Phiên âm</p>
                <p className="mt-2 text-[13px] leading-6 text-[#33414d]">{detailResult.transcript}</p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <KeyValue label="Thời điểm gọi" value={relativeTime(detailResult.at)} />
              <KeyValue label="Bản ghi âm" value={detailResult.recordingUrl ? "Đã lưu, mã hoá AES-256" : "Không có bản ghi"} />
            </div>

            {detailResult.blockedReason ||
            detailResult.escalated ||
            detailResult.optedOut ||
            detailResult.smsSent ? (
              <div className="rounded-2xl border border-[#edf1f5] p-4">
                <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-[#8492a0]">Quy tắc vận hành đã can thiệp</p>
                <ul className="mt-3 space-y-2">
                  {detailResult.blockedReason ? (
                    <li className="flex items-start gap-2 text-[12.5px] font-semibold text-[#b45309]">
                      <IconClock size={14} /> Chưa gọi được: {detailResult.blockedReason}
                    </li>
                  ) : null}
                  {detailResult.escalated ? (
                    <li className="flex items-start gap-2 text-[12.5px] font-semibold text-[#7c3aed]">
                      <IconUsers size={14} /> Đã chuyển sang chuyên viên phụ trách
                    </li>
                  ) : null}
                  {detailResult.optedOut ? (
                    <li className="flex items-start gap-2 text-[12.5px] font-semibold text-[#be123c]">
                      <IconClose size={14} /> Khách yêu cầu không liên hệ lại
                    </li>
                  ) : null}
                  {detailResult.smsSent ? (
                    <li className="flex items-start gap-2 text-[12.5px] font-semibold text-[#15803d]">
                      <IconCheck size={14} /> Đã gửi SMS xác nhận sau cuộc gọi
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function branchLabel(branch: CallbotScriptStep["branch"]): string {
  switch (branch) {
    case "tiep-tuc":
      return "Tiếp tục bước sau";
    case "xac-nhan":
      return "Ghi nhận xác nhận của khách";
    case "chuyen-nhan-vien":
      return "Chuyển sang nhân viên thật";
    default:
      return "Kết thúc cuộc gọi";
  }
}

function intentLabel(intent: ReplyIntent): string {
  switch (intent) {
    case "xac-nhan":
      return "xác nhận";
    case "tu-choi":
      return "từ chối";
    case "chuyen-nhan-vien":
      return "xin gặp nhân viên";
    default:
      return "trung tính";
  }
}
