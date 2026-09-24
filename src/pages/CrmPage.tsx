import { useMemo, useState } from "react";
import { useApp } from "../lib/store";
import { useRouter } from "../lib/router";
import {
  channelMeta,
  customerStatusMeta,
  formatDateTime,
  formatNumber,
  formatVnd,
  leadSourceMeta,
  maskPhone,
  pipelineMeta,
  pipelineOrder,
  relativeTime,
} from "../lib/format";
import { PageHeader } from "../components/AppShell";
import {
  Avatar,
  Badge,
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
  Select,
  StatCard,
  Tabs,
} from "../components/ui";
import {
  IconBuilding,
  IconChat,
  IconDownload,
  IconMail,
  IconPhone,
  IconPlus,
  IconSend,
  IconSparkle,
  IconTag,
  IconTarget,
  IconUsers,
} from "../components/icons";
import type { Customer } from "../lib/types";

export function CrmPage() {
  const { state, dispatch } = useApp();
  const { param, navigate } = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [owner, setOwner] = useState("all");
  const [source, setSource] = useState("all");
  const [view, setView] = useState("danh-sach");
  const [detailId, setDetailId] = useState<string | undefined>(param);
  const [createOpen, setCreateOpen] = useState(false);

  const owners = useMemo(() => Array.from(new Set(state.customers.map((customer) => customer.owner))), [state.customers]);

  const filtered = useMemo(
    () =>
      state.customers.filter((customer) => {
        const matchQuery =
          query.trim() === "" ||
          [customer.name, customer.company, customer.phone, customer.email, customer.code]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase());
        const matchStatus = status === "all" || customer.status === status;
        const matchOwner = owner === "all" || customer.owner === owner;
        const matchSource = source === "all" || customer.source === source;
        return matchQuery && matchStatus && matchOwner && matchSource;
      }),
    [state.customers, query, status, owner, source],
  );

  const detail = state.customers.find((customer) => customer.id === (detailId ?? param));

  const statusCounts = useMemo(
    () =>
      (["lead", "potential", "customer", "loyal", "churn"] as const).map((key) => ({
        key,
        label: customerStatusMeta[key].label,
        color: customerStatusMeta[key].color,
        count: state.customers.filter((customer) => customer.status === key).length,
      })),
    [state.customers],
  );

  const totalValue = filtered.reduce((sum, customer) => sum + customer.totalValue, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="ACRM"
        title="Quản lý thông tin khách hàng"
        description="Lưu trữ toàn bộ hồ sơ khách hàng, lịch sử tương tác đa kênh và hành trình mua hàng trên một hồ sơ duy nhất (Customer 360)."
        actions={
          <>
            <Button variant="outline" onClick={() => dispatch({ type: "toast", message: "Đã xuất tệp khách hàng ra Excel", tone: "success" })}>
              <IconDownload size={16} /> Xuất dữ liệu
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <IconPlus size={16} /> Thêm khách hàng
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tổng khách hàng" value={formatNumber(state.customers.length)} accent="#0f8b98" icon={<IconUsers size={20} />} hint="Dữ liệu hợp nhất từ mọi kênh" />
        <StatCard label="Kết quả lọc" value={formatNumber(filtered.length)} accent="#2563eb" icon={<IconTarget size={20} />} hint={`Giá trị: ${formatVnd(totalValue)}`} />
        <StatCard label="Khách trung thành" value={formatNumber(statusCounts.find((item) => item.key === "loyal")?.count ?? 0)} accent="#15803d" icon={<IconSparkle size={20} />} hint="Tỉ lệ giữ chân 87%" />
        <StatCard label="Nguy cơ rời bỏ" value={formatNumber(statusCounts.find((item) => item.key === "churn")?.count ?? 0)} accent="#be123c" icon={<IconChat size={20} />} hint="Cần chiến dịch chăm sóc lại" />
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <SearchInput value={query} onChange={setQuery} placeholder="Tìm theo tên, công ty, số điện thoại hoặc mã khách hàng..." />
          </div>
          <Select
            label="Trạng thái"
            value={status}
            onChange={setStatus}
            options={[{ value: "all", label: "Tất cả" }, ...statusCounts.map((item) => ({ value: item.key, label: item.label }))]}
          />
          <Select label="Phụ trách" value={owner} onChange={setOwner} options={[{ value: "all", label: "Tất cả" }, ...owners.map((name) => ({ value: name, label: name }))]} />
          <Select
            label="Nguồn"
            value={source}
            onChange={setSource}
            options={[{ value: "all", label: "Tất cả" }, ...Object.entries(leadSourceMeta).map(([key, meta]) => ({ value: key, label: meta.label }))]}
          />
          <Tabs
            size="sm"
            active={view}
            onChange={setView}
            items={[
              { id: "danh-sach", label: "Dạng bảng" },
              { id: "phan-bo", label: "Phân bổ" },
            ]}
          />
        </div>

        <div className="mt-5">
          {view === "danh-sach" ? (
            <DataTable
              rowKey={(row) => row.id}
              rows={filtered}
              onRowClick={(row) => setDetailId(row.id)}
              emptyLabel="Không tìm thấy khách hàng phù hợp bộ lọc"
              columns={[
                {
                  key: "name",
                  label: "Khách hàng",
                  render: (row) => (
                    <div className="flex items-center gap-3">
                      <Avatar name={row.name} size={38} />
                      <div>
                        <p className="font-black text-[#111a22]">{row.name}</p>
                        <p className="text-[12px] text-[#7b8894]">{row.company}</p>
                      </div>
                    </div>
                  ),
                },
                {
                  key: "contact",
                  label: "Liên hệ",
                  render: (row) => (
                    <div>
                      <p className="font-semibold text-[#25313d]">{maskPhone(row.phone)}</p>
                      <p className="text-[12px] text-[#7b8894]">{row.email}</p>
                    </div>
                  ),
                },
                {
                  key: "status",
                  label: "Trạng thái",
                  render: (row) => (
                    <Badge label={customerStatusMeta[row.status].label} color={customerStatusMeta[row.status].color} bg={customerStatusMeta[row.status].bg} />
                  ),
                },
                {
                  key: "source",
                  label: "Nguồn",
                  render: (row) => (
                    <span className="text-[13px] font-bold" style={{ color: leadSourceMeta[row.source].color }}>
                      {leadSourceMeta[row.source].label}
                    </span>
                  ),
                },
                {
                  key: "value",
                  label: "Giá trị",
                  render: (row) => <span className="font-black text-[#111a22]">{formatVnd(row.totalValue)}</span>,
                },
                {
                  key: "score",
                  label: "Điểm tiềm năng",
                  render: (row) => (
                    <div className="w-28">
                      <ProgressBar value={row.score} color={row.score >= 70 ? "#15803d" : row.score >= 45 ? "#b45309" : "#94a3b8"} showLabel />
                    </div>
                  ),
                },
                {
                  key: "last",
                  label: "Tương tác cuối",
                  render: (row) => <span className="text-[12.5px] text-[#7b8894]">{relativeTime(row.lastContactAt)}</span>,
                },
              ]}
            />
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
              <Donut
                centerLabel="Khách hàng"
                centerValue={formatNumber(state.customers.length)}
                data={statusCounts.map((item) => ({ label: item.label, value: item.count, color: item.color }))}
              />
              <div className="space-y-3.5">
                {statusCounts.map((item) => (
                  <div key={item.key}>
                    <div className="mb-1.5 flex items-center justify-between text-[13px]">
                      <span className="font-bold text-[#33414d]">{item.label}</span>
                      <span className="font-black text-[#111a22]">
                        {item.count} <span className="text-[11.5px] font-bold text-[#8492a0]">khách</span>
                      </span>
                    </div>
                    <ProgressBar value={item.count} max={state.customers.length} color={item.color} />
                  </div>
                ))}
                <div className="rounded-2xl bg-[#f8fafc] p-4">
                  <p className="text-[13px] font-black text-[#111a22]">Giá trị theo nguồn dữ liệu</p>
                  <ul className="mt-3 space-y-2.5">
                    {Object.entries(leadSourceMeta)
                      .map(([key, meta]) => ({
                        meta,
                        value: state.customers.filter((customer) => customer.source === key).reduce((sum, customer) => sum + customer.totalValue, 0),
                      }))
                      .sort((a, b) => b.value - a.value)
                      .slice(0, 5)
                      .map((entry) => (
                        <li key={entry.meta.label} className="flex items-center justify-between text-[13px]">
                          <span className="font-semibold text-[#4a5763]">{entry.meta.label}</span>
                          <span className="font-black text-[#111a22]">{formatVnd(entry.value)}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Hành trình khách hàng theo giai đoạn" subtitle="Số lượng hồ sơ và giá trị đang nằm ở từng bước pipeline" />
        <div className="grid gap-3 lg:grid-cols-6">
          {pipelineOrder.map((stage) => {
            const stageCustomers = state.customers.filter((customer) => customer.deals.some((deal) => deal.stage === stage));
            const value = stageCustomers.reduce((sum, customer) => sum + customer.totalValue, 0);
            return (
              <div key={stage} className="rounded-2xl border border-[#edf1f5] p-4">
                <span className="inline-block h-2 w-8 rounded-full" style={{ backgroundColor: pipelineMeta[stage].color }} />
                <p className="mt-3 text-[12.5px] font-black text-[#111a22]">{pipelineMeta[stage].label}</p>
                <p className="mt-2 text-[22px] font-black leading-none text-[#0f1a22]">{stageCustomers.length}</p>
                <p className="mt-1 text-[11.5px] font-semibold text-[#8492a0]">{formatVnd(value)}</p>
              </div>
            );
          })}
        </div>
      </Card>

      <CustomerDrawer
        customer={detail}
        onClose={() => {
          setDetailId(undefined);
          navigate("/crm");
        }}
        onAction={(message) => dispatch({ type: "toast", message, tone: "success" })}
      />

      <Modal
        open={createOpen}
        title="Thêm khách hàng mới"
        subtitle="Hồ sơ sẽ tự động gắn vào hành trình và đồng bộ sang mọi kênh"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Huỷ
            </Button>
            <Button
              onClick={() => {
                setCreateOpen(false);
                dispatch({ type: "toast", message: "Đã tạo hồ sơ khách hàng mới và gửi SMS chào mừng", tone: "success" });
              }}
            >
              Lưu hồ sơ
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { label: "Họ và tên", placeholder: "Nguyễn Văn A" },
            { label: "Công ty", placeholder: "Công ty TNHH ABC" },
            { label: "Số điện thoại", placeholder: "09xx xxx xxx" },
            { label: "Email", placeholder: "email@congty.vn" },
            { label: "Khu vực", placeholder: "Hà Nội" },
            { label: "Nguồn dữ liệu", placeholder: "Facebook Ads" },
          ].map((field) => (
            <label key={field.label} className="block">
              <span className="mb-1.5 block text-[12.5px] font-bold text-[#4a5763]">{field.label}</span>
              <input
                className="w-full rounded-xl border border-[#dfe6ec] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#0f8b98]"
                placeholder={field.placeholder}
              />
            </label>
          ))}
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-[12.5px] font-bold text-[#4a5763]">Ghi chú nhu cầu</span>
            <textarea
              className="h-24 w-full rounded-xl border border-[#dfe6ec] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#0f8b98]"
              placeholder="Mô tả nhu cầu, quy mô đội sales, ngân sách dự kiến..."
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}

function CustomerDrawer({
  customer,
  onClose,
  onAction,
}: {
  customer?: Customer;
  onClose: () => void;
  onAction: (message: string) => void;
}) {
  const [tab, setTab] = useState("hanh-trinh");
  if (!customer) return null;
  const statusMeta = customerStatusMeta[customer.status];

  return (
    <Modal
      open
      wide
      title={customer.name}
      subtitle={`${customer.company} • Mã ${customer.code} • Phụ trách: ${customer.owner}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Đóng
          </Button>
          <Button variant="outline" onClick={() => onAction(`Đã tạo cuộc gọi ra cho ${customer.name} qua tổng đài`)}>
            <IconPhone size={15} /> Gọi ngay
          </Button>
          <Button onClick={() => onAction(`Đã tạo việc chăm sóc cho ${customer.name} và giao về ${customer.owner}`)}>
            <IconSparkle size={15} /> Tạo việc chăm sóc
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Giá trị pipeline" value={formatVnd(customer.totalValue)} color="#0f8b98" />
        <Metric label="Điểm tiềm năng" value={`${customer.score}/100`} color="#b45309" />
        <Metric label="Số giao dịch" value={String(customer.dealCount)} />
        <Metric label="Tương tác cuối" value={relativeTime(customer.lastContactAt)} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <KeyValue label="Trạng thái" value={<Badge label={statusMeta.label} color={statusMeta.color} bg={statusMeta.bg} />} />
        <KeyValue label="Nguồn" value={leadSourceMeta[customer.source].label} />
        <KeyValue label="Khu vực" value={customer.address} />
        <KeyValue label="Điện thoại" value={maskPhone(customer.phone)} />
        <KeyValue label="Email" value={customer.email} />
        <KeyValue label="Ngày tạo hồ sơ" value={formatDateTime(customer.createdAt)} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {customer.tags.map((tag) => (
          <Badge key={tag} label={tag} color="#0f8b98" bg="#e5f7f9" />
        ))}
      </div>

      <div className="mt-5 rounded-2xl bg-[#f8fafc] p-4">
        <p className="flex items-center gap-2 text-[13px] font-black text-[#111a22]">
          <IconTag size={15} /> Ghi chú nội bộ
        </p>
        <p className="mt-2 text-[13px] leading-6 text-[#4a5763]">{customer.note}</p>
      </div>

      <div className="mt-5">
        <Tabs
          active={tab}
          onChange={setTab}
          items={[
            { id: "hanh-trinh", label: "Hành trình tương tác", count: customer.timeline.length },
            { id: "giao-dich", label: "Giao dịch", count: customer.deals.length },
            { id: "crm-note", label: "Thông tin mở rộng" },
          ]}
        />

        <div className="mt-4">
          {tab === "hanh-trinh" ? (
            <ol className="relative space-y-4 border-l border-[#e6ebf0] pl-6">
              {customer.timeline.map((event) => {
                const meta = channelMeta[event.channel];
                return (
                  <li key={event.id} className="relative">
                    <span
                      className="absolute -left-[31px] grid h-6 w-6 place-items-center rounded-full border-2 border-white text-[10px] font-black"
                      style={{ backgroundColor: meta.bg, color: meta.color }}
                    >
                      ●
                    </span>
                    <div className="rounded-2xl border border-[#edf1f5] p-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge label={meta.label} color={meta.color} bg={meta.bg} />
                        <p className="text-[13.5px] font-black text-[#111a22]">{event.title}</p>
                        {event.direction ? (
                          <Badge
                            label={event.direction === "in" ? "Khách liên hệ" : "Ra ngoài"}
                            color={event.direction === "in" ? "#2563eb" : "#15803d"}
                            bg={event.direction === "in" ? "#e8eeff" : "#e7f7ec"}
                          />
                        ) : null}
                      </div>
                      <p className="mt-2 text-[13px] leading-6 text-[#4a5763]">{event.detail}</p>
                      <p className="mt-2 text-[11.5px] font-semibold text-[#98a4ae]">
                        {formatDateTime(event.at)} • {event.actor}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : null}

          {tab === "giao-dich" ? (
            <DataTable
              rowKey={(row) => row.id}
              rows={customer.deals}
              columns={[
                { key: "name", label: "Giao dịch", render: (row) => <span className="font-bold text-[#111a22]">{row.name}</span> },
                { key: "value", label: "Giá trị", render: (row) => <span className="font-black">{formatVnd(row.value)}</span> },
                {
                  key: "stage",
                  label: "Giai đoạn",
                  render: (row) => <Badge label={pipelineMeta[row.stage].label} color="#ffffff" bg={pipelineMeta[row.stage].color} />,
                },
                { key: "owner", label: "Phụ trách", render: (row) => row.owner },
                { key: "closed", label: "Ngày chốt", render: (row) => (row.closedAt ? formatDateTime(row.closedAt) : "—") },
              ]}
            />
          ) : null}

          {tab === "crm-note" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <KeyValue label="Phân loại khách hàng" value={statusMeta.label} />
              <KeyValue label="Nhóm ngành" value="Dịch vụ - Bán lẻ" />
              <KeyValue label="Quy mô đội sales" value="12 - 35 nhân viên" />
              <KeyValue label="Kênh ưa thích" value="Zalo OA, Cuộc gọi" />
              <KeyValue label="Giờ liên hệ tốt nhất" value="09:00 - 11:30" />
              <KeyValue label="Người quyết định" value="Giám đốc kinh doanh" />
            </div>
          ) : null}
        </div>
      </div>

      {customer.timeline.length === 0 ? <EmptyState title="Chưa có tương tác nào" hint="Hồ sơ này chưa ghi nhận hoạt động." /> : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Button variant="outline" onClick={() => onAction(`Đã gửi email giới thiệu tới ${customer.email}`)}>
          <IconMail size={15} /> Gửi email
        </Button>
        <Button variant="outline" onClick={() => onAction(`Đã gửi tin nhắn Zalo OA cho ${customer.name}`)}>
          <IconSend size={15} /> Gửi Zalo OA
        </Button>
        <Button variant="outline" onClick={() => onAction(`Đã đồng bộ hồ sơ ${customer.code} sang hệ thống ERP`)}>
          <IconBuilding size={15} /> Đồng bộ ERP
        </Button>
      </div>
    </Modal>
  );
}
