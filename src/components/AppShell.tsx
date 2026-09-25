import { useMemo, useState, type ReactNode } from "react";
import { useApp } from "../lib/store";
import { appHref, useRoute, useRouter } from "../lib/router";
import { channelMeta, relativeTime } from "../lib/format";
import {
  IconBell,
  IconChat,
  IconClose,
  IconDashboard,
  IconFlow,
  IconMenu,
  IconPhone,
  IconRobot,
  IconSearch,
  IconSend,
  IconTarget,
  IconUsers,
} from "./icons";
import { Avatar, Badge } from "./ui";

export interface NavItem {
  path: string;
  label: string;
  icon: (props: { size?: number }) => ReactNode;
  badge?: number;
  group: string;
}

export function useNavItems(): NavItem[] {
  const { state } = useApp();
  const openConversations = state.conversations.filter((item) => item.status !== "da-xu-ly").length;
  const activeCalls = state.calls.filter((call) => call.status === "talking" || call.status === "ringing").length;
  const pendingTasks = state.telesalesTasks.filter((task) => !task.done).length;
  const newLeads = state.leads.filter((lead) => lead.status === "moi").length;
  return [
    { path: "/tong-quan", label: "Tổng quan", icon: IconDashboard, group: "Điều hành" },
    { path: "/crm", label: "CRM khách hàng", icon: IconUsers, group: "Vận hành" },
    { path: "/da-kenh", label: "Đa kênh", icon: IconChat, badge: openConversations, group: "Vận hành" },
    { path: "/tong-dai", label: "Tổng đài", icon: IconPhone, badge: activeCalls, group: "Vận hành" },
    { path: "/callbot", label: "Callbot AI", icon: IconRobot, group: "Tự động hoá" },
    { path: "/telesales", label: "Telesales", icon: IconTarget, badge: pendingTasks, group: "Tự động hoá" },
    { path: "/nhan-tin", label: "Nhắn tin", icon: IconSend, group: "Tự động hoá" },
    { path: "/ulead-uflow", label: "Ulead & Uflow", icon: IconFlow, badge: newLeads, group: "Tự động hoá" },
  ];
}

function groupItems(items: NavItem[]): Array<{ group: string; items: NavItem[] }> {
  const groups: Array<{ group: string; items: NavItem[] }> = [];
  for (const item of items) {
    const existing = groups.find((entry) => entry.group === item.group);
    if (existing) existing.items.push(item);
    else groups.push({ group: item.group, items: [item] });
  }
  return groups;
}

