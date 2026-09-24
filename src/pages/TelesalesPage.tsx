import { useCallback, useMemo, useState } from "react";
import { useApp } from "../lib/store";
import {
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercent,
  formatVnd,
  maskPhone,
  pipelineMeta,
  pipelineOrder,
  priorityMeta,
  relativeTime,
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
  EmptyState,
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
  IconCheck,
  IconClock,
  IconPhone,
  IconPhoneOff,
  IconPlay,
  IconSend,
  IconSparkle,
  IconTarget,
  IconUsers,
} from "../components/icons";
import type { TelesalesTask } from "../lib/types";

const SCRIPTS = [
  {
    id: "gioi-thieu",
    name: "Giới thiệu & khai thác nhu cầu",
    steps: [
      "Chào hỏi, xác nhận đúng người quyết định",
      "Hỏi về quy mô đội sales và công cụ đang dùng",
      "Nêu 3 lợi ích chính: gọi nhanh hơn, không sót khách, báo cáo rõ",
      "Hỏi câu hỏi chốt: anh/chị muốn xem demo khi nào?",
    ],
  },
  {
    id: "bao-gia",
    name: "Gửi báo giá & xử lý từ chối",
    steps: [
      "Nhắc lại giá trị đã trao đổi ở cuộc gọi trước",
      "Gửi báo giá theo số agent thực tế",
      "Xử lý phản đối về giá bằng ROI ước tính",
      "Đề xuất dùng thử 3 ngày miễn phí",
    ],
  },
  {
    id: "cham-soc",
    name: "Chăm sóc khách hàng cũ",
    steps: [
      "Hỏi thăm tình hình sử dụng sau 30 ngày",
      "Kiểm tra mức độ hài lòng 1-5",
      "Giới thiệu tính năng mới phù hợp",
      "Đề xuất upsell gói cao hơn nếu phù hợp",
    ],
  },
];

