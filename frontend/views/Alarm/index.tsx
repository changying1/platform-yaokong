import React from "react";
import { AlarmStats } from "./components/AlarmStats";
import { AlarmFilterBar } from "./components/AlarmFilterBar";
import { AlarmTable } from "./components/AlarmTable";
import { useAlarms } from "./hooks/useAlarms";

export default function AlarmRecords() {
  const {
    alarms,
    stats,
    statusFilter,
    setStatusFilter,
    levelFilter,
    setLevelFilter,
    searchTerm,
    setSearchTerm,
    actions,
  } = useAlarms();

  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
      {/* Statistics Section */}
      <AlarmStats
        total={stats.total}
        pending={stats.pending}
        resolved={stats.resolved}
        high={stats.high}
      />

      {/* List Section */}
      <div
        className="flex-1 rounded-[2rem] p-8 flex flex-col overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, rgba(14,78,191,0.82), rgba(12,66,168,0.74))",
          border: "1px solid rgba(191,219,254,0.38)",
          boxShadow:
            "0 30px 90px rgba(7,20,63,0.46), 0 1px 0 rgba(191,219,254,0.16) inset",
          backdropFilter: "blur(12px)",
        }}
      >
        <header className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-black tracking-tight text-[#e8f1ff]">
              报警记录明细
            </h2>
            <div className="text-[11px] mt-1 text-[#c7dbff] font-semibold">
              筛选 · 搜索 · 处置与删除
            </div>
          </div>

          <div
            className="text-xs font-black px-3 py-1.5 rounded-full"
            style={{
              color: "#0b3a82",
              background:
                "linear-gradient(180deg, rgba(239,246,255,0.95), rgba(219,234,254,0.90))",
              border: "1px solid rgba(147,197,253,0.72)",
              boxShadow: "0 12px 30px rgba(7,20,63,0.25)",
              backdropFilter: "blur(10px)",
              whiteSpace: "nowrap",
            }}
          >
            共 {alarms.length} 条符合条件
          </div>
        </header>

        <AlarmFilterBar
          status={statusFilter}
          level={levelFilter}
          searchTerm={searchTerm}
          onStatusChange={setStatusFilter}
          onLevelChange={setLevelFilter}
          onSearchChange={setSearchTerm}
        />

        <AlarmTable
          alarms={alarms}
          onResolve={actions.resolve}
          onDelete={actions.delete}
          onUpdateLevel={actions.updateLevel}
        />

        {/* Footer info */}
        <footer
          className="mt-6 pt-6 flex justify-between items-center text-[11px] font-bold"
          style={{
            borderTop: "1px solid rgba(191,219,254,0.18)",
            color: "rgba(199,219,255,0.82)",
          }}
        >
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" /> 实时同步开启
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-sky-300" /> 每 30
              秒自动刷新
            </div>
          </div>
          <div>智能安全预警平台 V2.0</div>
        </footer>
      </div>
    </div>
  );
}
