import type { ReactNode } from "react";
import { avatarColor, formatNumber, initials } from "../lib/format";
import { IconClose } from "./icons";

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={`rounded-3xl border border-[#e6ebf0] bg-white shadow-[0_14px_40px_rgba(15,33,45,0.05)] ${padded ? "p-5" : ""} ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-[17px] font-extrabold tracking-[-0.01em] text-[#111a22]">{title}</h3>
        {subtitle ? <p className="mt-1 text-[13px] text-[#6b7885]">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Badge({
  label,
  color,
  bg,
  className = "",
}: {
  label: string;
  color: string;
  bg: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-bold ${className}`}
      style={{ color, backgroundColor: bg }}
    >
      {label}
    </span>
  );
}

export function Dot({ color }: { color: string }) {
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const color = avatarColor(name);
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-extrabold text-white"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.36 }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

export function StatCard({
  label,
  value,
  delta,
  hint,
  accent = "#0f8b98",
  icon,
}: {
  label: string;
  value: string;
  delta?: string;
  hint?: string;
  accent?: string;
  icon?: ReactNode;
}) {
  const positive = delta?.startsWith("+");
  return (
    <Card className="relative overflow-hidden">
      <span className="absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-[0.12]" style={{ backgroundColor: accent }} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-[#78868f]">{label}</p>
          <p className="mt-2 text-[28px] font-black leading-none tracking-[-0.03em] text-[#111a22]">{value}</p>
          {hint ? <p className="mt-2 text-[12.5px] text-[#7b8894]">{hint}</p> : null}
        </div>
        {icon ? (
          <span className="grid h-11 w-11 place-items-center rounded-2xl" style={{ backgroundColor: `${accent}1a`, color: accent }}>
            {icon}
          </span>
        ) : null}
      </div>
      {delta ? (
        <p
          className="mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-bold"
          style={
            positive
              ? { color: "#15803d", backgroundColor: "#e7f7ec" }
              : { color: "#be123c", backgroundColor: "#fdeaee" }
          }
        >
          {delta} so với tuần trước
        </p>
      ) : null}
    </Card>
  );
}

export function ProgressBar({
  value,
  max = 100,
  color = "#0f8b98",
  height = 8,
  showLabel = false,
}: {
  value: number;
  max?: number;
  color?: string;
  height?: number;
  showLabel?: boolean;
}) {
  const pct = max === 0 ? 0 : Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 overflow-hidden rounded-full bg-[#eef2f5]" style={{ height }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      {showLabel ? <span className="w-12 text-right text-[12px] font-bold text-[#4a5763]">{pct.toFixed(0)}%</span> : null}
    </div>
  );
}

export function Tabs({
  items,
  active,
  onChange,
  size = "md",
}: {
  items: Array<{ id: string; label: string; count?: number }>;
  active: string;
  onChange: (id: string) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex flex-wrap gap-1.5 rounded-2xl bg-[#f1f5f8] p-1.5">
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`rounded-xl font-bold transition ${size === "sm" ? "px-3 py-1.5 text-[12.5px]" : "px-4 py-2 text-[13.5px]"} ${
              isActive ? "bg-white text-[#0f8b98] shadow-sm" : "text-[#5c6a76] hover:bg-white/70"
            }`}
          >
            {item.label}
            {typeof item.count === "number" ? (
              <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[11px] ${isActive ? "bg-[#e5f7f9] text-[#0f8b98]" : "bg-white text-[#7b8894]"}`}>
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function Select({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  label?: string;
}) {
  return (
    <label className="flex items-center gap-2 text-[13px] font-semibold text-[#5c6a76]">
      {label ? <span>{label}</span> : null}
      <select
        className="rounded-xl border border-[#dfe6ec] bg-white px-3 py-2 text-[13px] font-semibold text-[#25313d] outline-none focus:border-[#0f8b98]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Tìm kiếm...",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      className={`w-full rounded-xl border border-[#dfe6ec] bg-white px-3.5 py-2.5 text-[13.5px] text-[#25313d] outline-none transition placeholder:text-[#98a4ae] focus:border-[#0f8b98] focus:ring-2 focus:ring-[#0f8b98]/15 ${className}`}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  className = "",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "outline" | "danger" | "gold";
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  const variants: Record<string, string> = {
    primary: "bg-[#0f8b98] text-white hover:bg-[#0c7580] shadow-[0_8px_20px_rgba(15,139,152,0.22)]",
    gold: "bg-[#f5b942] text-[#181921] hover:bg-[#ffcd6b]",
    ghost: "bg-[#f1f5f8] text-[#3c4a56] hover:bg-[#e6edf2]",
    outline: "border border-[#d8e1e8] bg-white text-[#2b3945] hover:border-[#0f8b98] hover:text-[#0f8b98]",
    danger: "bg-[#be123c] text-white hover:bg-[#a30f34]",
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        size === "sm" ? "px-3 py-2 text-[12.5px]" : "px-4 py-2.5 text-[13.5px]"
      } ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function DataTable<T>({
  columns,
  rows,
  onRowClick,
  emptyLabel = "Không có dữ liệu",
  rowKey,
}: {
  columns: Array<{ key: string; label: string; className?: string; render: (row: T) => ReactNode }>;
  rows: T[];
  onRowClick?: (row: T) => void;
  emptyLabel?: string;
  rowKey: (row: T) => string;
}) {
  if (rows.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-[#dfe6ec] bg-[#fafcfd] py-12 text-[13.5px] font-semibold text-[#7b8894]">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="border-b border-[#e9eef3]">
            {columns.map((column) => (
              <th
                key={column.key}
                className={`whitespace-nowrap px-3 py-2.5 text-[11.5px] font-black uppercase tracking-[0.06em] text-[#7b8894] ${column.className ?? ""}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-[#f0f4f7] transition ${onRowClick ? "cursor-pointer hover:bg-[#f7fbfc]" : ""}`}
            >
              {columns.map((column) => (
                <td key={column.key} className={`px-3 py-3 align-middle text-[13.5px] text-[#33414d] ${column.className ?? ""}`}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-[#0b141b]/45 p-4 backdrop-blur-sm sm:items-center">
      <div className={`w-full ${wide ? "max-w-4xl" : "max-w-xl"} rounded-3xl bg-white shadow-[0_30px_90px_rgba(11,20,27,0.35)]`}>
        <div className="flex items-start justify-between gap-4 border-b border-[#eef2f5] px-6 py-4">
          <div>
            <h3 className="text-[17px] font-extrabold text-[#111a22]">{title}</h3>
            {subtitle ? <p className="mt-1 text-[13px] text-[#6b7885]">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-[#f1f5f8] text-[#5c6a76] transition hover:bg-[#e4ebf0]"
            aria-label="Đóng"
          >
            <IconClose size={16} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer ? <div className="flex flex-wrap justify-end gap-3 border-t border-[#eef2f5] px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl bg-[#f8fafc] px-3.5 py-3">
      <p className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-[#8492a0]">{label}</p>
      <div className="mt-1 text-[13.5px] font-semibold text-[#25313d]">{value}</div>
    </div>
  );
}

export function Metric({ label, value, color = "#111a22" }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-[#edf1f5] px-4 py-3">
      <p className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-[#8492a0]">{label}</p>
      <p className="mt-1.5 text-[20px] font-black tracking-[-0.02em]" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

export function BarChart({
  data,
  height = 170,
  colors = ["#0f8b98", "#7cc9d2"],
}: {
  data: Array<{ label: string; values: number[] }>;
  height?: number;
  colors?: string[];
}) {
  const max = Math.max(1, ...data.flatMap((item) => item.values));
  return (
    <div className="flex items-end gap-2.5" style={{ height }}>
      {data.map((item) => (
        <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-full w-full items-end justify-center gap-1">
            {item.values.map((value, index) => (
              <div
                key={`${item.label}-${index}`}
                className="w-full max-w-[14px] rounded-t-md transition-all"
                style={{ height: `${Math.max(3, (value / max) * 100)}%`, backgroundColor: colors[index % colors.length] }}
                title={`${value}`}
              />
            ))}
          </div>
          <span className="text-[11px] font-semibold text-[#7b8894]">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function LineChart({
  points,
  height = 180,
  color = "#0f8b98",
  secondaryColor = "#f5b942",
  labels,
  secondaryPoints,
}: {
  points: number[];
  height?: number;
  color?: string;
  secondaryColor?: string;
  labels: string[];
  secondaryPoints?: number[];
}) {
  const all = secondaryPoints ? [...points, ...secondaryPoints] : points;
  const max = Math.max(...all) * 1.15;
  const min = Math.min(...all) * 0.85;
  const width = 100;
  const toPath = (series: number[]) =>
    series
      .map((value, index) => {
        const x = (index / (series.length - 1)) * width;
        const y = 100 - ((value - min) / (max - min || 1)) * 100;
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");

  return (
    <div>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {[0, 25, 50, 75, 100].map((line) => (
            <line key={line} x1="0" y1={line} x2="100" y2={line} stroke="#eef2f5" strokeWidth="0.4" />
          ))}
          {secondaryPoints ? (
            <path d={toPath(secondaryPoints)} fill="none" stroke={secondaryColor} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          ) : null}
          <path d={toPath(points)} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
        </svg>
      </div>
      <div className="mt-2 flex justify-between text-[11px] font-semibold text-[#7b8894]">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}

export function Donut({
  data,
  size = 168,
  thickness = 22,
  centerLabel,
  centerValue,
}: {
  data: Array<{ label: string; value: number; color: string }>;
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#eef2f5" strokeWidth={thickness} />
          {data.map((item) => {
            const length = (item.value / total) * circumference;
            const element = (
              <circle
                key={item.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth={thickness}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += length;
            return element;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[22px] font-black leading-none text-[#111a22]">{centerValue}</p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[#8492a0]">{centerLabel}</p>
          </div>
        </div>
      </div>
      <ul className="space-y-2">
        {data.map((item) => (
          <li key={item.label} className="flex items-center gap-2.5 text-[13px]">
            <Dot color={item.color} />
            <span className="font-semibold text-[#3c4a56]">{item.label}</span>
            <span className="font-black text-[#111a22]">{formatNumber(item.value)}</span>
            <span className="text-[12px] text-[#8492a0]">({((item.value / total) * 100).toFixed(0)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="grid place-items-center gap-3 rounded-3xl border border-dashed border-[#dfe6ec] bg-[#fafcfd] px-6 py-14 text-center">
      <p className="text-[15px] font-extrabold text-[#33414d]">{title}</p>
      {hint ? <p className="max-w-md text-[13px] text-[#7b8894]">{hint}</p> : null}
      {action}
    </div>
  );
}
