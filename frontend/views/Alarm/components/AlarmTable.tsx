import React from "react";
import { MapPin, AlertCircle, CheckCircle, Trash2 } from "lucide-react";
import { AlarmRecord } from "../types";

interface TableProps {
  alarms: AlarmRecord[];
  onResolve: (id: number) => void;
  onDelete: (id: number) => void;
  onUpdateLevel: (id: number, level: string) => void;
}

export const AlarmTable: React.FC<TableProps> = ({
  alarms,
  onResolve,
  onDelete,
  onUpdateLevel,
}) => {
  const levelStyle = (level: string) => {
    switch (level) {
      case "high":
        return {
          bg: "rgba(220,38,38,0.14)",
          fg: "#fecaca",
          bd: "rgba(248,113,113,0.45)",
        };
      case "medium":
        return {
          bg: "rgba(245,158,11,0.14)",
          fg: "#fde68a",
          bd: "rgba(253,224,71,0.40)",
        };
      default:
        return {
          bg: "rgba(59,130,246,0.16)",
          fg: "#bfdbfe",
          bd: "rgba(147,197,253,0.45)",
        };
    }
  };

  const levelLabel = (level: string) => {
    switch (level) {
      case "high":
        return "高危";
      case "medium":
        return "警告";
      default:
        return "提示";
    }
  };

  return (
    <div
      className="flex-1 overflow-auto custom-scrollbar rounded-2xl"
      style={{
        border: "1px solid rgba(191,219,254,0.28)",
        background:
          "radial-gradient(900px 460px at 24% 0%, rgba(147,197,253,0.18), transparent 64%)," +
          "radial-gradient(900px 460px at 88% 18%, rgba(59,130,246,0.16), transparent 62%)," +
          "linear-gradient(180deg, rgba(12,64,166,0.26), rgba(10,47,115,0.36))",
        boxShadow: "0 1px 0 rgba(191,219,254,0.12) inset",
      }}
    >
      <table className="w-full text-left border-separate border-spacing-0">
        <thead
          className="sticky top-0 z-10"
          style={{
            background:
              "linear-gradient(180deg, rgba(15,78,190,0.62), rgba(12,63,156,0.30))",
            color: "rgba(219,234,254,0.86)",
            fontSize: 11,
            letterSpacing: 0.6,
          }}
        >
          <tr>
            {[
              "报警编号",
              "报警类型",
              "人员/设备",
              "报警时间",
              "位置",
              "级别",
              "状态",
              "操作",
            ].map((h, idx) => (
              <th
                key={h}
                className={`p-4 font-black ${idx === 7 ? "text-right" : ""}`}
                style={{
                  borderBottom: "1px solid rgba(191,219,254,0.22)",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody style={{ color: "rgba(232,241,255,0.92)" }}>
          {alarms.map((alarm) => {
            const lv = levelStyle(alarm.level);
            return (
              <tr
                key={alarm.id}
                className="group transition-colors"
                style={{
                  borderBottom: "1px solid rgba(191,219,254,0.12)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLTableRowElement).style.background =
                    "linear-gradient(180deg, rgba(239,246,255,0.10), rgba(219,234,254,0.06))";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLTableRowElement).style.background =
                    "transparent";
                }}
              >
                <td className="p-4 font-mono text-[11px]" style={{ color: "rgba(199,219,255,0.70)" }}>
                  {alarm.id}
                </td>

                <td className="p-4 font-black" style={{ color: "#e8f1ff" }}>
                  {alarm.type}
                </td>

                <td className="p-4">
                  <div className="flex flex-col">
                    <span className="font-semibold" style={{ color: "#e8f1ff" }}>
                      {alarm.user}
                    </span>
                    <span className="text-[10px] font-mono italic" style={{ color: "rgba(199,219,255,0.70)" }}>
                      {alarm.device}
                    </span>
                  </div>
                </td>

                <td className="p-4 text-xs" style={{ color: "rgba(199,219,255,0.82)" }}>
                  {alarm.time}
                </td>

                <td className="p-4 text-xs" style={{ color: "rgba(199,219,255,0.82)" }}>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="p-1 rounded-md"
                      style={{
                        background: "rgba(239,246,255,0.10)",
                        border: "1px solid rgba(191,219,254,0.18)",
                        color: "#93c5fd",
                      }}
                    >
                      <MapPin size={12} />
                    </div>
                    {alarm.location}
                  </div>
                </td>

                <td className="p-4">
                  {alarm.status === "pending" ? (
                    <select
                      value={alarm.level}
                      onChange={(e) => onUpdateLevel(alarm.rawId, e.target.value)}
                      className="px-2 py-1 rounded-lg text-[11px] font-black outline-none cursor-pointer transition-all"
                      style={{
                        background: lv.bg,
                        color: lv.fg,
                        border: `1px solid ${lv.bd}`,
                      }}
                    >
                      <option value="high">高危</option>
                      <option value="medium">警告</option>
                      <option value="low">提示</option>
                    </select>
                  ) : (
                    <span
                      className="px-2.5 py-1 rounded-lg text-[11px] font-black inline-flex"
                      style={{
                        background: lv.bg,
                        color: lv.fg,
                        border: `1px solid ${lv.bd}`,
                      }}
                    >
                      {levelLabel(alarm.level)}
                    </span>
                  )}
                </td>

                <td className="p-4">
                  {alarm.status === "pending" ? (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black"
                      style={{
                        background: "rgba(220,38,38,0.10)",
                        color: "#fecaca",
                        border: "1px solid rgba(248,113,113,0.32)",
                      }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> 待处理
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black"
                      style={{
                        background: "rgba(34,197,94,0.10)",
                        color: "#bbf7d0",
                        border: "1px solid rgba(134,239,172,0.30)",
                      }}
                    >
                      <CheckCircle size={12} /> 已处置
                    </span>
                  )}
                </td>

                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {alarm.status === "pending" && (
                      <button
                        onClick={() => onResolve(alarm.rawId)}
                        className="text-xs px-4 py-1.5 rounded-xl font-black transition-all active:scale-95"
                        style={{
                          color: "#ffffff",
                          background: "linear-gradient(180deg, #60a5fa, #2563eb)",
                          border: "1px solid rgba(191,219,254,0.38)",
                          boxShadow: "0 14px 30px rgba(37,99,235,0.28)",
                        }}
                      >
                        处置
                      </button>
                    )}

                    <button
                      onClick={() => onDelete(alarm.rawId)}
                      className="p-1.5 rounded-xl transition-all"
                      title="删除记录"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(239,246,255,0.14), rgba(219,234,254,0.08))",
                        border: "1px solid rgba(191,219,254,0.18)",
                        color: "rgba(199,219,255,0.92)",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.border =
                          "1px solid rgba(248,113,113,0.45)";
                        (e.currentTarget as HTMLButtonElement).style.color = "#fecaca";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.border =
                          "1px solid rgba(191,219,254,0.18)";
                        (e.currentTarget as HTMLButtonElement).style.color =
                          "rgba(199,219,255,0.92)";
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}

          {alarms.length === 0 && (
            <tr>
              <td colSpan={8} className="p-20 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(239,246,255,0.12), rgba(219,234,254,0.06))",
                      border: "1px solid rgba(191,219,254,0.18)",
                      color: "rgba(199,219,255,0.55)",
                    }}
                  >
                    <AlertCircle size={32} />
                  </div>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "rgba(199,219,255,0.78)" }}
                  >
                    暂无相关报警记录
                  </span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
