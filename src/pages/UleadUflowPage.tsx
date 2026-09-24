import { useMemo, useState } from "react";
import { useApp } from "../lib/store";
import {
  formatNumber,
  formatPercent,
  leadSourceMeta,
  leadStatusMeta,
  nodeTypeMeta,
  recentDayLabels,
  relativeTime,
  workflowStatusMeta,
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
import { IconCheck, IconFlow, IconPlus, IconRefresh, IconSparkle, IconTarget, IconUsers, IconClose } from "../components/icons";
import type { WorkflowNode } from "../lib/types";

const NODE_WIDTH = 210;
const NODE_HEIGHT = 112;
const CANVAS_WIDTH = 880;
const CANVAS_HEIGHT = 510;

export function UleadUflowPage() {
  const { state, dispatch } = useApp();
  const [tab, setTab] = useState("ulead");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [status, setStatus] = useState("all");
  const [workflowId, setWorkflowId] = useState(state.workflows[0]?.id ?? "");
  const [nodeDetail, setNodeDetail] = useState<WorkflowNode | undefined>();
  const [assignOpen, setAssignOpen] = useState(false);

  const workflow = state.workflows.find((item) => item.id === workflowId) ?? state.workflows[0];

  const filteredLeads = useMemo(
    () =>
      state.leads.filter((lead) => {
        const matchQuery =
          query.trim() === "" || [lead.name, lead.phone, lead.email, lead.campaign].join(" ").toLowerCase().includes(query.toLowerCase());
        const matchSource = source === "all" || lead.source === source;
        const matchStatus = status === "all" || lead.status === status;
        return matchQuery && matchSource && matchStatus;
      }),
    [state.leads, query, source, status],
  );

  const sourceBreakdown = Object.entries(leadSourceMeta).map(([key, meta]) => ({
    key,
    label: meta.label,
    color: meta.color,
    count: state.leads.filter((lead) => lead.source === key).length,
  }));

  const hotLeads = state.leads.filter((lead) => lead.score >= 70);
  const duplicateLeads = state.leads.filter((lead) => lead.duplicate);
  const assignedLeads = state.leads.filter((lead) => lead.status === "da-chia");

  const trendLabels = recentDayLabels(12);
  const leadTrend = Array.from({ length: 12 }, (_, index) => ({
    label: trendLabels[index],
    values: [60 + ((index * 17) % 70), 18 + ((index * 7) % 26), 6 + ((index * 3) % 12)],
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Ulead & Uflow"
        title="Quản lý nguồn lead và quy trình tự động"
        description="Gom dữ liệu khách hàng tiềm năng từ mọi kênh, chấm điểm tự động, chia cho sales theo luật và thiết lập quy trình làm việc không cần thao tác thủ công."
        actions={
          <>
            <Button variant="outline" onClick={() => dispatch({ type: "toast", message: "Đã đồng bộ lead mới từ 5 nguồn dữ liệu", tone: "success" })}>
              <IconRefresh size={16} /> Đồng bộ lead
            </Button>
            <Button variant="gold" onClick={() => dispatch({ type: "toast", message: "Đã tạo workflow mới ở trạng thái bản nháp", tone: "success" })}>
              <IconPlus size={16} /> Tạo workflow
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Lead trong 24h" value={formatNumber(state.leads.filter((lead) => (Date.now() - new Date(lead.receivedAt).getTime()) / 3600000 < 24).length)} accent="#0f8b98" icon={<IconTarget size={20} />} hint={`Tổng ${state.leads.length} lead trong tệp`} />
        <StatCard label="Lead nóng (điểm >= 70)" value={formatNumber(hotLeads.length)} accent="#15803d" icon={<IconSparkle size={20} />} hint="Ưu tiên chia cho sales ngay" />
        <StatCard label="Lead trùng dữ liệu" value={formatNumber(duplicateLeads.length)} accent="#b45309" icon={<IconRefresh size={20} />} hint="Hệ thống tự phát hiện và gộp" />
        <StatCard label="Đã chia cho sales" value={formatNumber(assignedLeads.length)} accent="#7c3aed" icon={<IconUsers size={20} />} hint={`${state.workflows.filter((item) => item.status === "dang-chay").length} workflow đang chạy`} />
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        items={[
          { id: "ulead", label: "Ulead - Nguồn dữ liệu", count: state.leads.length },
          { id: "uflow", label: "Uflow - Quy trình tự động", count: state.workflows.length },
        ]}
      />

      {tab === "ulead" ? (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
            <Card>
              <CardHeader title="Lead thu về theo ngày" subtitle="Lead mới, lead đủ điều kiện và lead trùng" />
              <BarChart data={leadTrend} colors={["#0f8b98", "#15803d", "#f5b942"]} height={180} />
              <div className="mt-4 grid grid-cols-3 gap-3">
                <Metric label="Lead / ngày" value={formatNumber(Math.round(state.leads.length / 12) + 42)} />
                <Metric label="Tỉ lệ hợp lệ" value={formatPercent(88.4, 1)} color="#15803d" />
                <Metric label="Tỉ lệ trùng" value={formatPercent(state.leads.length ? (duplicateLeads.length / state.leads.length) * 100 : 0, 1)} color="#b45309" />
              </div>
            </Card>
            <Card>
              <CardHeader title="Cơ cấu nguồn lead" subtitle="Phân bổ theo kênh thu thập dữ liệu" />
              <Donut
                centerLabel="Tổng lead"
                centerValue={String(state.leads.length)}
                data={sourceBreakdown.map((entry) => ({ label: entry.label, value: entry.count, color: entry.color }))}
                size={150}
                thickness={20}
              />
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Kho dữ liệu lead"
              subtitle="Phân loại, chấm điểm và chia lead cho đội sales"
              action={
                <Button size="sm" onClick={() => setAssignOpen(true)}>
                  <IconFlow size={14} /> Chia lead tự động
                </Button>
              }
            />
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <SearchInput value={query} onChange={setQuery} placeholder="Tìm theo tên, số điện thoại, chiến dịch..." />
              </div>
              <Select
                label="Nguồn"
                value={source}
                onChange={setSource}
                options={[{ value: "all", label: "Tất cả" }, ...Object.entries(leadSourceMeta).map(([key, meta]) => ({ value: key, label: meta.label }))]}
              />
              <Select
                label="Trạng thái"
                value={status}
                onChange={setStatus}
                options={[{ value: "all", label: "Tất cả" }, ...Object.entries(leadStatusMeta).map(([key, meta]) => ({ value: key, label: meta.label }))]}
              />
            </div>

            <DataTable
              rowKey={(row) => row.id}
              rows={filteredLeads}
              emptyLabel="Không có lead phù hợp"
              columns={[
                {
                  key: "lead",
                  label: "Lead",
                  render: (row) => (
                    <div className="flex items-center gap-2.5">
                      <Avatar name={row.name} size={32} />
                      <div>
                        <p className="font-bold text-[#111a22]">{row.name}</p>
                        <p className="text-[11.5px] text-[#7b8894]">{row.phone}</p>
                      </div>
                    </div>
                  ),
                },
                {
                  key: "source",
                  label: "Nguồn",
                  render: (row) => (
                    <span className="text-[12.5px] font-bold" style={{ color: leadSourceMeta[row.source].color }}>
                      {leadSourceMeta[row.source].label}
                    </span>
                  ),
                },
                { key: "campaign", label: "Chiến dịch", render: (row) => <span className="text-[12.5px] text-[#5c6a76]">{row.campaign}</span> },
                {
                  key: "score",
                  label: "Điểm AI",
                  render: (row) => (
                    <div className="w-28">
                      <ProgressBar value={row.score} color={row.score >= 70 ? "#15803d" : row.score >= 45 ? "#b45309" : "#94a3b8"} showLabel />
                    </div>
                  ),
                },
                {
                  key: "status",
                  label: "Trạng thái",
                  render: (row) => <Badge label={leadStatusMeta[row.status].label} color={leadStatusMeta[row.status].color} bg={leadStatusMeta[row.status].bg} />,
                },
                {
                  key: "assigned",
                  label: "Phụ trách",
                  render: (row) => <span className="text-[12.5px] font-semibold text-[#4a5763]">{row.assignedTo ?? "Chưa chia"}</span>,
                },
                { key: "received", label: "Nhận lúc", render: (row) => <span className="text-[12.5px] text-[#7b8894]">{relativeTime(row.receivedAt)}</span> },
                {
                  key: "actions",
                  label: "",
                  render: (row) => (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={row.status === "da-chia" || row.status === "loai"}
                        onClick={() => dispatch({ type: "addLeadToTasks", leadId: row.id, assignee: state.currentUser.name })}
                      >
                        <IconUsers size={13} /> Chia
                      </Button>
                      <Button size="sm" variant="ghost" disabled={row.status === "loai"} onClick={() => dispatch({ type: "discardLead", leadId: row.id })}>
                        <IconClose size={13} />
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
          </Card>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card>
              <CardHeader title="Luật chia lead" subtitle="Áp dụng tự động khi lead mới về" />
              <ul className="space-y-3">
                {[
                  { rule: "Round-robin theo khu vực", detail: "Lead Hà Nội chia cho nhóm Miền Bắc, HCM chia nhóm Miền Nam" },
                  { rule: "Ưu tiên lead nóng", detail: "Điểm >= 70 chia ngay trong 60 giây, không qua hàng đợi" },
                  { rule: "Giới hạn tải", detail: "Mỗi sales tối đa 30 lead/ngày để đảm bảo chất lượng gọi" },
                  { rule: "Chống trùng lặp", detail: "Trùng số điện thoại sẽ gộp vào hồ sơ cũ, không tạo lead mới" },
                ].map((item) => (
                  <li key={item.rule} className="rounded-2xl border border-[#edf1f5] p-3.5">
                    <p className="flex items-center gap-2 text-[13px] font-black text-[#111a22]">
                      <IconCheck size={14} /> {item.rule}
                    </p>
                    <p className="mt-1.5 text-[12px] leading-5 text-[#7b8894]">{item.detail}</p>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardHeader title="Chất lượng dữ liệu" subtitle="Đánh giá độ sạch của tệp lead" />
              <div className="space-y-4">
                {[
                  { label: "Số điện thoại hợp lệ", value: 94 },
                  { label: "Email đúng định dạng", value: 88 },
                  { label: "Không trùng hồ sơ", value: 91 },
                  { label: "Có nhu cầu rõ ràng", value: 76 },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="mb-1.5 flex items-center justify-between text-[13px]">
                      <span className="font-bold text-[#33414d]">{item.label}</span>
                      <span className="font-black text-[#111a22]">{item.value}%</span>
                    </div>
                    <ProgressBar value={item.value} color={item.value >= 85 ? "#15803d" : "#b45309"} />
                  </div>
                ))}
              </div>
              <Button className="mt-5 w-full" variant="outline" onClick={() => dispatch({ type: "toast", message: "Đã chạy kiểm tra và làm sạch toàn bộ tệp lead", tone: "success" })}>
                <IconRefresh size={15} /> Làm sạch dữ liệu
              </Button>
            </Card>

            <Card className="bg-gradient-to-br from-[#0f8b98] to-[#0b5f68] text-white">
              <p className="flex items-center gap-2 text-[13px] font-black">
                <IconSparkle size={15} /> AI chấm điểm lead
              </p>
              <p className="mt-2.5 text-[12.5px] leading-6 text-white/80">
                Mô hình học từ 12.480 lead lịch sử, dự đoán khả năng chốt đơn dựa trên nguồn, hành vi và mức độ tương tác.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/12 px-3 py-2.5">
                  <p className="text-[11px] font-bold text-white/70">Độ chính xác</p>
                  <p className="mt-1 text-[15px] font-black">91,3%</p>
                </div>
                <div className="rounded-2xl bg-white/12 px-3 py-2.5">
                  <p className="text-[11px] font-bold text-white/70">Lead chấm / ngày</p>
                  <p className="mt-1 text-[15px] font-black">1.240</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
            <div className="space-y-4">
              {state.workflows.map((item) => {
                const meta = workflowStatusMeta[item.status];
                const isActive = item.id === workflow?.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setWorkflowId(item.id)}
                    className={`w-full rounded-3xl border p-4 text-left transition ${
                      isActive ? "border-[#0f8b98] bg-[#f2fbfc]" : "border-[#e6ebf0] bg-white hover:border-[#bfe3e8]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13.5px] font-black leading-5 text-[#111a22]">{item.name}</p>
                      <Badge label={meta.label} color={meta.color} bg={meta.bg} />
                    </div>
                    <p className="mt-2 text-[12px] text-[#7b8894]">Kích hoạt: {item.trigger}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                      <div className="rounded-xl bg-[#f8fafc] py-2">
                        <p className="text-[10.5px] font-bold text-[#8492a0]">Chạy hôm nay</p>
                        <p className="text-[12.5px] font-black text-[#111a22]">{formatNumber(item.runsToday)}</p>
                      </div>
                      <div className="rounded-xl bg-[#f8fafc] py-2">
                        <p className="text-[10.5px] font-bold text-[#8492a0]">Thành công</p>
                        <p className="text-[12.5px] font-black text-[#15803d]">{formatPercent(item.successRate, 1)}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-5">
              {workflow ? (
                <>
                  <Card>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-[19px] font-black tracking-[-0.02em] text-[#111a22]">{workflow.name}</h2>
                          <Badge
                            label={workflowStatusMeta[workflow.status].label}
                            color={workflowStatusMeta[workflow.status].color}
                            bg={workflowStatusMeta[workflow.status].bg}
                          />
                        </div>
                        <p className="mt-2 text-[13px] text-[#66757f]">
                          Kích hoạt: {workflow.trigger} • Chủ sở hữu: {workflow.owner} • Cập nhật {relativeTime(workflow.updatedAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2.5">
                        <Button variant={workflow.status === "dang-chay" ? "outline" : "primary"} onClick={() => dispatch({ type: "toggleWorkflow", id: workflow.id })}>
                          {workflow.status === "dang-chay" ? "Tạm dừng" : "Kích hoạt"}
                        </Button>
                        <Button variant="gold" onClick={() => dispatch({ type: "toast", message: "Đã chạy thử workflow với dữ liệu mẫu", tone: "success" })}>
                          <IconSparkle size={15} /> Chạy thử
                        </Button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-4">
                      <Metric label="Số bước" value={String(workflow.nodes.length)} />
                      <Metric label="Chạy hôm nay" value={formatNumber(workflow.runsToday)} color="#0f8b98" />
                      <Metric label="Tỉ lệ thành công" value={formatPercent(workflow.successRate, 1)} color="#15803d" />
                      <Metric label="Thời gian tiết kiệm" value={`${formatNumber(Math.round(workflow.runsToday * 3.2 / 60))} giờ`} />
                    </div>
                  </Card>

                  <Card padded={false} className="overflow-hidden">
                    <div className="border-b border-[#eef2f5] px-5 py-4">
                      <h3 className="text-[15px] font-extrabold text-[#111a22]">Sơ đồ quy trình</h3>
                      <p className="mt-1 text-[12.5px] text-[#7b8894]">Nhấn vào từng bước để xem cấu hình chi tiết</p>
                    </div>
                    <div className="overflow-x-auto bg-[#fafcfd] p-6">
                      <div className="relative" style={{ minWidth: CANVAS_WIDTH, width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
                        <svg
                          className="pointer-events-none absolute inset-0"
                          width={CANVAS_WIDTH}
                          height={CANVAS_HEIGHT}
                          aria-hidden="true"
                        >
                          <defs>
                            <marker id="workflow-arrow" markerWidth="9" markerHeight="9" refX="7" refY="3.2" orient="auto">
                              <path d="M0,0 L7,3.2 L0,6.4 Z" fill="#bfd9de" />
                            </marker>
                          </defs>
                          {workflow.edges.map((edge) => {
                            const from = workflow.nodes.find((node) => node.id === edge.from);
                            const to = workflow.nodes.find((node) => node.id === edge.to);
                            if (!from || !to) return null;

                            const sameRow = Math.abs(from.y - to.y) < NODE_HEIGHT / 2;
                            let path: string;
                            let labelX: number;
                            let labelY: number;

                            if (sameRow) {
                              const leftToRight = to.x > from.x;
                              const x1 = leftToRight ? from.x + NODE_WIDTH : from.x;
                              const x2 = leftToRight ? to.x : to.x + NODE_WIDTH;
                              const y = from.y + NODE_HEIGHT / 2;
                              path = `M${x1},${y} L${x2},${y}`;
                              labelX = (x1 + x2) / 2;
                              labelY = y - 8;
                            } else {
                              const x1 = from.x + NODE_WIDTH / 2;
                              const y1 = from.y + NODE_HEIGHT;
                              const x2 = to.x + NODE_WIDTH / 2;
                              const y2 = to.y;
                              const midY = (y1 + y2) / 2;
                              path = `M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`;
                              labelX = (x1 + x2) / 2;
                              labelY = midY + 4;
                            }

                            return (
                              <g key={`${edge.from}-${edge.to}`}>
                                <path d={path} fill="none" stroke="#bfd9de" strokeWidth="2" markerEnd="url(#workflow-arrow)" />
                                {edge.label ? (
                                  <text x={labelX} y={labelY} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#7b8894">
                                    {edge.label}
                                  </text>
                                ) : null}
                              </g>
                            );
                          })}
                        </svg>

                        {workflow.nodes.map((node) => {
                          const meta = nodeTypeMeta[node.type];
                          return (
                            <button
                              key={node.id}
                              type="button"
                              onClick={() => setNodeDetail(node)}
                              className="absolute overflow-hidden rounded-2xl border bg-white p-3.5 text-left shadow-[0_10px_30px_rgba(15,33,45,0.08)] transition hover:-translate-y-0.5 hover:border-[#0f8b98]"
                              style={{ left: node.x, top: node.y, width: NODE_WIDTH, height: NODE_HEIGHT, borderColor: `${meta.color}55` }}
                            >
                              <span
                                className="inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-black uppercase tracking-[0.06em]"
                                style={{ color: meta.color, backgroundColor: meta.bg }}
                              >
                                {meta.label}
                              </span>
                              <p className="mt-2 text-[13px] font-black leading-5 text-[#111a22]">{node.title}</p>
                              <p className="mt-1 text-[11.5px] leading-4 text-[#7b8894]">{node.detail}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <CardHeader title="Nhật ký chạy workflow" subtitle="Kết quả các lần chạy gần nhất" />
                    <DataTable
                      rowKey={(row) => row.id}
                      rows={Array.from({ length: 6 }, (_, index) => ({
                        id: `RUN-${index}`,
                        trigger: workflow.trigger,
                        lead: state.leads[(index * 3) % state.leads.length]?.name ?? "Lead",
                        result: index % 5 === 4 ? "Bỏ qua do trùng dữ liệu" : "Đã chia lead và gửi tin chào mừng",
                        at: new Date(Date.now() - (index + 1) * 18 * 60000).toISOString(),
                        ok: index % 5 !== 4,
                      }))}
                      columns={[
                        { key: "lead", label: "Đối tượng", render: (row) => <span className="font-bold text-[#111a22]">{row.lead}</span> },
                        { key: "trigger", label: "Kích hoạt", render: (row) => <span className="text-[12.5px] text-[#5c6a76]">{row.trigger}</span> },
                        {
                          key: "result",
                          label: "Kết quả",
                          render: (row) => <Badge label={row.result} color={row.ok ? "#15803d" : "#b45309"} bg={row.ok ? "#e7f7ec" : "#fdf1e0"} />,
                        },
                        { key: "at", label: "Thời điểm", render: (row) => <span className="text-[12.5px] text-[#7b8894]">{relativeTime(row.at)}</span> },
                      ]}
                    />
                  </Card>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(nodeDetail)}
        title={nodeDetail?.title ?? ""}
        subtitle={nodeDetail ? nodeTypeMeta[nodeDetail.type].label : ""}
        onClose={() => setNodeDetail(undefined)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setNodeDetail(undefined)}>
              Đóng
            </Button>
            <Button onClick={() => dispatch({ type: "toast", message: "Đã lưu cấu hình bước trong workflow", tone: "success" })}>Lưu cấu hình</Button>
          </>
        }
      >
        {nodeDetail ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <KeyValue label="Loại bước" value={nodeTypeMeta[nodeDetail.type].label} />
              <KeyValue label="Vị trí" value={`x: ${nodeDetail.x}, y: ${nodeDetail.y}`} />
            </div>
            <div className="rounded-2xl bg-[#f8fafc] p-4">
              <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-[#8492a0]">Mô tả</p>
              <p className="mt-2 text-[13px] leading-6 text-[#33414d]">{nodeDetail.detail}</p>
            </div>
            <div className="rounded-2xl bg-[#f8fafc] p-4">
              <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-[#8492a0]">Cấu hình mẫu</p>
              <ul className="mt-2 space-y-2 text-[12.5px] text-[#4a5763]">
                <li>• Thời gian chờ tối đa: 30 phút</li>
                <li>• Gửi thông báo qua: Zalo, Email</li>
                <li>• Ghi log vào hành trình khách hàng: Bật</li>
              </ul>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={assignOpen}
        title="Chia lead tự động"
        subtitle="Áp dụng luật chia cho toàn bộ lead đang chờ phân loại"
        onClose={() => setAssignOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAssignOpen(false)}>
              Huỷ
            </Button>
            <Button
              onClick={() => {
                setAssignOpen(false);
                const pending = state.leads.filter((lead) => lead.status === "moi");
                for (const lead of pending) {
                  dispatch({ type: "addLeadToTasks", leadId: lead.id, assignee: state.currentUser.name });
                }
                dispatch({ type: "toast", message: `Đã chia ${pending.length} lead cho đội sales theo luật round-robin`, tone: "success" });
              }}
            >
              <IconFlow size={15} /> Chia ngay
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Lead chờ chia" value={String(state.leads.filter((lead) => lead.status === "moi").length)} />
            <Metric label="Sales đang nhận" value={String(new Set(state.customers.map((customer) => customer.owner)).size)} color="#0f8b98" />
            <Metric label="Giới hạn / sales" value="30 lead" />
          </div>
          <div className="rounded-2xl bg-[#f8fafc] p-4">
            <p className="text-[12.5px] font-black text-[#111a22]">Thứ tự ưu tiên chia lead</p>
            <ol className="mt-3 space-y-2 text-[12.5px] text-[#4a5763]">
              <li>1. Lead nóng (điểm AI &gt;= 70) - chia ngay lập tức</li>
              <li>2. Lead theo khu vực - round-robin trong nhóm phụ trách</li>
              <li>3. Lead còn lại - chia đều theo tải hiện tại của sales</li>
              <li>4. Lead trùng - gộp vào hồ sơ cũ, thông báo cho owner</li>
            </ol>
          </div>
        </div>
      </Modal>
    </div>
  );
}
