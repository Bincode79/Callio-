import { useMemo, useState, type ReactNode } from "react";
import { useApp, useDashboardMetrics } from "../lib/store";
import { useRouter } from "../lib/router";
import {
  callStatusMeta,
  channelMeta,
  formatDuration,
  formatNumber,
  formatPercent,
  formatVnd,
  relativeTime,
} from "../lib/format";
import { PageHeader } from "../components/AppShell";
import {
  Avatar,
  BarChart,
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  Donut,
  LineChart,
  Metric,
  ProgressBar,
  StatCard,
  Tabs,
} from "../components/ui";
import {
  IconArrowRight,
  IconChart,
  IconChat,
  IconPhone,
  IconRobot,
  IconSend,
  IconSparkle,
  IconTarget,
  IconUsers,
} from "../components/icons";
import type { CallRecord } from "../lib/types";

export function DashboardPage() {
  const { state, dispatch } = useApp();
  const metrics = useDashboardMetrics();
  const { navigate } = useRouter();
  const [range, setRange] = useState("hom-nay");
  const [boardTab, setBoardTab] = useState("tong-dai");

  const liveCalls = state.calls.filter((call) => call.status === "talking" || call.status === "ringing").slice(0, 5);
  const hotConversations = [...state.conversations]
    .filter((item) => item.status !== "da-xu-ly")
    .sort((a, b) => b.unread - a.unread)
    .slice(0, 5);
  const topTasks = state.telesalesTasks.filter((task) => !task.done).slice(0, 5);
  const callbotRunning = state.callbotCampaigns.filter((campaign) => campaign.status === "dang-chay");

  const customerName = (id: string) => state.customers.find((customer) => customer.id === id)?.name ?? "Khách hàng";

  const automationRuns = useMemo(
    () => state.workflows.reduce((sum, workflow) => sum + workflow.runsToday, 0),
    [state.workflows],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Trung tâm điều hành"
        title="Tổng quan hoạt động kinh doanh"
        description="Theo dõi toàn bộ hoạt động tổng đài, hội thoại đa kênh, chiến dịch Callbot và tiến độ đội telesales trên một màn hình duy nhất."
        actions={
          <>
            <Tabs
              size="sm"
              active={range}
              onChange={setRange}
              items={[
                { id: "hom-nay", label: "Hôm nay" },
                { id: "tuan", label: "Tuần này" },
                { id: "thang", label: "Tháng 9" },
                { id: "quy", label: "Quý 3" },
              ]}
            />
            <Button variant="gold" onClick={() => navigate("/callbot")}>
              <IconSparkle size={16} /> Tạo chiến dịch AI
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Khách hàng đang quản lý"
          value={formatNumber(metrics.totalCustomers)}
          delta="+12%"
          hint={`${metrics.newLeadsToday} lead mới trong 24h`}
          accent="#0f8b98"
          icon={<IconUsers size={20} />}
        />
        <StatCard
          label="Giá trị pipeline"
          value={formatVnd(metrics.pipelineValue)}
          delta="+18%"
          hint={`Đã chốt: ${formatVnd(metrics.wonValue)}`}
          accent="#b45309"
          icon={<IconTarget size={20} />}
        />
        <StatCard
          label="Cuộc gọi hôm nay"
          value={formatNumber(metrics.callsToday)}
          delta="+7%"
          hint={`Tỉ lệ nghe máy ${formatPercent(metrics.answerRate, 1)} • ${metrics.missedCalls} cuộc nhỡ`}
          accent="#2563eb"
          icon={<IconPhone size={20} />}
        />
        <StatCard
          label="Hội thoại đang mở"
          value={formatNumber(metrics.openConversations)}
          delta={metrics.slaBreached > 0 ? "-4%" : "+3%"}
          hint={`${metrics.slaBreached} hội thoại quá SLA cần xử lý`}
          accent="#be123c"
          icon={<IconChat size={20} />}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader
            title="Lưu lượng cuộc gọi theo giờ"
            subtitle="So sánh cuộc gọi vào, cuộc gọi ra và cuộc gọi nhỡ trong ngày"
            action={
              <div className="flex items-center gap-3 text-[12px] font-bold text-[#5c6a76]">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#0f8b98]" /> Gọi vào
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#7cc9d2]" /> Gọi ra
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#f5b942]" /> Nhỡ
                </span>
              </div>
            }
          />
          <BarChart
            data={metrics.hourlyCalls.map((item) => ({ label: item.hour, values: [item.inbound, item.outbound, item.missed] }))}
            colors={["#0f8b98", "#7cc9d2", "#f5b942"]}
            height={200}
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric label="Thời lượng xử lý TB" value={formatDuration(metrics.avgHandleSec)} />
            <Metric label="Tỉ lệ nghe máy" value={formatPercent(metrics.answerRate, 1)} color="#15803d" />
            <Metric label="Cuộc gọi nhỡ" value={formatNumber(metrics.missedCalls)} color="#be123c" />
          </div>
        </Card>

        <Card>
          <CardHeader title="Hội thoại theo kênh" subtitle="Phân bổ tin nhắn và cuộc gọi theo kênh giao tiếp" />
          <Donut
            centerLabel="Hội thoại"
            centerValue={formatNumber(metrics.channelSplit.reduce((sum, item) => sum + item.count, 0))}
            data={metrics.channelSplit.map((item) => ({
              label: item.label,
              value: item.count,
              color: item.color,
            }))}
          />
          <div className="mt-5 space-y-3 border-t border-[#eef2f5] pt-5">
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-semibold text-[#5c6a76]">Tỉ lệ phản hồi trong SLA</span>
              <span className="font-black text-[#111a22]">92%</span>
            </div>
            <ProgressBar value={92} color="#15803d" />
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-semibold text-[#5c6a76]">Khách hàng hài lòng (CSAT)</span>
              <span className="font-black text-[#111a22]">4,7/5</span>
            </div>
            <ProgressBar value={94} color="#0f8b98" />
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader
            title="Chiến dịch Callbot đang chạy"
            subtitle="Trợ lý AI tự động gọi xác nhận đơn và nhắc lịch"
            action={
              <Button size="sm" variant="outline" onClick={() => navigate("/callbot")}>
                Quản lý <IconArrowRight size={14} />
              </Button>
            }
          />
          <div className="space-y-4">
            {callbotRunning.map((campaign) => {
              const confirmRate = campaign.connected ? (campaign.confirmed / campaign.connected) * 100 : 0;
              return (
                <div key={campaign.id} className="rounded-2xl border border-[#edf1f5] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[13.5px] font-black text-[#111a22]">{campaign.name}</p>
                      <p className="mt-1 text-[12px] text-[#7b8894]">{campaign.voice}</p>
                    </div>
                    <Badge label="Đang chạy" color="#15803d" bg="#e7f7ec" />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-[#f8fafc] px-2 py-2">
                      <p className="text-[11px] font-bold text-[#8492a0]">Đã gọi</p>
                      <p className="text-[14px] font-black text-[#111a22]">{formatNumber(campaign.connected)}</p>
                    </div>
                    <div className="rounded-xl bg-[#f8fafc] px-2 py-2">
                      <p className="text-[11px] font-bold text-[#8492a0]">Xác nhận</p>
                      <p className="text-[14px] font-black text-[#15803d]">{formatNumber(campaign.confirmed)}</p>
                    </div>
                    <div className="rounded-xl bg-[#f8fafc] px-2 py-2">
                      <p className="text-[11px] font-bold text-[#8492a0]">Gọi lại</p>
                      <p className="text-[14px] font-black text-[#b45309]">{formatNumber(campaign.callback)}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <ProgressBar value={confirmRate} color="#15803d" showLabel />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Hội thoại cần ưu tiên"
            subtitle="Sắp xếp theo số tin nhắn chưa đọc và thời gian chờ"
            action={
              <Button size="sm" variant="outline" onClick={() => navigate("/da-kenh")}>
                Mở hộp thư <IconArrowRight size={14} />
              </Button>
            }
          />
          <ul className="space-y-3">
            {hotConversations.map((conversation) => {
              const meta = channelMeta[conversation.channel];
              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/da-kenh/${conversation.id}`)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-[#edf1f5] p-3 text-left transition hover:border-[#bfe3e8] hover:bg-[#f8fdfd]"
                  >
                    <Avatar name={customerName(conversation.customerId)} size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13.5px] font-black text-[#111a22]">{customerName(conversation.customerId)}</p>
                        <Badge label={meta.short} color={meta.color} bg={meta.bg} />
                      </div>
                      <p className="mt-1 truncate text-[12.5px] text-[#7b8894]">{conversation.subject}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11.5px] font-bold text-[#8492a0]">{relativeTime(conversation.updatedAt)}</p>
                      {conversation.unread > 0 ? (
                        <span className="mt-1 inline-block rounded-full bg-[#be123c] px-2 py-0.5 text-[11px] font-black text-white">
                          {conversation.unread} mới
                        </span>
                      ) : (
                        <span className="mt-1 inline-block text-[11.5px] font-bold text-[#15803d]">Đã đọc</span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Cuộc gọi trực tiếp"
            subtitle="Tổng đài đang kết nối đội ngũ nhân viên"
            action={<Badge label="Live" color="#be123c" bg="#fdeaee" />}
          />
          <ul className="space-y-3">
            {liveCalls.map((call) => {
              const meta = callStatusMeta[call.status];
              return (
                <li key={call.id} className="rounded-2xl border border-[#edf1f5] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-[#e5f7f9] text-[#0f8b98]">
                        <IconPhone size={16} />
                      </span>
                      <div>
                        <p className="text-[13.5px] font-black text-[#111a22]">{customerName(call.customerId)}</p>
                        <p className="text-[11.5px] text-[#7b8894]">
                          {call.agent} • {call.queue}
                        </p>
                      </div>
                    </div>
                    <Badge label={meta.label} color={meta.color} bg={meta.bg} />
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-[12px] font-semibold text-[#5c6a76]">
                    <span>Thời lượng: {formatDuration(call.durationSec)}</span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-[#22c55e]" /> {relativeTime(call.startedAt)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Metric label="Agent online" value={`${state.agents.filter((agent) => agent.status !== "offline").length}/${state.agents.length}`} />
            <Metric label="Automation chạy" value={formatNumber(automationRuns)} color="#0f8b98" />
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader
            title="Hiệu suất đội ngũ"
            subtitle="Bảng xếp hạng theo số cuộc gọi và tỉ lệ chốt đơn"
            action={
              <Tabs
                size="sm"
                active={boardTab}
                onChange={setBoardTab}
                items={[
                  { id: "tong-dai", label: "Tổng đài" },
                  { id: "telesales", label: "Telesales" },
                ]}
              />
            }
          />
          <DataTable
            rowKey={(row) => row.name}
            rows={metrics.leaderboard.slice(0, 6)}
            columns={[
              {
                key: "name",
                label: "Nhân viên",
                render: (row) => (
                  <div className="flex items-center gap-2.5">
                    <Avatar name={row.name} size={32} />
                    <span className="font-bold text-[#111a22]">{row.name}</span>
                  </div>
                ),
              },
              { key: "calls", label: "Cuộc gọi", render: (row) => <span className="font-black">{row.calls}</span> },
              { key: "won", label: "Chốt đơn", render: (row) => <span className="font-black text-[#15803d]">{row.won}</span> },
              {
                key: "rate",
                label: "Tỉ lệ nghe máy",
                render: (row) => (
                  <div className="w-32">
                    <ProgressBar value={row.rate} color={row.rate > 90 ? "#15803d" : "#b45309"} showLabel />
                  </div>
                ),
              },
            ]}
          />
        </Card>

        <Card>
          <CardHeader title="Phễu chuyển đổi" subtitle="Từ lead thu về đến hợp đồng đã ký" />
          <div className="space-y-3.5">
            {metrics.funnel.map((step, index) => {
              const max = metrics.funnel[0].value;
              const rate = index === 0 ? 100 : (step.value / metrics.funnel[index - 1].value) * 100;
              return (
                <div key={step.label}>
                  <div className="mb-1.5 flex items-center justify-between text-[13px]">
                    <span className="font-bold text-[#33414d]">{step.label}</span>
                    <span className="font-black text-[#111a22]">
                      {formatNumber(step.value)}{" "}
                      <span className="ml-1 text-[11.5px] font-bold text-[#8492a0]">
                        {index === 0 ? "100%" : `${rate.toFixed(0)}%`}
                      </span>
                    </span>
                  </div>
                  <ProgressBar value={step.value} max={max} color={index === metrics.funnel.length - 1 ? "#15803d" : "#0f8b98"} height={10} />
                </div>
              );
            })}
          </div>
          <div className="mt-5 rounded-2xl bg-[#f8fafc] p-4">
            <p className="flex items-center gap-2 text-[13px] font-black text-[#111a22]">
              <IconChart size={16} /> Xu hướng 8 tuần
            </p>
            <LineChart
              labels={metrics.trend.map((item) => item.label.replace("Tuần ", "T"))}
              points={metrics.trend.map((item) => item.leads)}
              secondaryPoints={metrics.trend.map((item) => item.won)}
              height={130}
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Hoạt động gần nhất trên toàn hệ thống"
            subtitle="Dòng thời gian hợp nhất cuộc gọi, tin nhắn, Callbot và workflow"
            action={
              <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "toast", message: "Đã làm mới dữ liệu hoạt động", tone: "info" })}>
                Làm mới
              </Button>
            }
          />
          <ul className="space-y-3">
            {buildActivityFeed(state.calls, state.conversations, state.callbotCampaigns, customerName).map((item) => (
              <li key={item.id} className="flex items-start gap-3 rounded-2xl border border-[#f0f4f7] px-3.5 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ backgroundColor: item.bg, color: item.color }}>
                  {item.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-bold text-[#111a22]">{item.title}</p>
                  <p className="mt-1 text-[12.5px] leading-5 text-[#7b8894]">{item.detail}</p>
                </div>
                <span className="whitespace-nowrap text-[11.5px] font-semibold text-[#98a4ae]">{relativeTime(item.at)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Việc telesales cần làm" subtitle="Danh sách gọi ưu tiên trong hôm nay" />
            <ul className="space-y-2.5">
              {topTasks.map((task) => (
                <li key={task.id} className="rounded-2xl border border-[#edf1f5] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[13px] font-black text-[#111a22]">{customerName(task.customerId)}</p>
                    <Badge label={task.priority === "cao" ? "Ưu tiên cao" : task.priority === "trung-binh" ? "Trung bình" : "Thấp"} color={task.priority === "cao" ? "#be123c" : "#b45309"} bg={task.priority === "cao" ? "#fdeaee" : "#fdf1e0"} />
                  </div>
                  <p className="mt-1.5 text-[12px] text-[#7b8894]">{task.script}</p>
                  <div className="mt-2 flex items-center justify-between text-[11.5px] font-semibold text-[#8492a0]">
                    <span>{task.listName}</span>
                    <span>Đã gọi {task.attempts} lần</span>
                  </div>
                </li>
              ))}
            </ul>
            <Button className="mt-4 w-full" variant="outline" onClick={() => navigate("/telesales")}>
              Mở workspace telesales <IconArrowRight size={15} />
            </Button>
          </Card>

          <Card>
            <CardHeader title="Kênh nhắn tin hiệu quả" subtitle="Chiến dịch đang chạy và tỉ lệ phản hồi" />
            <div className="space-y-3.5">
              {state.messagingCampaigns
                .filter((campaign) => campaign.sent > 0)
                .slice(0, 4)
                .map((campaign) => {
                  const replyRate = campaign.delivered ? (campaign.replied / campaign.delivered) * 100 : 0;
                  const meta = channelMeta[campaign.channel];
                  return (
                    <div key={campaign.id}>
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-[13px]">
                        <span className="flex items-center gap-2 truncate font-bold text-[#33414d]">
                          <Badge label={meta.short} color={meta.color} bg={meta.bg} />
                          <span className="truncate">{campaign.name}</span>
                        </span>
                        <span className="font-black text-[#111a22]">{formatPercent(replyRate, 1)}</span>
                      </div>
                      <ProgressBar value={replyRate} max={30} color="#0f8b98" />
                    </div>
                  );
                })}
            </div>
            <Button className="mt-4 w-full" variant="outline" onClick={() => navigate("/nhan-tin")}>
              Xem tất cả chiến dịch <IconSend size={15} />
            </Button>
          </Card>

          <Card className="bg-gradient-to-br from-[#0f8b98] to-[#0b5f68] text-white">
            <p className="flex items-center gap-2 text-[13px] font-black">
              <IconRobot size={16} /> Callbot AI đã gọi thay đội ngũ
            </p>
            <p className="mt-3 text-[30px] font-black leading-none tracking-[-0.03em]">{formatNumber(metrics.callbotConnected)}</p>
            <p className="mt-1.5 text-[12.5px] text-white/75">cuộc gọi tự động trong tháng 9</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/12 px-3 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-white/70">Xác nhận</p>
                <p className="mt-1 text-[16px] font-black">{formatNumber(metrics.callbotConfirmed)}</p>
              </div>
              <div className="rounded-2xl bg-white/12 px-3 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-white/70">Tiết kiệm</p>
                <p className="mt-1 text-[16px] font-black">~640 giờ</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  at: string;
  color: string;
  bg: string;
  icon: ReactNode;
}

function buildActivityFeed(
  calls: CallRecord[],
  conversations: ReturnType<typeof useApp>["state"]["conversations"],
  callbotCampaigns: ReturnType<typeof useApp>["state"]["callbotCampaigns"],
  customerName: (id: string) => string,
): ActivityItem[] {
  const callItems: ActivityItem[] = calls.slice(0, 4).map((call) => ({
    id: call.id,
    title: `${call.direction === "inbound" ? "Cuộc gọi vào" : "Cuộc gọi ra"} • ${customerName(call.customerId)}`,
    detail: `${call.agent} - ${call.note}`,
    at: call.startedAt,
    color: "#0f8b98",
    bg: "#e5f7f9",
    icon: <IconPhone size={16} />,
  }));

  const conversationItems: ActivityItem[] = conversations.slice(0, 4).map((conversation) => {
    const meta = channelMeta[conversation.channel];
    return {
      id: conversation.id,
      title: `${meta.label} • ${customerName(conversation.customerId)}`,
      detail: conversation.subject,
      at: conversation.updatedAt,
      color: meta.color,
      bg: meta.bg,
      icon: <IconChat size={16} />,
    };
  });

  const callbotItems: ActivityItem[] = callbotCampaigns.slice(0, 3).map((campaign) => ({
    id: campaign.id,
    title: `Callbot • ${campaign.name}`,
    detail: `${formatNumber(campaign.connected)} cuộc đã kết nối, ${formatNumber(campaign.confirmed)} khách xác nhận`,
    at: campaign.startDate,
    color: "#7c3aed",
    bg: "#f1ebfe",
    icon: <IconRobot size={16} />,
  }));

  return [...callItems, ...conversationItems, ...callbotItems]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 9);
}
