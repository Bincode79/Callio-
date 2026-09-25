import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../lib/store";
import { useRouter } from "../lib/router";
import {
  channelMeta,
  conversationStatusMeta,
  formatDateTime,
  formatTime,
  maskPhone,
  relativeTime,
} from "../lib/format";
import { PageHeader } from "../components/AppShell";
import { Avatar, Badge, Button, Card, CardHeader, Metric, SearchInput, Select, StatCard, Tabs } from "../components/ui";
import {
  IconChat,
  IconCheck,
  IconClock,
  IconGlobe,
  IconMail,
  IconPhone,
  IconSend,
  IconSparkle,
  IconTag,
  IconUsers,
} from "../components/icons";
import type { Channel } from "../lib/types";

const QUICK_REPLIES = [
  "Dạ em đã nhận thông tin, em kiểm tra và phản hồi anh/chị trong 15 phút ạ.",
  "Anh/chị cho em xin số điện thoại để chuyên viên gọi tư vấn chi tiết nhé.",
  "Dạ bên em đang có ưu đãi 30% cho gói Growth đến hết 30/09 ạ.",
  "Em gửi anh/chị bảng giá và video demo qua Zalo, anh/chị xem giúp em nhé.",
];

export function OmnichannelPage() {
  const { state, dispatch } = useApp();
  const { param, navigate } = useRouter();
  const [channel, setChannel] = useState<"all" | Channel>("all");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [assignee, setAssignee] = useState("all");
  const [reply, setReply] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>(param);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const customersById = useMemo(
    () => Object.fromEntries(state.customers.map((customer) => [customer.id, customer])),
    [state.customers],
  );

  const filtered = useMemo(
    () =>
      state.conversations.filter((conversation) => {
        const customer = customersById[conversation.customerId];
        const matchChannel = channel === "all" || conversation.channel === channel;
        const matchStatus = status === "all" || conversation.status === status;
        const matchAssignee = assignee === "all" || conversation.assignee === assignee;
        const matchQuery =
          query.trim() === "" ||
          [customer?.name, customer?.company, conversation.subject, conversation.assignee]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase());
        return matchChannel && matchStatus && matchAssignee && matchQuery;
      }),
    [state.conversations, channel, status, assignee, query, customersById],
  );

  const selected = state.conversations.find((conversation) => conversation.id === (selectedId ?? param)) ?? filtered[0];
  const selectedCustomer = selected ? customersById[selected.customerId] : undefined;

  const messageCount = selected?.messages.length ?? 0;
  const selectedConversationId = selected?.id;
  useEffect(() => {
    if (selectedConversationId && messageCount >= 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedConversationId, messageCount]);

  const channelCounts = useMemo(() => {
    const entries = (["call", "zalo", "facebook", "email", "sms", "website"] as Channel[]).map((key) => ({
      key,
      count: state.conversations.filter((conversation) => conversation.channel === key).length,
    }));
    return entries;
  }, [state.conversations]);

  const slaBreached = state.conversations.filter(
    (conversation) => conversation.status !== "da-xu-ly" && (Date.now() - new Date(conversation.updatedAt).getTime()) / 60000 > conversation.slaMinutes,
  ).length;

  const agents = useMemo(() => Array.from(new Set(state.conversations.map((conversation) => conversation.assignee))), [state.conversations]);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Omnichannel"
        title="Hộp thư đa kênh tập trung"
        description="Kết nối Zalo OA, Facebook, Email, SMS, chat website và cuộc gọi về một giao diện duy nhất để đội ngũ không bỏ sót bất kỳ khách hàng nào."
        actions={
          <>
            <Badge label={`${slaBreached} hội thoại quá SLA`} color="#be123c" bg="#fdeaee" />
            <Button variant="gold" onClick={() => dispatch({ type: "toast", message: "Đã tạo hội thoại mới và gửi lời chào tự động", tone: "success" })}>
              <IconSparkle size={16} /> Tạo hội thoại
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Hội thoại đang mở" value={String(state.conversations.filter((item) => item.status !== "da-xu-ly").length)} accent="#0f8b98" icon={<IconChat size={20} />} hint={`Tổng ${state.conversations.length} hội thoại`} />
        <StatCard label="Tin nhắn chưa đọc" value={String(state.conversations.reduce((sum, item) => sum + item.unread, 0))} accent="#be123c" icon={<IconMail size={20} />} hint="Cần phản hồi trong 15 phút" />
        <StatCard label="Quá SLA" value={String(slaBreached)} accent="#b45309" icon={<IconClock size={20} />} hint="SLA trung bình 30 phút" />
        <StatCard label="Kênh đang kết nối" value="6" accent="#7c3aed" icon={<IconGlobe size={20} />} hint="Zalo, Facebook, Email, SMS, Web, Call" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[300px_1fr_320px]">
        <Card padded={false} className="overflow-hidden">
          <div className="border-b border-[#eef2f5] p-4">
            <SearchInput value={query} onChange={setQuery} placeholder="Tìm hội thoại..." />
            <div className="mt-3 space-y-2">
              <Select
                label="Trạng thái"
                value={status}
                onChange={setStatus}
                options={[
                  { value: "all", label: "Tất cả trạng thái" },
                  ...Object.entries(conversationStatusMeta).map(([key, meta]) => ({ value: key, label: meta.label })),
                ]}
              />
              <Select
                label="Phụ trách"
                value={assignee}
                onChange={setAssignee}
                options={[{ value: "all", label: "Tất cả nhân viên" }, ...agents.map((name) => ({ value: name, label: name }))]}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 border-b border-[#eef2f5] p-3">
            <button
              type="button"
              onClick={() => setChannel("all")}
              className={`rounded-lg px-2.5 py-1.5 text-[12px] font-bold transition ${channel === "all" ? "bg-[#0f8b98] text-white" : "bg-[#f1f5f8] text-[#5c6a76]"}`}
            >
              Tất cả ({state.conversations.length})
            </button>
            {channelCounts.map((entry) => {
              const meta = channelMeta[entry.key];
              const isActive = channel === entry.key;
              return (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => setChannel(entry.key)}
                  className="rounded-lg px-2.5 py-1.5 text-[12px] font-bold transition"
                  style={isActive ? { backgroundColor: meta.color, color: "#ffffff" } : { backgroundColor: meta.bg, color: meta.color }}
                >
                  {meta.short} ({entry.count})
                </button>
              );
            })}
          </div>

          <ul className="max-h-[560px] divide-y divide-[#f2f6f8] overflow-y-auto">
            {filtered.map((conversation) => {
              const customer = customersById[conversation.customerId];
              const meta = channelMeta[conversation.channel];
              const isActive = selected?.id === conversation.id;
              const overdue =
                conversation.status !== "da-xu-ly" &&
                (Date.now() - new Date(conversation.updatedAt).getTime()) / 60000 > conversation.slaMinutes;
              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(conversation.id)}
                    className={`w-full px-4 py-3.5 text-left transition ${isActive ? "bg-[#f0fbfc]" : "hover:bg-[#f9fcfd]"}`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar name={customer?.name ?? "Khách"} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[13.5px] font-black text-[#111a22]">{customer?.name}</p>
                          <span className="whitespace-nowrap text-[11px] font-semibold text-[#98a4ae]">
                            {relativeTime(conversation.updatedAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[12.5px] font-semibold text-[#5c6a76]">{conversation.subject}</p>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <Badge label={meta.label} color={meta.color} bg={meta.bg} />
                          {conversation.unread > 0 ? (
                            <span className="rounded-full bg-[#be123c] px-2 py-0.5 text-[10.5px] font-black text-white">{conversation.unread}</span>
                          ) : null}
                          {overdue ? <Badge label="Quá SLA" color="#be123c" bg="#fdeaee" /> : null}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 ? (
              <li className="px-4 py-10 text-center text-[13px] font-semibold text-[#98a4ae]">Không có hội thoại phù hợp</li>
            ) : null}
          </ul>
        </Card>

        <Card padded={false} className="flex min-h-[620px] flex-col overflow-hidden">
          {selected && selectedCustomer ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef2f5] px-5 py-4">
                <div className="flex items-center gap-3">
                  <Avatar name={selectedCustomer.name} size={42} />
                  <div>
                    <p className="text-[15px] font-black text-[#111a22]">{selectedCustomer.name}</p>
                    <p className="text-[12.5px] text-[#7b8894]">
                      {selectedCustomer.company} • {maskPhone(selectedCustomer.phone)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge label={channelMeta[selected.channel].label} color={channelMeta[selected.channel].color} bg={channelMeta[selected.channel].bg} />
                  <Badge
                    label={conversationStatusMeta[selected.status].label}
                    color={conversationStatusMeta[selected.status].color}
                    bg={conversationStatusMeta[selected.status].bg}
                  />
                  <Button size="sm" variant="outline" onClick={() => dispatch({ type: "toast", message: `Đang gọi ${selectedCustomer.name} qua tổng đài Callio`, tone: "info" })}>
                    <IconPhone size={14} /> Gọi
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => navigate("/crm")}>
                    Hồ sơ 360
                  </Button>
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto bg-[#fbfdfe] px-5 py-5">
                {selected.messages.map((message) => {
                  const outbound = message.direction === "out";
                  return (
                    <div key={message.id} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[78%] ${outbound ? "text-right" : ""}`}>
                        <div
                          className={`rounded-2xl px-4 py-3 text-[13.5px] leading-6 shadow-sm ${
                            outbound ? "bg-[#0f8b98] text-white" : "border border-[#e8eef2] bg-white text-[#25313d]"
                          }`}
                        >
                          {message.body}
                        </div>
                        <p className="mt-1.5 text-[11px] font-semibold text-[#98a4ae]">
                          {message.sender} • {formatTime(message.at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-[#eef2f5] px-5 py-4">
                <div className="mb-3 flex flex-wrap gap-2">
                  {QUICK_REPLIES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setReply(item)}
                      className="max-w-full truncate rounded-full bg-[#f1f5f8] px-3 py-1.5 text-[12px] font-semibold text-[#4a5763] transition hover:bg-[#e5f7f9] hover:text-[#0f8b98]"
                    >
                      {item.slice(0, 46)}...
                    </button>
                  ))}
                </div>
                <div className="flex items-end gap-3">
                  <textarea
                    className="h-[74px] flex-1 resize-none rounded-2xl border border-[#dfe6ec] px-4 py-3 text-[13.5px] outline-none focus:border-[#0f8b98]"
                    placeholder={`Trả lời ${selectedCustomer.name} qua ${channelMeta[selected.channel].label}...`}
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                  />
                  <div className="flex flex-col gap-2">
                    <Button
                      disabled={reply.trim() === ""}
                      onClick={() => {
                        dispatch({ type: "replyConversation", id: selected.id, body: reply.trim() });
                        setReply("");
                      }}
                    >
                      <IconSend size={15} /> Gửi
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => dispatch({ type: "resolveConversation", id: selected.id })}
                    >
                      <IconCheck size={15} /> Đóng
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-10 text-center">
              <div>
                <p className="text-[15px] font-extrabold text-[#33414d]">Chọn một hội thoại để bắt đầu</p>
                <p className="mt-2 text-[13px] text-[#7b8894]">Toàn bộ tin nhắn từ mọi kênh sẽ hiển thị tại đây.</p>
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Thông tin khách hàng" subtitle="Hồ sơ đồng bộ từ ACRM" />
            {selectedCustomer ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar name={selectedCustomer.name} size={44} />
                  <div>
                    <p className="text-[14px] font-black text-[#111a22]">{selectedCustomer.name}</p>
                    <p className="text-[12.5px] text-[#7b8894]">{selectedCustomer.owner} phụ trách</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <Metric label="Điểm" value={`${selectedCustomer.score}/100`} color="#b45309" />
                  <Metric label="Giao dịch" value={String(selectedCustomer.dealCount)} />
                </div>
                <div className="space-y-2 rounded-2xl bg-[#f8fafc] p-3.5">
                  <p className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-[#8492a0]">3 tương tác gần nhất</p>
                  {selectedCustomer.timeline.slice(0, 3).map((event) => (
                    <div key={event.id} className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: channelMeta[event.channel].color }} />
                      <div>
                        <p className="text-[12.5px] font-bold text-[#33414d]">{event.title}</p>
                        <p className="text-[11.5px] text-[#8492a0]">{formatDateTime(event.at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Button className="w-full" variant="outline" onClick={() => navigate("/crm")}>
                  Xem hành trình đầy đủ
                </Button>
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Phân công & SLA" subtitle="Đảm bảo mọi hội thoại đều có người xử lý" />
            {selected ? (
              <div className="space-y-4">
                <Tabs
                  size="sm"
                  active={selected.assignee}
                  onChange={(value) => dispatch({ type: "assignConversation", id: selected.id, assignee: value })}
                  items={agents.slice(0, 4).map((name) => ({ id: name, label: name.split(" ").slice(-2).join(" ") }))}
                />
                <div className="rounded-2xl bg-[#f8fafc] p-3.5">
                  <p className="text-[12px] font-bold text-[#4a5763]">Thời gian phản hồi cho phép</p>
                  <p className="mt-1 text-[20px] font-black text-[#111a22]">{selected.slaMinutes} phút</p>
                  <p className="mt-1 text-[12px] text-[#7b8894]">
                    Cập nhật lần cuối {relativeTime(selected.updatedAt)} • Phụ trách hiện tại: {selected.assignee}
                  </p>
                </div>
                <div className="space-y-2">
                  {["Nhắc việc tự động", "Tự động gắn tag khách VIP", "Chuyển tiếp khi quá SLA"].map((rule) => (
                    <div key={rule} className="flex items-center justify-between rounded-xl border border-[#edf1f5] px-3.5 py-2.5">
                      <span className="flex items-center gap-2 text-[12.5px] font-semibold text-[#33414d]">
                        <IconTag size={14} /> {rule}
                      </span>
                      <span className="text-[11.5px] font-black text-[#15803d]">Đang bật</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Hiệu suất theo kênh" subtitle="Tỉ lệ hội thoại đã xử lý" />
            <ul className="space-y-3">
              {channelCounts.map((entry) => {
                const meta = channelMeta[entry.key];
                const total = state.conversations.filter((conversation) => conversation.channel === entry.key);
                const done = total.filter((conversation) => conversation.status === "da-xu-ly").length;
                const rate = total.length ? (done / total.length) * 100 : 0;
                return (
                  <li key={entry.key}>
                    <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                      <span className="flex items-center gap-2 font-bold text-[#33414d]">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.color }} /> {meta.label}
                      </span>
                      <span className="font-black text-[#111a22]">{rate.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#eef2f5]">
                      <div className="h-full rounded-full" style={{ width: `${rate}%`, backgroundColor: meta.color }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="bg-[#101f27] text-white">
            <p className="flex items-center gap-2 text-[13px] font-black">
              <IconUsers size={15} /> Đội ngũ đang trực
            </p>
            <ul className="mt-3 space-y-2.5">
              {state.agents.slice(0, 5).map((agent) => (
                <li key={agent.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="flex items-center gap-2">
                    <Avatar name={agent.name} size={28} />
                    <span className="font-semibold text-white/85">{agent.name}</span>
                  </span>
                  <span className="font-black text-white/70">{agent.callsToday} cuộc</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
