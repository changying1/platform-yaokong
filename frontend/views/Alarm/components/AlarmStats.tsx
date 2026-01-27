import React from "react";
import { AlertCircle, Clock, CheckCircle, AlertTriangle } from "lucide-react";

interface StatsProps {
  total: number;
  pending: number;
  resolved: number;
  high: number;
}

export const AlarmStats: React.FC<StatsProps> = ({
  total,
  pending,
  resolved,
  high,
}) => {
  const statCards = [
    { label: "今日报警总数", value: total, icon: AlertCircle, tone: "red" as const },
    { label: "待处理", value: pending, icon: Clock, tone: "amber" as const },
    { label: "已处置", value: resolved, icon: CheckCircle, tone: "green" as const },
    { label: "严重报警", value: high, icon: AlertTriangle, tone: "blue" as const },
  ];

  const toneStyle = (tone: "red" | "amber" | "green" | "blue") => {
    // 卡片里面的小 icon 仍保留红/橙/绿提示，但整体“壳子”统一为 Dashboard 蓝玻璃
    if (tone === "red")
      return { iconFg: "#dc2626", iconBg: "rgba(220,38,38,0.14)", iconBd: "rgba(248,113,113,0.40)", value: "#ffffff" };
    if (tone === "amber")
      return { iconFg: "#f59e0b", iconBg: "rgba(245,158,11,0.14)", iconBd: "rgba(253,224,71,0.35)", value: "#fde68a" };
    if (tone === "green")
      return { iconFg: "#16a34a", iconBg: "rgba(34,197,94,0.14)", iconBd: "rgba(134,239,172,0.35)", value: "#bbf7d0" };
    return { iconFg: "#2563eb", iconBg: "rgba(59,130,246,0.16)", iconBd: "rgba(147,197,253,0.45)", value: "#bfdbfe" };
  };

  return (
    <div className="grid grid-cols-4 gap-4">
      {statCards.map((card, i) => {
        const s = toneStyle(card.tone);
        const Icon = card.icon;
        return (
          <div
            key={i}
            className="rounded-2xl p-5 flex items-center gap-4 transition-transform hover:-translate-y-[1px]"
            style={{
              background:
                "linear-gradient(180deg, rgba(14,78,191,0.78), rgba(12,66,168,0.70))",
              border: "1px solid rgba(191,219,254,0.38)",
              boxShadow:
                "0 28px 80px rgba(7,20,63,0.42), 0 1px 0 rgba(191,219,254,0.16) inset",
              backdropFilter: "blur(12px)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: -90,
                background:
                  "radial-gradient(circle at 28% 18%, rgba(147,197,253,0.22), transparent 60%)",
                pointerEvents: "none",
              }}
            />

            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: `linear-gradient(180deg, rgba(239,246,255,0.92), rgba(219,234,254,0.86))`,
                border: "1px solid rgba(147,197,253,0.72)",
                boxShadow: "0 14px 30px rgba(7,20,63,0.18)",
              }}
            >
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{
                  background: s.iconBg,
                  border: `1px solid ${s.iconBd}`,
                  color: s.iconFg,
                }}
              >
                <Icon size={22} />
              </div>
            </div>

            <div style={{ position: "relative", zIndex: 1 }}>
              <div className="text-xs font-semibold" style={{ color: "rgba(219,234,254,0.90)" }}>
                {card.label}
              </div>
              <div
                className="text-3xl font-black font-mono tracking-tight"
                style={{ color: s.value }}
              >
                {card.value}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