export function AppShell({ children }: { children: ReactNode }) {
  const navItems = useNavItems();
  const { navigate } = useRouter();
  const route = useRoute();
  const { state, dispatch } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showToasts, setShowToasts] = useState(true);
  const [search, setSearch] = useState("");

  const searchResults = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (keyword.length < 2) return { customers: [], conversations: [] };
    return {
      customers: state.customers
        .filter((customer) => [customer.name, customer.company, customer.phone, customer.code].join(" ").toLowerCase().includes(keyword))
        .slice(0, 5),
      conversations: state.conversations
        .filter((conversation) => {
          const customer = state.customers.find((item) => item.id === conversation.customerId);
          return [conversation.subject, customer?.name ?? ""].join(" ").toLowerCase().includes(keyword);
        })
        .slice(0, 4),
    };
  }, [search, state.customers, state.conversations]);

  const hasSearchResults = search.trim().length >= 2;

  const activePath = `/${route.segments[0] ?? "tong-quan"}`;
  const groups = groupItems(navItems);

  const sidebar = (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-4 py-5">
      <a href={appHref("/tong-quan")} className="flex items-center gap-2.5 px-1" onClick={() => setMobileOpen(false)}>
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-[#26b9c5] to-[#0d7d88] text-[17px] font-black text-white">
          C
        </span>
        <span>
          <span className="block text-[17px] font-black leading-none tracking-[-0.02em] text-white">Callio</span>
          <span className="mt-1 block text-[11px] font-semibold text-white/55">Business Suite 4.0</span>
        </span>
      </a>

      {groups.map((group) => (
        <div key={group.group}>
          <p className="px-2 pb-2 text-[10.5px] font-black uppercase tracking-[0.14em] text-white/40">{group.group}</p>
          <nav className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activePath === item.path;
              return (
                <a
                  key={item.path}
                  href={appHref(item.path)}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13.5px] font-bold transition ${
                    isActive ? "bg-white text-[#0b3d44] shadow-[0_10px_30px_rgba(0,0,0,0.22)]" : "text-white/72 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon size={18} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                        isActive ? "bg-[#e5f7f9] text-[#0f8b98]" : "bg-[#f5b942] text-[#181921]"
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </a>
              );
            })}
          </nav>
        </div>
      ))}

      <div className="mt-auto rounded-2xl bg-white/10 p-4">
        <p className="text-[12.5px] font-black text-white">Đội ngũ hỗ trợ 24/7</p>
        <p className="mt-1 text-[11.5px] leading-5 text-white/60">Hotline 1900 3236 - hỗ trợ cấu hình, đào tạo và triển khai.</p>
        <a
          className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-[#f5b942] px-3 py-2 text-[12.5px] font-black text-[#181921]"
          href="tel:19003236"
        >
          Gọi tư vấn ngay
        </a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f4f7f9]">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[248px] bg-[#101f27] lg:block">{sidebar}</aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-[#0b141b]/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[270px] bg-[#101f27]">
            <button
              type="button"
              className="absolute right-3 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white"
              onClick={() => setMobileOpen(false)}
              aria-label="Đóng menu"
            >
              <IconClose size={16} />
            </button>
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 border-b border-[#e4eaef] bg-white/95 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-xl bg-[#f1f5f8] text-[#3c4a56] lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Mở menu"
            >
              <IconMenu size={18} />
            </button>

            <div className="relative hidden flex-1 max-w-md md:block">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#98a4ae]">
                <IconSearch size={17} />
              </span>
              <input
                className="w-full rounded-xl border border-[#e2e9ee] bg-[#f7fafc] py-2.5 pl-10 pr-3 text-[13.5px] outline-none focus:border-[#0f8b98] focus:bg-white"
                placeholder="Tìm khách hàng, số điện thoại, hội thoại..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              {hasSearchResults ? (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[420px] overflow-y-auto rounded-2xl border border-[#e6ebf0] bg-white p-2 shadow-[0_20px_55px_rgba(15,33,45,0.16)]">
                  {searchResults.customers.length === 0 && searchResults.conversations.length === 0 ? (
                    <p className="px-3 py-6 text-center text-[13px] font-semibold text-[#98a4ae]">
                      Không tìm thấy kết quả cho “{search.trim()}”
                    </p>
                  ) : null}

                  {searchResults.customers.length > 0 ? (
                    <>
                      <p className="px-3 pb-1 pt-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#8492a0]">Khách hàng</p>
                      {searchResults.customers.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => {
                            navigate("/crm");
                            setSearch("");
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[#f2fbfc]"
                        >
                          <Avatar name={customer.name} size={32} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-bold text-[#111a22]">{customer.name}</span>
                            <span className="block truncate text-[11.5px] text-[#7b8894]">
                              {customer.code} • {customer.company}
                            </span>
                          </span>
                        </button>
                      ))}
                    </>
                  ) : null}

                  {searchResults.conversations.length > 0 ? (
                    <>
                      <p className="px-3 pb-1 pt-3 text-[11px] font-black uppercase tracking-[0.08em] text-[#8492a0]">Hội thoại</p>
                      {searchResults.conversations.map((conversation) => (
                        <button
                          key={conversation.id}
                          type="button"
                          onClick={() => {
                            navigate("/da-kenh");
                            setSearch("");
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[#f2fbfc]"
                        >
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e5f7f9] text-[#0f8b98]">
                            <IconChat size={15} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-bold text-[#111a22]">{conversation.subject}</span>
                            <span className="block truncate text-[11.5px] text-[#7b8894]">
                              {channelMeta[conversation.channel].label} • {relativeTime(conversation.updatedAt)}
                            </span>
                          </span>
                        </button>
                      ))}
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="ml-auto flex items-center gap-2.5">
              <Badge label="Tổng đài hoạt động" color="#15803d" bg="#e7f7ec" className="hidden sm:inline-flex" />
              <button
                type="button"
                onClick={() => dispatch({ type: "toast", message: "3 thông báo mới: 1 cuộc gọi nhỡ, 2 hội thoại quá SLA", tone: "warn" })}
                className="relative grid h-10 w-10 place-items-center rounded-xl bg-[#f1f5f8] text-[#3c4a56] transition hover:bg-[#e6edf2]"
                aria-label="Thông báo"
              >
                <IconBell size={18} />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#be123c]" />
              </button>
              <div className="flex items-center gap-2.5 rounded-2xl border border-[#e6ebf0] bg-white px-2.5 py-1.5">
                <Avatar name={state.currentUser.name} size={32} />
                <span className="hidden leading-tight sm:block">
                  <span className="block text-[12.5px] font-black text-[#111a22]">{state.currentUser.name}</span>
                  <span className="block text-[11px] text-[#7b8894]">{state.currentUser.role}</span>
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>

      {showToasts && state.toasts.length > 0 ? (
        <div className="fixed bottom-5 right-5 z-[90] flex w-[320px] flex-col gap-2.5">
          {state.toasts.map((toast) => (
            <div
              key={toast.id}
              className="flex items-start gap-3 rounded-2xl border border-[#e6ebf0] bg-white p-3.5 shadow-[0_18px_50px_rgba(15,33,45,0.18)]"
            >
              <span
                className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-black text-white"
                style={{ backgroundColor: toast.tone === "success" ? "#15803d" : toast.tone === "warn" ? "#b45309" : "#0f8b98" }}
              >
                {toast.tone === "success" ? "✓" : toast.tone === "warn" ? "!" : "i"}
              </span>
              <p className="flex-1 text-[12.5px] font-semibold leading-5 text-[#33414d]">{toast.message}</p>
              <button
                type="button"
                onClick={() => dispatch({ type: "dismissToast", id: toast.id })}
                className="text-[#98a4ae] transition hover:text-[#33414d]"
                aria-label="Đóng thông báo"
              >
                <IconClose size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-[11.5px] font-bold text-[#7b8894] hover:text-[#0f8b98]"
            onClick={() => setShowToasts(false)}
          >
            Ẩn thông báo ({relativeTime(new Date().toISOString())})
          </button>
        </div>
      ) : null}

      <div className="pointer-events-none fixed bottom-6 right-6 z-[60] hidden xl:block">
        <button
          type="button"
          onClick={() => navigate("/callbot")}
          className="pointer-events-auto flex items-center gap-3 rounded-full bg-white p-2 pr-5 shadow-[0_18px_55px_rgba(24,25,33,0.18)]"
        >
          <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#26b9c5] to-[#0d7d88] text-[13px] font-black text-white">
            AI
          </span>
          <span className="text-[13px] font-black text-[#181921]">Trợ lý Callbot</span>
        </button>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  breadcrumb?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {breadcrumb ? <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.1em] text-[#0f8b98]">{breadcrumb}</p> : null}
        <h1 className="text-[26px] font-black tracking-[-0.03em] text-[#0f1a22] sm:text-[30px]">{title}</h1>
        <p className="mt-2 max-w-3xl text-[13.5px] leading-6 text-[#66757f]">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2.5">{actions}</div> : null}
    </div>
  );
}