export function TelesalesPage() {
  const { state, dispatch } = useApp();
  const [tab, setTab] = useState("hang-doi");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("all");
  const [listName, setListName] = useState("all");
  const [scriptId, setScriptId] = useState(SCRIPTS[0].id);
  const [activeTaskId, setActiveTaskId] = useState<string | undefined>(state.telesalesTasks.find((task) => !task.done)?.id);
  const [detail, setDetail] = useState<TelesalesTask | undefined>();
  const [callSeconds, setCallSeconds] = useState(0);

  const customerOf = useCallback((id: string) => state.customers.find((customer) => customer.id === id), [state.customers]);
  const lists = useMemo(() => Array.from(new Set(state.telesalesTasks.map((task) => task.listName))), [state.telesalesTasks]);

  const filtered = useMemo(
    () =>
      state.telesalesTasks.filter((task) => {
        const customer = customerOf(task.customerId);
        const matchQuery =
          query.trim() === "" ||
          [customer?.name, customer?.company, customer?.phone, task.listName].join(" ").toLowerCase().includes(query.toLowerCase());
        const matchPriority = priority === "all" || task.priority === priority;
        const matchList = listName === "all" || task.listName === listName;
        return matchQuery && matchPriority && matchList;
      }),
    [state.telesalesTasks, query, priority, listName, customerOf],
  );

  const activeTask = state.telesalesTasks.find((task) => task.id === activeTaskId);
  const activeCustomer = activeTask ? customerOf(activeTask.customerId) : undefined;
  const script = SCRIPTS.find((item) => item.id === scriptId) ?? SCRIPTS[0];

  const done = state.telesalesTasks.filter((task) => task.done);
  const won = done.filter((task) => task.outcome === "chot-don").length;
  const callbacks = done.filter((task) => task.outcome === "hen-lai").length;

  const hourly = Array.from({ length: 10 }, (_, index) => {
    const hour = 8 + index;
    return {
      label: `${String(hour).padStart(2, "0")}h`,
      values: [8 + ((index * 4) % 12), 3 + ((index * 2) % 6)],
    };
  });

  const pipelineValue = state.customers.flatMap((customer) => customer.deals);
  const dealsByStage = pipelineOrder.map((stage) => ({
    stage,
    label: pipelineMeta[stage].label,
    color: pipelineMeta[stage].color,
    deals: pipelineValue.filter((deal) => deal.stage === stage),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Telesales"
        title="Bàn làm việc telesales"
        description="Quản lý danh sách cuộc gọi, gọi trực tiếp trên máy tính với kịch bản gợi ý và ghi nhận kết quả ngay vào pipeline bán hàng."
        actions={
          <>
            <Button variant="outline" onClick={() => dispatch({ type: "toast", message: "Đã đồng bộ danh sách gọi từ Ulead", tone: "success" })}>
              <IconSparkle size={16} /> Đồng bộ danh sách
            </Button>
            <Button onClick={() => setTab("pipeline")}>
              <IconTarget size={16} /> Xem pipeline
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Việc cần gọi hôm nay" value={String(state.telesalesTasks.filter((task) => !task.done).length)} accent="#0f8b98" icon={<IconPhone size={20} />} hint={`${state.telesalesTasks.length} việc trong hàng đợi`} />
        <StatCard label="Đã chốt đơn" value={String(won)} accent="#15803d" icon={<IconCheck size={20} />} hint={`Tỉ lệ chốt ${formatPercent(done.length ? (won / done.length) * 100 : 0, 1)}`} />
        <StatCard label="Hẹn gọi lại" value={String(callbacks)} accent="#b45309" icon={<IconClock size={20} />} hint="Tự động nhắc đúng giờ" />
        <StatCard label="Doanh thu dự kiến" value={formatVnd(pipelineValue.filter((deal) => deal.stage !== "thua").reduce((sum, deal) => sum + deal.value, 0))} accent="#7c3aed" icon={<IconTarget size={20} />} hint="Theo giá trị deal đang mở" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader
            title="Danh sách cuộc gọi"
            subtitle="Ưu tiên theo điểm tiềm năng và thời hạn xử lý"
            action={
              <Tabs
                size="sm"
                active={tab}
                onChange={setTab}
                items={[
                  { id: "hang-doi", label: "Hàng đợi", count: state.telesalesTasks.filter((task) => !task.done).length },
                  { id: "da-goi", label: "Đã gọi", count: done.length },
                  { id: "pipeline", label: "Pipeline" },
                ]}
              />
            }
          />

          {tab !== "pipeline" ? (
            <>
              <div className="mb-4 flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1">
                  <SearchInput value={query} onChange={setQuery} placeholder="Tìm theo khách hàng, công ty, số điện thoại..." />
                </div>
                <Select
                  label="Ưu tiên"
                  value={priority}
                  onChange={setPriority}
                  options={[{ value: "all", label: "Tất cả" }, ...Object.entries(priorityMeta).map(([key, meta]) => ({ value: key, label: meta.label }))]}
                />
                <Select label="Danh sách" value={listName} onChange={setListName} options={[{ value: "all", label: "Tất cả" }, ...lists.map((name) => ({ value: name, label: name }))]} />
              </div>

              <DataTable
                rowKey={(row) => row.id}
                rows={tab === "hang-doi" ? filtered.filter((task) => !task.done) : filtered.filter((task) => task.done)}
                onRowClick={(row) => setDetail(row)}
                emptyLabel="Không còn việc nào trong hàng đợi"
                columns={[
                  {
                    key: "customer",
                    label: "Khách hàng",
                    render: (row) => {
                      const customer = customerOf(row.customerId);
                      return (
                        <div className="flex items-center gap-2.5">
                          <Avatar name={customer?.name ?? "Khách"} size={32} />
                          <div>
                            <p className="font-bold text-[#111a22]">{customer?.name}</p>
                            <p className="text-[11.5px] text-[#7b8894]">{customer ? maskPhone(customer.phone) : ""}</p>
                          </div>
                        </div>
                      );
                    },
                  },
                  {
                    key: "priority",
                    label: "Ưu tiên",
                    render: (row) => <Badge label={priorityMeta[row.priority].label} color={priorityMeta[row.priority].color} bg={priorityMeta[row.priority].bg} />,
                  },
                  { key: "list", label: "Danh sách", render: (row) => <span className="text-[12.5px] font-semibold text-[#4a5763]">{row.listName}</span> },
                  { key: "attempts", label: "Số lần gọi", render: (row) => <span className="font-black">{row.attempts}</span> },
                  { key: "result", label: "Kết quả gần nhất", render: (row) => <span className="text-[12.5px] text-[#5c6a76]">{row.lastResult}</span> },
                  {
                    key: "due",
                    label: tab === "hang-doi" ? "Hạn xử lý" : "Kết quả",
                    render: (row) =>
                      tab === "hang-doi" ? (
                        <span className={`text-[12.5px] font-bold ${new Date(row.dueAt).getTime() < Date.now() ? "text-[#be123c]" : "text-[#15803d]"}`}>
                          {relativeTime(row.dueAt)}
                        </span>
                      ) : (
                        <Badge label={row.lastResult} color="#15803d" bg="#e7f7ec" />
                      ),
                  },
                  {
                    key: "action",
                    label: "",
                    render: (row) => (
                      <Button
                        size="sm"
                        variant={row.done ? "ghost" : "primary"}
                        onClick={() => {
                          setActiveTaskId(row.id);
                          setCallSeconds(0);
                        }}
                      >
                        <IconPhone size={13} /> {row.done ? "Gọi lại" : "Gọi"}
                      </Button>
                    ),
                  },
                ]}
              />
            </>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {dealsByStage.map((column) => (
                <div key={column.stage} className="rounded-2xl bg-[#f8fafc] p-3.5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-[12.5px] font-black text-[#111a22]">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: column.color }} />
                      {column.label}
                    </span>
                    <span className="text-[11.5px] font-bold text-[#8492a0]">{column.deals.length} deal</span>
                  </div>
                  <div className="space-y-2.5">
                    {column.deals.slice(0, 4).map((deal) => (
                      <div key={deal.id} className="rounded-xl border border-[#e9eef3] bg-white p-3">
                        <p className="text-[12.5px] font-bold leading-5 text-[#25313d]">{deal.name}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[12.5px] font-black text-[#0f8b98]">{formatVnd(deal.value)}</span>
                          <span className="text-[11px] font-semibold text-[#8492a0]">{deal.owner.split(" ").slice(-2).join(" ")}</span>
                        </div>
                      </div>
                    ))}
                    {column.deals.length === 0 ? <p className="py-4 text-center text-[12px] font-semibold text-[#98a4ae]">Chưa có deal</p> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card className="bg-[#101f27] text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/12">
                  <IconPhone size={18} />
                </span>
                <div>
                  <p className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-white/55">Softphone</p>
                  <p className="text-[14px] font-black">{activeCustomer?.name ?? "Chưa chọn khách hàng"}</p>
                </div>
              </div>
              {activeTask ? (
                <Badge label={priorityMeta[activeTask.priority].label} color="#0b3d44" bg="#7cc9d2" />
              ) : null}
            </div>

            {activeCustomer ? (
              <>
                <p className="mt-4 text-[13px] font-semibold text-white/70">{maskPhone(activeCustomer.phone)}</p>
                <p className="mt-4 text-[38px] font-black leading-none tracking-[-0.04em]">{formatDuration(callSeconds)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="gold" onClick={() => setCallSeconds((value) => value + 5)}>
                    <IconPlay size={14} /> Bắt đầu gọi
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setCallSeconds(0);
                      dispatch({ type: "toast", message: "Đã kết thúc cuộc gọi, mời ghi nhận kết quả", tone: "info" });
                    }}
                  >
                    <IconPhoneOff size={14} /> Kết thúc
                  </Button>
                </div>
                <div className="mt-5 rounded-2xl bg-white/10 p-3.5">
                  <p className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-white/60">Kịch bản đang dùng</p>
                  <select
                    className="mt-2 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[12.5px] font-semibold text-white outline-none"
                    value={scriptId}
                    onChange={(event) => setScriptId(event.target.value)}
                  >
                    {SCRIPTS.map((item) => (
                      <option key={item.id} value={item.id} className="text-[#111a22]">
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <ol className="mt-3 space-y-2">
                    {script.steps.map((step, index) => (
                      <li key={step} className="flex gap-2 text-[12px] leading-5 text-white/80">
                        <span className="font-black text-[#7cc9d2]">{index + 1}.</span> {step}
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  {(["chot-don", "hen-lai", "tu-choi", "khong-nghe-may"] as const).map((outcome) => (
                    <Button
                      key={outcome}
                      size="sm"
                      variant={outcome === "chot-don" ? "primary" : "ghost"}
                      onClick={() => {
                        if (!activeTask) return;
                        dispatch({ type: "completeTask", id: activeTask.id, outcome });
                        const nextTask = state.telesalesTasks.find((task) => !task.done && task.id !== activeTask.id);
                        setActiveTaskId(nextTask?.id);
                        setCallSeconds(0);
                      }}
                    >
                      {outcomeLabel(outcome)}
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-4 text-[12.5px] text-white/60">Chọn một khách hàng trong danh sách để bắt đầu cuộc gọi.</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Hiệu suất hôm nay" subtitle="Số cuộc gọi và tỉ lệ chốt đơn theo giờ" />
            <BarChart data={hourly} colors={["#0f8b98", "#15803d"]} height={140} />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric label="Tổng cuộc gọi" value={String(state.telesalesTasks.reduce((sum, task) => sum + task.attempts, 0))} />
              <Metric label="Tỉ lệ chốt" value={formatPercent(done.length ? (won / done.length) * 100 : 0, 1)} color="#15803d" />
            </div>
          </Card>

          <Card>
            <CardHeader title="Nhắc việc tự động" subtitle="Hệ thống sẽ nhắc đúng giờ qua app và Zalo" />
            <ul className="space-y-2.5">
              {state.telesalesTasks
                .filter((task) => !task.done)
                .slice(0, 4)
                .map((task) => {
                  const customer = customerOf(task.customerId);
                  return (
                    <li key={task.id} className="flex items-center gap-3 rounded-2xl border border-[#edf1f5] p-3">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-[#fdf1e0] text-[#b45309]">
                        <IconClock size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-bold text-[#25313d]">{customer?.name}</p>
                        <p className="text-[11.5px] text-[#8492a0]">{formatDateTime(task.dueAt)}</p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "snoozeTask", id: task.id })}>
                        Dời 2h
                      </Button>
                    </li>
                  );
                })}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Đội ngũ của tôi" subtitle="Xếp hạng theo số cuộc gọi và tỉ lệ chốt" />
            <ul className="space-y-3">
              {[...state.agents]
                .sort((a, b) => b.callsToday - a.callsToday)
                .slice(0, 5)
                .map((agent, index) => (
                  <li key={agent.id} className="flex items-center gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#f1f5f8] text-[12px] font-black text-[#4a5763]">{index + 1}</span>
                    <Avatar name={agent.name} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-bold text-[#25313d]">{agent.name}</p>
                      <ProgressBar value={agent.callsToday} max={state.agents[0].callsToday} color="#0f8b98" height={6} />
                    </div>
                    <span className="text-[12px] font-black text-[#111a22]">{agent.callsToday}</span>
                  </li>
                ))}
            </ul>
            <Button className="mt-4 w-full" variant="outline" onClick={() => dispatch({ type: "toast", message: "Đã mở báo cáo KPI đội telesales", tone: "info" })}>
              <IconUsers size={15} /> Xem báo cáo KPI
            </Button>
          </Card>
        </div>
      </div>

      <Modal
        open={Boolean(detail)}
        title={detail ? (customerOf(detail.customerId)?.name ?? "Khách hàng") : ""}
        subtitle={detail ? `${detail.listName} • ${detail.script}` : ""}
        onClose={() => setDetail(undefined)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDetail(undefined)}>
              Đóng
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!detail) return;
                dispatch({ type: "snoozeTask", id: detail.id });
                setDetail(undefined);
              }}
            >
              Dời lịch 2 giờ
            </Button>
            <Button
              onClick={() => {
                if (!detail) return;
                dispatch({ type: "completeTask", id: detail.id, outcome: "chot-don" });
                setDetail(undefined);
              }}
            >
              <IconCheck size={15} /> Đánh dấu chốt đơn
            </Button>
          </>
        }
      >
        {detail ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <KeyValue label="Khách hàng" value={customerOf(detail.customerId)?.name ?? "—"} />
              <KeyValue label="Công ty" value={customerOf(detail.customerId)?.company ?? "—"} />
              <KeyValue label="Điện thoại" value={maskPhone(customerOf(detail.customerId)?.phone ?? "")} />
              <KeyValue label="Ưu tiên" value={priorityMeta[detail.priority].label} />
              <KeyValue label="Số lần đã gọi" value={`${detail.attempts} lần`} />
              <KeyValue label="Hạn xử lý" value={formatDateTime(detail.dueAt)} />
            </div>
            <div className="rounded-2xl bg-[#f8fafc] p-4">
              <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-[#8492a0]">Kịch bản gợi ý</p>
              <p className="mt-2 text-[13px] leading-6 text-[#33414d]">{detail.script}</p>
            </div>
            <div className="rounded-2xl bg-[#f8fafc] p-4">
              <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-[#8492a0]">Kết quả gần nhất</p>
              <p className="mt-2 text-[13px] font-bold text-[#111a22]">{detail.lastResult}</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="outline" onClick={() => dispatch({ type: "sendQuote", taskId: detail.id })}>
                <IconSend size={15} /> Gửi báo giá
              </Button>
              <Button variant="outline" onClick={() => dispatch({ type: "scheduleDemo", taskId: detail.id })}>
                <IconClock size={15} /> Đặt lịch demo
              </Button>
            </div>
            {detail.done ? null : <EmptyState title="Chưa ghi nhận kết quả" hint="Chọn một kết quả sau khi kết thúc cuộc gọi để cập nhật pipeline." />}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function outcomeLabel(outcome: NonNullable<TelesalesTask["outcome"]>): string {
  switch (outcome) {
    case "chot-don":
      return "Chốt đơn";
    case "hen-lai":
      return "Hẹn gọi lại";
    case "tu-choi":
      return "Từ chối";
    default:
      return "Không nghe máy";
  }
}
