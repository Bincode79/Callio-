import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "../lib/store";
import {
  agentStatusMeta,
  callStatusMeta,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercent,
  maskPhone,
  relativeTime,
  sentimentMeta,
} from "../lib/format";
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
  KeyValue,
  Metric,
  Modal,
  ProgressBar,
  SearchInput,
  Select,
  StatCard,
  Tabs,
} from "../components/ui";
import {
  IconClock,
  IconDownload,
  IconMic,
  IconPause,
  IconPhone,
  IconPhoneOff,
  IconPlay,
  IconShield,
  IconUsers,
} from "../components/icons";
import type { CallRecord } from "../lib/types";

const LIVE_BARS = Array.from({ length: 34 }, (_, seed) => ({ id: `live-${seed}`, seed }));
const RECORDING_BARS = Array.from({ length: 40 }, (_, seed) => ({ id: `rec-${seed}`, seed }));

export function CallCenterPage() {
  const { state, dispatch } = useApp();
  const [tab, setTab] = useState("truc-tiep");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [queueFilter, setQueueFilter] = useState("all");
  const [detailId, setDetailId] = useState<string>();
  const [noteDraft, setNoteDraft] = useState("");
  const [liveSeconds, setLiveSeconds] = useState(0);

  const activeCall = state.calls.find((call) => call.status === "talking") ?? state.calls[0];

  useEffect(() => {
    const timer = setInterval(() => setLiveSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const queues = useMemo(() => Array.from(new Set(state.calls.map((call) => call.queue))), [state.calls]);
  const detail = state.calls.find((call) => call.id === detailId);
  const customerName = useCallback(
    (id: string) => state.customers.find((customer) => customer.id === id)?.name ?? "Khách hàng",
    [state.customers],
  );
  const customerPhone = useCallback(
    (id: string) => state.customers.find((customer) => customer.id === id)?.phone ?? "",
    [state.customers],
  );

  /** Gọi ra: chọn khách chưa nằm trong cuộc gọi nào để tránh chồng chéo. */
  const startOutboundCall = () => {
    const busy = new Set(
      state.calls.filter((call) => call.status === "talking" || call.status === "ringing").map((call) => call.customerId),
    );
    const target = state.customers.find((customer) => !busy.has(customer.id));
    if (!target) {
      dispatch({ type: "toast", message: "Mọi khách hàng đều đang trong cuộc gọi", tone: "warn" });
      return;
    }
    dispatch({ type: "createCall", customerId: target.id, queue: queues[0] ?? "Kinh doanh - Miền Bắc" });
    setTab("truc-tiep");
  };

  const filtered = useMemo(
    () =>
      state.calls.filter((call) => {
        const matchQuery =
          query.trim() === "" ||
          [customerName(call.customerId), call.agent, call.queue, call.id].join(" ").toLowerCase().includes(query.toLowerCase());
        const matchStatus = statusFilter === "all" || call.status === statusFilter;
        const matchQueue = queueFilter === "all" || call.queue === queueFilter;
        return matchQuery && matchStatus && matchQueue;
      }),
    [state.calls, query, statusFilter, queueFilter, customerName],
  );

  const inbound = state.calls.filter((call) => call.direction === "inbound").length;
  const outbound = state.calls.filter((call) => call.direction === "outbound").length;
  const missed = state.calls.filter((call) => call.status === "missed").length;
  const completed = state.calls.filter((call) => call.status === "completed");
  const avgWait = state.calls.length ? state.calls.reduce((sum, call) => sum + call.waitSec, 0) / state.calls.length : 0;

  const hourly = Array.from({ length: 12 }, (_, index) => {
    const hour = 7 + index;
    return {
      label: `${String(hour).padStart(2, "0")}h`,
      values: [12 + ((index * 5) % 17), 8 + ((index * 7) % 13), 1 + (index % 4)],
    };
  });

  const queueStats = queues.map((queue) => {
    const items = state.calls.filter((call) => call.queue === queue);
    const answered = items.filter((call) => call.status === "completed").length;
    return {
      queue,
      total: items.length,
      answered,
      waiting: items.filter((call) => call.status === "ringing").length,
      answerRate: items.length ? (answered / items.length) * 100 : 0,
      avgWait: items.length ? items.reduce((sum, call) => sum + call.waitSec, 0) / items.length : 0,
    };
  });

  const agentPerformance = state.agents
    .map((agent) => {
      const items = state.calls.filter((call) => call.agent === agent.name);
      return {
        ...agent,
        handled: items.length,
        talkTime: Math.round(items.reduce((sum, call) => sum + call.durationSec, 0) / 60),
      };
    })
    .sort((a, b) => b.handled - a.handled);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Tổng đài"
        title="Tổng đài cuộc gọi thông minh"
        description="Tiếp nhận, phân phối và giám sát toàn bộ cuộc gọi vào - ra. Hỗ trợ ghi âm, xếp hàng theo kỹ năng và báo cáo hiệu suất theo thời gian thực."
        actions={
          <>
            <Button variant="outline" onClick={() => dispatch({ type: "toast", message: "Đã xuất báo cáo cuộc gọi dạng Excel", tone: "success" })}>
              <IconDownload size={16} /> Xuất báo cáo
            </Button>
            <Button onClick={startOutboundCall}>
              <IconPhone size={16} /> Gọi ra
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Cuộc gọi hôm nay" value={formatNumber(state.calls.length)} accent="#0f8b98" icon={<IconPhone size={20} />} hint={`${inbound} vào • ${outbound} ra`} />
        <StatCard label="Tỉ lệ nghe máy" value={formatPercent((completed.length / Math.max(1, state.calls.length)) * 100, 1)} accent="#15803d" icon={<IconShield size={20} />} hint={`${missed} cuộc nhỡ`} />
        <StatCard label="Thời gian chờ TB" value={`${avgWait.toFixed(0)} giây`} accent="#b45309" icon={<IconClock size={20} />} hint="Mục tiêu dưới 15 giây" />
        <StatCard label="Agent đang trực" value={`${state.agents.filter((agent) => agent.status !== "offline").length}/${state.agents.length}`} accent="#7c3aed" icon={<IconUsers size={20} />} hint="2 agent đang đàm thoại" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <Card className="relative overflow-hidden bg-[#101f27] text-white">
          <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#26b9c5]/25 blur-3xl" />
          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/12 text-white">
                  <IconPhone size={20} />
                </span>
                <div>
                  <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-white/55">
                    {activeCall?.direction === "inbound" ? "Cuộc gọi vào" : "Cuộc gọi ra"}
                  </p>
                  <p className="text-[16px] font-black">{activeCall ? customerName(activeCall.customerId) : "—"}</p>
                </div>
              </div>
              <Badge label={activeCall ? callStatusMeta[activeCall.status].label : "Sẵn sàng"} color="#0b3d44" bg="#7cc9d2" />
            </div>

            <div className="mt-6 flex items-end gap-4">
              <p className="text-[44px] font-black leading-none tracking-[-0.04em]">
                {formatDuration((activeCall?.durationSec ?? 0) + liveSeconds)}
              </p>
              <span className="mb-2 text-[12.5px] font-semibold text-white/60">{activeCall ? maskPhone(customerPhone(activeCall.customerId)) : ""}</span>
            </div>

            <div className="mt-5 flex items-end gap-1.5">
              {LIVE_BARS.map((bar) => (
                <span
                  key={bar.id}
                  className="w-1.5 rounded-full bg-[#7cc9d2]"
                  style={{
                    height: `${8 + Math.abs(Math.sin((bar.seed + liveSeconds) * 0.6)) * 34}px`,
                    opacity: 0.4 + (bar.seed % 5) * 0.12,
                  }}
                />
              ))}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/10 px-3.5 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-white/60">Hàng đợi</p>
                <p className="mt-1 text-[13.5px] font-black">{activeCall?.queue ?? "—"}</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-3.5 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-white/60">Nhân viên</p>
                <p className="mt-1 text-[13.5px] font-black">{activeCall?.agent ?? "—"}</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-3.5 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-white/60">Ghi âm</p>
                <p className="mt-1 text-[13.5px] font-black">{activeCall?.recording ? "Đang ghi" : "Chưa bật"}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2.5">
              <Button
                variant="ghost"
                onClick={() => {
                  if (!activeCall) return;
                  dispatch({
                    type: "updateCall",
                    id: activeCall.id,
                    patch: { status: activeCall.status === "talking" ? "wrap-up" : "talking" },
                  });
                  dispatch({ type: "toast", message: activeCall.status === "talking" ? "Đã tạm giữ cuộc gọi" : "Đã tiếp tục cuộc gọi", tone: "info" });
                }}
              >
                <IconPause size={16} /> Tạm giữ
              </Button>
              <Button
                variant="ghost"
                onClick={() => dispatch({ type: "toast", message: "Đang phát lại bản ghi âm cuộc gọi gần nhất", tone: "info" })}
              >
                <IconPlay size={16} /> Nghe lại
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (!activeCall) return;
                  dispatch({ type: "updateCall", id: activeCall.id, patch: { status: "completed" } });
                  dispatch({ type: "toast", message: `Đã kết thúc cuộc gọi với ${customerName(activeCall.customerId)}`, tone: "success" });
                }}
              >
                <IconPhoneOff size={16} /> Kết thúc
              </Button>
              <Button
                variant="gold"
                onClick={() => {
                  if (!activeCall) return;
                  const nextQueue = queues.find((queue) => queue !== activeCall.queue) ?? activeCall.queue;
                  dispatch({ type: "transferCall", id: activeCall.id, queue: nextQueue });
                }}
              >
                <IconMic size={16} /> Chuyển máy
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid gap-5">
          <Card>
            <CardHeader title="Lưu lượng cuộc gọi theo giờ" subtitle="Cuộc gọi vào, ra và nhỡ" />
            <BarChart data={hourly} colors={["#0f8b98", "#7cc9d2", "#f5b942"]} height={165} />
          </Card>
          <Card>
            <CardHeader title="Phân loại cuộc gọi" subtitle="Cơ cấu theo hướng và trạng thái" />
            <Donut
              centerLabel="Cuộc gọi"
              centerValue={formatNumber(state.calls.length)}
              data={[
                { label: "Gọi vào", value: inbound, color: "#0f8b98" },
                { label: "Gọi ra", value: outbound, color: "#7cc9d2" },
                { label: "Nhỡ", value: missed, color: "#f5b942" },
                { label: "Hoàn tất", value: completed.length, color: "#15803d" },
              ]}
              size={148}
              thickness={20}
            />
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Hiệu suất theo hàng đợi" subtitle="Phân phối cuộc gọi theo kỹ năng và tỉ lệ phục vụ" />
        <DataTable
          rowKey={(row) => row.queue}
          rows={queueStats}
          columns={[
            { key: "queue", label: "Hàng đợi", render: (row) => <span className="font-black text-[#111a22]">{row.queue}</span> },
            { key: "total", label: "Tổng cuộc", render: (row) => <span className="font-black">{row.total}</span> },
            { key: "answered", label: "Đã phục vụ", render: (row) => <span className="font-black text-[#15803d]">{row.answered}</span> },
            { key: "waiting", label: "Đang chờ", render: (row) => <span className="font-black text-[#b45309]">{row.waiting}</span> },
            {
              key: "rate",
              label: "Tỉ lệ phục vụ",
              render: (row) => (
                <div className="w-32">
                  <ProgressBar value={row.answerRate} color={row.answerRate > 80 ? "#15803d" : "#b45309"} showLabel />
                </div>
              ),
            },
            { key: "wait", label: "Chờ TB", render: (row) => <span className="font-semibold">{row.avgWait.toFixed(0)}s</span> },
          ]}
        />
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader
            title="Nhật ký cuộc gọi"
            subtitle="Tra cứu, nghe lại và ghi chú kết quả từng cuộc gọi"
            action={
              <Tabs
                size="sm"
                active={tab}
                onChange={setTab}
                items={[
                  { id: "truc-tiep", label: "Đang diễn ra", count: state.calls.filter((call) => call.status === "talking" || call.status === "ringing").length },
                  { id: "lich-su", label: "Lịch sử", count: state.calls.length },
                ]}
              />
            }
          />

          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <SearchInput value={query} onChange={setQuery} placeholder="Tìm theo khách hàng, nhân viên, hàng đợi..." />
            </div>
            <Select
              label="Trạng thái"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[{ value: "all", label: "Tất cả" }, ...Object.entries(callStatusMeta).map(([key, meta]) => ({ value: key, label: meta.label }))]}
            />
            <Select label="Hàng đợi" value={queueFilter} onChange={setQueueFilter} options={[{ value: "all", label: "Tất cả" }, ...queues.map((queue) => ({ value: queue, label: queue }))]} />
          </div>

          <DataTable
            rowKey={(row) => row.id}
            rows={tab === "truc-tiep" ? filtered.filter((call) => call.status === "talking" || call.status === "ringing") : filtered}
            onRowClick={(row) => {
              setDetailId(row.id);
              setNoteDraft(row.note);
            }}
            emptyLabel="Không có cuộc gọi phù hợp"
            columns={[
              {
                key: "customer",
                label: "Khách hàng",
                render: (row) => (
                  <div className="flex items-center gap-2.5">
                    <Avatar name={customerName(row.customerId)} size={32} />
                    <div>
                      <p className="font-bold text-[#111a22]">{customerName(row.customerId)}</p>
                      <p className="text-[11.5px] text-[#7b8894]">{maskPhone(customerPhone(row.customerId))}</p>
                    </div>
                  </div>
                ),
              },
              {
                key: "direction",
                label: "Hướng",
                render: (row) => (
                  <Badge label={row.direction === "inbound" ? "Gọi vào" : "Gọi ra"} color={row.direction === "inbound" ? "#2563eb" : "#0f8b98"} bg={row.direction === "inbound" ? "#e8eeff" : "#e5f7f9"} />
                ),
              },
              { key: "agent", label: "Nhân viên", render: (row) => <span className="font-semibold">{row.agent}</span> },
              {
                key: "status",
                label: "Trạng thái",
                render: (row) => <Badge label={callStatusMeta[row.status].label} color={callStatusMeta[row.status].color} bg={callStatusMeta[row.status].bg} />,
              },
              { key: "duration", label: "Thời lượng", render: (row) => <span className="font-black">{formatDuration(row.durationSec)}</span> },
              { key: "time", label: "Thời điểm", render: (row) => <span className="text-[12.5px] text-[#7b8894]">{relativeTime(row.startedAt)}</span> },
            ]}
          />
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Trạng thái nhân viên" subtitle="Theo dõi realtime đội tổng đài" />
            <ul className="space-y-3">
              {state.agents.map((agent) => {
                const meta = agentStatusMeta[agent.status];
                return (
                  <li key={agent.id} className="rounded-2xl border border-[#edf1f5] p-3">
                    <div className="flex items-center gap-3">
                      <span className="relative">
                        <Avatar name={agent.name} size={36} />
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white" style={{ backgroundColor: meta.dot }} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-black text-[#111a22]">{agent.name}</p>
                        <p className="text-[11.5px] text-[#7b8894]">
                          Ext {agent.extension} • {agent.team}
                        </p>
                      </div>
                      <Badge label={meta.label} color={meta.color} bg={`${meta.dot}1f`} />
                    </div>
                    <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-[#f8fafc] py-1.5">
                        <p className="text-[10.5px] font-bold text-[#8492a0]">Cuộc gọi</p>
                        <p className="text-[12.5px] font-black">{agent.callsToday}</p>
                      </div>
                      <div className="rounded-lg bg-[#f8fafc] py-1.5">
                        <p className="text-[10.5px] font-bold text-[#8492a0]">Thoại</p>
                        <p className="text-[12.5px] font-black">{agent.talkTimeMin}p</p>
                      </div>
                      <div className="rounded-lg bg-[#f8fafc] py-1.5">
                        <p className="text-[10.5px] font-bold text-[#8492a0]">Nghe máy</p>
                        <p className="text-[12.5px] font-black">{agent.answerRate}%</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Bảng xếp hạng telesales" subtitle="Số cuộc gọi xử lý và thời gian thoại" />
            <ul className="space-y-3">
              {agentPerformance.slice(0, 5).map((agent, index) => (
                <li key={agent.id} className="flex items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#f1f5f8] text-[12px] font-black text-[#4a5763]">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-bold text-[#25313d]">{agent.name}</p>
                    <ProgressBar value={agent.handled} max={agentPerformance[0].handled} color="#0f8b98" height={6} />
                  </div>
                  <span className="text-[12px] font-black text-[#111a22]">{agent.handled}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="bg-gradient-to-br from-[#0f8b98] to-[#0b5f68] text-white">
            <p className="flex items-center gap-2 text-[13px] font-black">
              <IconShield size={15} /> Ghi âm & bảo mật
            </p>
            <p className="mt-2.5 text-[12.5px] leading-6 text-white/80">
              Toàn bộ cuộc gọi được ghi âm và mã hoá AES-256, lưu trữ 12 tháng, phân quyền nghe lại theo vai trò.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/12 px-3 py-2.5">
                <p className="text-[11px] font-bold text-white/70">Bản ghi lưu</p>
                <p className="mt-1 text-[15px] font-black">4.286</p>
              </div>
              <div className="rounded-2xl bg-white/12 px-3 py-2.5">
                <p className="text-[11px] font-bold text-white/70">Dung lượng</p>
                <p className="mt-1 text-[15px] font-black">18,4 GB</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={Boolean(detail)}
        title={detail ? `Cuộc gọi ${detail.id}` : ""}
        subtitle={detail ? `${customerName(detail.customerId)} • ${callStatusMeta[detail.status].label}` : ""}
        onClose={() => setDetailId(undefined)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDetailId(undefined)}>
              Đóng
            </Button>
            <Button variant="outline" onClick={() => dispatch({ type: "toast", message: "Đang phát lại bản ghi âm cuộc gọi", tone: "info" })}>
              <IconPlay size={15} /> Nghe bản ghi
            </Button>
            <Button
              disabled={!detail || noteDraft.trim() === "" || noteDraft.trim() === detail.note}
              onClick={() => {
                if (!detail) return;
                dispatch({ type: "saveCallNote", id: detail.id, note: noteDraft.trim() });
              }}
            >
              Lưu ghi chú
            </Button>
          </>
        }
      >
        {detail ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <KeyValue label="Khách hàng" value={customerName(detail.customerId)} />
              <KeyValue label="Số điện thoại" value={maskPhone(customerPhone(detail.customerId))} />
              <KeyValue label="Nhân viên" value={detail.agent} />
              <KeyValue label="Hàng đợi" value={detail.queue} />
              <KeyValue label="Thời điểm" value={formatDateTime(detail.startedAt)} />
              <KeyValue label="Thời lượng" value={formatDuration(detail.durationSec)} />
              <KeyValue label="Chờ kết nối" value={`${detail.waitSec} giây`} />
              <KeyValue
                label="Cảm xúc khách hàng"
                value={
                  <Badge
                    label={sentimentMeta[detail.sentiment].label}
                    color={sentimentMeta[detail.sentiment].color}
                    bg={sentimentMeta[detail.sentiment].bg}
                  />
                }
              />
            </div>
            <div className="rounded-2xl bg-[#f8fafc] p-4">
              <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-[#8492a0]">Ghi chú của nhân viên</p>
              <textarea
                className="mt-2 h-24 w-full rounded-xl border border-[#dfe6ec] bg-white px-3.5 py-2.5 text-[13px] leading-6 outline-none focus:border-[#0f8b98]"
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                placeholder="Ghi lại nội dung trao đổi, nhu cầu và bước tiếp theo..."
              />
            </div>
            <div className="rounded-2xl border border-[#edf1f5] p-4">
              <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-[#8492a0]">Bản ghi âm</p>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => dispatch({ type: "toast", message: "Đang phát bản ghi âm", tone: "info" })}
                  className="grid h-10 w-10 place-items-center rounded-full bg-[#0f8b98] text-white"
                >
                  <IconPlay size={16} />
                </button>
                <div className="flex flex-1 items-end gap-1">
                  {RECORDING_BARS.map((bar) => (
                    <span
                      key={bar.id}
                      className="flex-1 rounded-full bg-[#cfe9ec]"
                      style={{ height: `${6 + Math.abs(Math.sin(bar.seed * 0.7)) * 22}px` }}
                    />
                  ))}
                </div>
                <span className="text-[12px] font-black text-[#4a5763]">{formatDuration(detail.durationSec)}</span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Điểm chất lượng" value="8,6/10" color="#15803d" />
              <Metric label="Từ khoá phát hiện" value="báo giá" />
              <Metric label="Đã gắn tag" value="Quan tâm cao" />
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
