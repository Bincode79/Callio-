import { useMemo, useState } from "react";
import { useApp } from "../lib/store";
import {
  campaignStatusMeta,
  channelMeta,
  formatDateTime,
  formatNumber,
  formatPercent,
  recentDayLabels,
  relativeTime,
} from "../lib/format";
import { PageHeader } from "../components/AppShell";
import {
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
import { IconCheck, IconClock, IconMail, IconPlus, IconSend, IconSparkle, IconTag, IconTarget } from "../components/icons";
import type { Channel, MessageTemplate, MessagingCampaign } from "../lib/types";

const BRANDNAMES = ["CALLIO", "Callio OA", "support@callio.vn", "Callio Page"];

/** Giá trị cho `<input type="datetime-local">`: giờ địa phương dạng `YYYY-MM-DDTHH:mm`. */
function toLocalInputValue(time: number): string {
  const date = new Date(time - new Date().getTimezoneOffset() * 60000);
  return date.toISOString().slice(0, 16);
}

export function MessagingPage() {
  const { state, dispatch } = useApp();
  const [tab, setTab] = useState("chien-dich");
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");
  const [composeOpen, setComposeOpen] = useState(false);
  const [detailId, setDetailId] = useState<string>();
  const [editingTemplate, setEditingTemplate] = useState<string>();
  const [templateDraft, setTemplateDraft] = useState<{ name: string; body: string; category: MessageTemplate["category"] }>({
    name: "",
    body: "",
    category: "cham-soc",
  });
  const [draft, setDraft] = useState({
    name: "",
    channel: "zalo" as Channel,
    brandname: BRANDNAMES[0],
    audience: "Khách hàng đang giao dịch",
    body: "Dạ Callio xin chào anh/chị {ten_khach}. Em là {ten_sale}, chuyên viên tư vấn của anh/chị. Anh/chị cho em xin 5 phút trao đổi về nhu cầu quản lý khách hàng nhé!",
    scheduledAt: toLocalInputValue(Date.now()),
  });

  const filtered = useMemo(
    () =>
      state.messagingCampaigns.filter((campaign) => {
        const matchQuery =
          query.trim() === "" || [campaign.name, campaign.audience, campaign.brandname].join(" ").toLowerCase().includes(query.toLowerCase());
        const matchChannel = channel === "all" || campaign.channel === channel;
        const matchStatus = status === "all" || campaign.status === status;
        return matchQuery && matchChannel && matchStatus;
      }),
    [state.messagingCampaigns, query, channel, status],
  );

  // Chi tiết đọc thẳng từ state theo mã để trạng thái và số liệu luôn khớp sau
  // khi tạm dừng hoặc nhân bản, thay vì giữ một bản sao đã cũ.
  const detail = state.messagingCampaigns.find((campaign) => campaign.id === detailId);

  const totals = state.messagingCampaigns.reduce(
    (acc, campaign) => ({
      sent: acc.sent + campaign.sent,
      delivered: acc.delivered + campaign.delivered,
      opened: acc.opened + campaign.opened,
      replied: acc.replied + campaign.replied,
      failed: acc.failed + campaign.failed,
    }),
    { sent: 0, delivered: 0, opened: 0, replied: 0, failed: 0 },
  );

  const templateUsage = state.templates.reduce((sum, template) => sum + template.usageCount, 0);

  const dailyLabels = recentDayLabels(12);
  const dailyVolume = Array.from({ length: 12 }, (_, index) => ({
    label: dailyLabels[index],
    values: [420 + ((index * 73) % 260), 310 + ((index * 41) % 180), 96 + ((index * 17) % 70)],
  }));

  const channelVolume = (["zalo", "sms", "email", "facebook"] as Channel[]).map((key) => ({
    label: channelMeta[key].label,
    value: state.messagingCampaigns.filter((campaign) => campaign.channel === key).reduce((sum, campaign) => sum + campaign.sent, 0),
    color: channelMeta[key].color,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Nhắn tin"
        title="Chiến dịch nhắn tin đa kênh"
        description="Tự động gửi tin nhắn chăm sóc khách hàng, nhắc lịch hẹn và triển khai chiến dịch marketing qua Zalo OA, SMS Brandname, Email và Facebook."
        actions={
          <>
            <Badge label={`${formatNumber(templateUsage)} lượt dùng mẫu tin`} color="#0f8b98" bg="#e5f7f9" />
            <Button variant="gold" onClick={() => setComposeOpen(true)}>
              <IconPlus size={16} /> Tạo chiến dịch
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tin đã gửi" value={formatNumber(totals.sent)} accent="#0f8b98" icon={<IconSend size={20} />} hint={`${formatNumber(totals.failed)} tin lỗi`} />
        <StatCard label="Tỉ lệ gửi thành công" value={formatPercent(totals.sent ? (totals.delivered / totals.sent) * 100 : 0, 1)} accent="#15803d" icon={<IconCheck size={20} />} hint={`${formatNumber(totals.delivered)} tin đã tới khách`} />
        <StatCard label="Tỉ lệ mở / đọc" value={formatPercent(totals.delivered ? (totals.opened / totals.delivered) * 100 : 0, 1)} accent="#b45309" icon={<IconMail size={20} />} hint={`${formatNumber(totals.opened)} lượt mở`} />
        <StatCard label="Khách phản hồi" value={formatNumber(totals.replied)} accent="#7c3aed" icon={<IconTarget size={20} />} hint={`Tỉ lệ phản hồi ${formatPercent(totals.delivered ? (totals.replied / totals.delivered) * 100 : 0, 1)}`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title="Lưu lượng gửi tin 12 ngày gần nhất" subtitle="Tin gửi đi, tin gửi thành công và phản hồi của khách" />
          <BarChart data={dailyVolume} colors={["#0f8b98", "#7cc9d2", "#f5b942"]} height={190} />
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Metric label="Gửi / ngày" value={formatNumber(Math.round(totals.sent / 12))} />
            <Metric label="Phản hồi / ngày" value={formatNumber(Math.round(totals.replied / 12))} color="#15803d" />
            <Metric label="Tỉ lệ lỗi" value={formatPercent(totals.sent ? (totals.failed / totals.sent) * 100 : 0, 2)} color="#be123c" />
          </div>
        </Card>

        <Card>
          <CardHeader title="Cơ cấu theo kênh" subtitle="Số lượng tin gửi theo từng kênh" />
          <Donut centerLabel="Tin đã gửi" centerValue={formatNumber(totals.sent)} data={channelVolume} size={150} thickness={20} />
          <div className="mt-5 space-y-3 border-t border-[#eef2f5] pt-5">
            {channelVolume.map((entry) => (
              <div key={entry.label} className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2 font-semibold text-[#4a5763]">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  {entry.label}
                </span>
                <span className="font-black text-[#111a22]">{formatNumber(entry.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Chiến dịch nhắn tin"
          subtitle="Theo dõi hiệu quả từng chiến dịch theo kênh và tệp khách hàng"
          action={
            <Tabs
              size="sm"
              active={tab}
              onChange={setTab}
              items={[
                { id: "chien-dich", label: "Chiến dịch", count: state.messagingCampaigns.length },
                { id: "mau-tin", label: "Mẫu tin", count: state.templates.length },
              ]}
            />
          }
        />

        {tab === "chien-dich" ? (
          <>
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <SearchInput value={query} onChange={setQuery} placeholder="Tìm chiến dịch theo tên, tệp khách hàng..." />
              </div>
              <Select
                label="Kênh"
                value={channel}
                onChange={setChannel}
                options={[
                  { value: "all", label: "Tất cả" },
                  ...(["zalo", "sms", "email", "facebook"] as Channel[]).map((key) => ({ value: key, label: channelMeta[key].label })),
                ]}
              />
              <Select
                label="Trạng thái"
                value={status}
                onChange={setStatus}
                options={[{ value: "all", label: "Tất cả" }, ...Object.entries(campaignStatusMeta).map(([key, meta]) => ({ value: key, label: meta.label }))]}
              />
            </div>

            <DataTable
              rowKey={(row) => row.id}
              rows={filtered}
              onRowClick={(row) => setDetailId(row.id)}
              emptyLabel="Không có chiến dịch phù hợp"
              columns={[
                {
                  key: "name",
                  label: "Chiến dịch",
                  render: (row) => (
                    <div>
                      <p className="font-black text-[#111a22]">{row.name}</p>
                      <p className="text-[11.5px] text-[#7b8894]">{row.audience}</p>
                    </div>
                  ),
                },
                {
                  key: "channel",
                  label: "Kênh",
                  render: (row) => <Badge label={channelMeta[row.channel].label} color={channelMeta[row.channel].color} bg={channelMeta[row.channel].bg} />,
                },
                {
                  key: "status",
                  label: "Trạng thái",
                  render: (row) => <Badge label={campaignStatusMeta[row.status].label} color={campaignStatusMeta[row.status].color} bg={campaignStatusMeta[row.status].bg} />,
                },
                { key: "sent", label: "Đã gửi", render: (row) => <span className="font-black">{formatNumber(row.sent)}</span> },
                {
                  key: "delivered",
                  label: "Thành công",
                  render: (row) => (
                    <div className="w-32">
                      <ProgressBar value={row.sent ? (row.delivered / row.sent) * 100 : 0} color="#15803d" showLabel />
                    </div>
                  ),
                },
                {
                  key: "replied",
                  label: "Phản hồi",
                  render: (row) => <span className="font-black text-[#0f8b98]">{formatNumber(row.replied)}</span>,
                },
                { key: "schedule", label: "Lịch gửi", render: (row) => <span className="text-[12.5px] text-[#7b8894]">{formatDateTime(row.scheduledAt)}</span> },
              ]}
            />
          </>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {state.templates.map((template) => (
              <div key={template.id} className="rounded-3xl border border-[#e6ebf0] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-black text-[#111a22]">{template.name}</p>
                    <p className="mt-1 text-[11.5px] text-[#7b8894]">Cập nhật {relativeTime(template.updatedAt)}</p>
                  </div>
                  <Badge label={channelMeta[template.channel].label} color={channelMeta[template.channel].color} bg={channelMeta[template.channel].bg} />
                </div>
                <p className="mt-3 rounded-2xl bg-[#f8fafc] px-3.5 py-3 text-[13px] leading-6 text-[#33414d]">{template.body}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-[#8492a0]">
                    <IconTag size={13} /> {categoryLabel(template.category)}
                  </span>
                  <span className="text-[11.5px] font-black text-[#0f8b98]">{formatNumber(template.usageCount)} lượt dùng</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDraft((current) => ({ ...current, body: template.body, channel: template.channel }));
                      setComposeOpen(true);
                    }}
                  >
                    Dùng mẫu này
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingTemplate(template.id);
                      setTemplateDraft({ name: template.name, body: template.body, category: template.category });
                    }}
                  >
                    Chỉnh sửa
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Hiệu quả theo khung giờ gửi" subtitle="Khung giờ nào khách mở và phản hồi nhiều nhất" />
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <BarChart
            data={Array.from({ length: 10 }, (_, index) => {
              const hour = 8 + index;
              return { label: `${String(hour).padStart(2, "0")}h`, values: [12 + ((index * 5) % 20), 6 + ((index * 3) % 12)] };
            })}
            colors={["#0f8b98", "#f5b942"]}
            height={170}
          />
          <div className="space-y-3.5">
            {[
              { label: "09:00 - 11:00", value: 34, hint: "Khung giờ vàng cho chăm sóc khách hàng" },
              { label: "12:00 - 13:30", value: 21, hint: "Khách xem tin trong giờ nghỉ trưa" },
              { label: "19:00 - 21:00", value: 28, hint: "Tỉ lệ phản hồi cao với chiến dịch marketing" },
              { label: "Ngoài khung giờ", value: 17, hint: "Nên hạn chế gửi để tránh làm phiền" },
            ].map((slot) => (
              <div key={slot.label}>
                <div className="mb-1.5 flex items-center justify-between text-[13px]">
                  <span className="font-bold text-[#33414d]">{slot.label}</span>
                  <span className="font-black text-[#111a22]">{slot.value}%</span>
                </div>
                <ProgressBar value={slot.value} max={40} color="#0f8b98" />
                <p className="mt-1 text-[11.5px] text-[#8492a0]">{slot.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Modal
        open={composeOpen}
        wide
        title="Tạo chiến dịch nhắn tin"
        subtitle="Soạn nội dung, chọn tệp khách hàng và lên lịch gửi tự động"
        onClose={() => setComposeOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setComposeOpen(false)}>
              Huỷ
            </Button>
            <Button
              variant="outline"
              disabled={draft.name.trim() === ""}
              onClick={() => {
                setComposeOpen(false);
                dispatch({ type: "createMessagingCampaign", draft: { ...draft, name: draft.name.trim(), start: false } });
              }}
            >
              Lưu nháp
            </Button>
            <Button
              disabled={draft.name.trim() === ""}
              onClick={() => {
                setComposeOpen(false);
                dispatch({ type: "createMessagingCampaign", draft: { ...draft, name: draft.name.trim(), start: true } });
              }}
            >
              <IconSend size={15} /> Lên lịch gửi
            </Button>
          </>
        }
      >
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-bold text-[#4a5763]">Tên chiến dịch</span>
              <input
                className="w-full rounded-xl border border-[#dfe6ec] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#0f8b98]"
                placeholder="Chăm sóc khách hàng tháng 10"
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-bold text-[#4a5763]">Kênh gửi</span>
                <select
                  className="w-full rounded-xl border border-[#dfe6ec] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#0f8b98]"
                  value={draft.channel}
                  onChange={(event) => setDraft((current) => ({ ...current, channel: event.target.value as Channel }))}
                >
                  {(["zalo", "sms", "email", "facebook"] as Channel[]).map((key) => (
                    <option key={key} value={key}>
                      {channelMeta[key].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-bold text-[#4a5763]">Brandname / Đầu gửi</span>
                <select
                  className="w-full rounded-xl border border-[#dfe6ec] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#0f8b98]"
                  value={draft.brandname}
                  onChange={(event) => setDraft((current) => ({ ...current, brandname: event.target.value }))}
                >
                  {BRANDNAMES.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-bold text-[#4a5763]">Tệp khách hàng</span>
                <select
                  className="w-full rounded-xl border border-[#dfe6ec] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#0f8b98]"
                  value={draft.audience}
                  onChange={(event) => setDraft((current) => ({ ...current, audience: event.target.value }))}
                >
                  <option>Khách hàng đang giao dịch</option>
                  <option>Lead tiềm năng chưa chốt</option>
                  <option>Khách đến hạn chăm sóc</option>
                  <option>Danh sách từ Ulead</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-bold text-[#4a5763]">Thời điểm gửi</span>
                <input
                  type="datetime-local"
                  className="w-full rounded-xl border border-[#dfe6ec] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#0f8b98]"
                  value={draft.scheduledAt}
                  onChange={(event) => setDraft((current) => ({ ...current, scheduledAt: event.target.value }))}
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-bold text-[#4a5763]">Nội dung tin nhắn</span>
              <textarea
                className="h-28 w-full rounded-xl border border-[#dfe6ec] px-3.5 py-2.5 text-[13.5px] leading-6 outline-none focus:border-[#0f8b98]"
                value={draft.body}
                onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
              />
              <span className="mt-1.5 block text-[11.5px] text-[#8492a0]">
                {draft.body.length} ký tự • Biến động: {"{ten_khach}"}, {"{ten_sale}"}, {"{ma_don}"}
              </span>
            </label>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-[#e6ebf0] p-4">
              <p className="text-[12.5px] font-black text-[#111a22]">Xem trước trên điện thoại</p>
              <div className="mt-3 rounded-[26px] border-[6px] border-[#101f27] bg-[#f4f7f9] p-3">
                <div className="rounded-2xl bg-[#0b7fdb] px-3 py-2.5 text-[12px] leading-5 text-white">{draft.body}</div>
                <p className="mt-2 text-center text-[10.5px] text-[#8492a0]">{draft.brandname} • vừa xong</p>
              </div>
            </div>
            <div className="rounded-2xl bg-[#f8fafc] p-4">
              <p className="text-[12.5px] font-black text-[#111a22]">Ước tính chi phí & hiệu quả</p>
              <div className="mt-3 space-y-3">
                <KeyValue label="Số người nhận" value="12.480 khách hàng" />
                <KeyValue label="Chi phí dự kiến" value="4.680.000đ" />
                <KeyValue label="Tỉ lệ phản hồi dự kiến" value="14% - 18%" />
              </div>
            </div>
            <div className="rounded-2xl bg-[#101f27] p-4 text-white">
              <p className="flex items-center gap-2 text-[12.5px] font-black">
                <IconSparkle size={15} /> Gợi ý từ AI
              </p>
              <p className="mt-2.5 text-[12px] leading-5 text-white/75">
                Nên gửi vào 09:30 thứ Ba để tăng 22% tỉ lệ phản hồi. Chèn tên khách hàng và ưu đãi cụ thể sẽ giúp tăng tỉ lệ mở.
              </p>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(detail)}
        title={detail?.name ?? ""}
        subtitle={detail ? `${channelMeta[detail.channel].label} • ${detail.audience}` : ""}
        onClose={() => setDetailId(undefined)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDetailId(undefined)}>
              Đóng
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!detail) return;
                dispatch({ type: "toggleMessagingCampaign", id: detail.id });
              }}
            >
              <IconClock size={15} /> {detail?.status === "dang-chay" ? "Tạm dừng" : "Kích hoạt"}
            </Button>
            <Button
              onClick={() => {
                if (!detail) return;
                dispatch({ type: "duplicateMessagingCampaign", id: detail.id });
                setDetailId(undefined);
              }}
            >
              Nhân bản chiến dịch
            </Button>
          </>
        }
      >
        {detail ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Đã gửi" value={formatNumber(detail.sent)} />
              <Metric label="Thành công" value={formatNumber(detail.delivered)} color="#15803d" />
              <Metric label="Lỗi" value={formatNumber(detail.failed)} color="#be123c" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <KeyValue label="Kênh" value={channelMeta[detail.channel].label} />
              <KeyValue label="Brandname" value={detail.brandname} />
              <KeyValue label="Tệp khách hàng" value={detail.audience} />
              <KeyValue label="Lịch gửi" value={formatDateTime(detail.scheduledAt)} />
              <KeyValue label="Lượt mở" value={`${formatNumber(detail.opened)} (${formatPercent(detail.delivered ? (detail.opened / detail.delivered) * 100 : 0, 1)})`} />
              <KeyValue label="Phản hồi" value={`${formatNumber(detail.replied)} (${formatPercent(detail.delivered ? (detail.replied / detail.delivered) * 100 : 0, 1)})`} />
            </div>
            <div className="rounded-2xl bg-[#f8fafc] p-4">
              <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-[#8492a0]">Phễu hiệu quả chiến dịch</p>
              <div className="mt-3 space-y-3">
                {[
                  { label: "Đã gửi", value: detail.sent },
                  { label: "Gửi thành công", value: detail.delivered },
                  { label: "Khách mở / đọc", value: detail.opened },
                  { label: "Khách phản hồi", value: detail.replied },
                ].map((step) => (
                  <div key={step.label}>
                    <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                      <span className="font-bold text-[#33414d]">{step.label}</span>
                      <span className="font-black text-[#111a22]">{formatNumber(step.value)}</span>
                    </div>
                    <ProgressBar value={step.value} max={Math.max(1, detail.sent)} color="#0f8b98" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(editingTemplate)}
        title="Chỉnh sửa mẫu tin"
        subtitle="Nội dung mới áp dụng cho các lần dùng mẫu tiếp theo"
        onClose={() => setEditingTemplate(undefined)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingTemplate(undefined)}>
              Huỷ
            </Button>
            <Button
              disabled={templateDraft.name.trim() === "" || templateDraft.body.trim() === ""}
              onClick={() => {
                if (!editingTemplate) return;
                dispatch({ type: "updateTemplate", id: editingTemplate, patch: templateDraft });
                setEditingTemplate(undefined);
              }}
            >
              Lưu mẫu tin
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-bold text-[#4a5763]">Tên mẫu tin</span>
            <input
              className="w-full rounded-xl border border-[#dfe6ec] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#0f8b98]"
              value={templateDraft.name}
              onChange={(event) => setTemplateDraft((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-bold text-[#4a5763]">Nhóm mẫu tin</span>
            <select
              className="w-full rounded-xl border border-[#dfe6ec] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#0f8b98]"
              value={templateDraft.category}
              onChange={(event) => setTemplateDraft((current) => ({ ...current, category: event.target.value as MessageTemplate["category"] }))}
            >
              <option value="cham-soc">Chăm sóc khách hàng</option>
              <option value="marketing">Marketing</option>
              <option value="giao-dich">Giao dịch</option>
              <option value="nhac-hen">Nhắc hẹn</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-bold text-[#4a5763]">Nội dung</span>
            <textarea
              className="h-32 w-full rounded-xl border border-[#dfe6ec] px-3.5 py-2.5 text-[13.5px] leading-6 outline-none focus:border-[#0f8b98]"
              value={templateDraft.body}
              onChange={(event) => setTemplateDraft((current) => ({ ...current, body: event.target.value }))}
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}

function categoryLabel(category: string): string {
  switch (category) {
    case "cham-soc":
      return "Chăm sóc khách hàng";
    case "marketing":
      return "Marketing";
    case "giao-dich":
      return "Giao dịch";
    default:
      return "Nhắc hẹn";
  }
}
