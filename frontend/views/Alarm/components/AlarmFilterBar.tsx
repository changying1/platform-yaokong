import React from "react";
import { Filter, AlertTriangle, Search } from "lucide-react";
import { AlarmStatusFilter, AlarmLevelFilter } from "../types";

interface FilterBarProps {
  status: AlarmStatusFilter;
  level: AlarmLevelFilter;
  searchTerm: string;
  onStatusChange: (s: AlarmStatusFilter) => void;
  onLevelChange: (l: AlarmLevelFilter) => void;
  onSearchChange: (t: string) => void;
}

export const AlarmFilterBar: React.FC<FilterBarProps> = ({
  status,
  level,
  searchTerm,
  onStatusChange,
  onLevelChange,
  onSearchChange,
}) => {
  const pillStyle: React.CSSProperties = {
    background:
      "linear-gradient(180deg, rgba(239,246,255,0.95), rgba(219,234,254,0.90))",
    border: "1px solid rgba(147,197,253,0.72)",
    boxShadow: "0 12px 30px rgba(7,20,63,0.20)",
    backdropFilter: "blur(10px)",
  };

  const selectStyle: React.CSSProperties = {
    background: "transparent",
    fontSize: 13,
    fontWeight: 900 as any,
    color: "#0b3a82",
    outline: "none",
    border: "none",
    paddingRight: 14,
  };

  return (
    <div className="flex justify-between items-center mb-6 gap-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 p-1.5 rounded-xl" style={pillStyle}>
          <Filter size={16} color="rgba(11,58,130,0.55)" className="ml-2" />
          <select
            style={selectStyle}
            value={status}
            onChange={(e) => onStatusChange(e.target.value as AlarmStatusFilter)}
          >
            <option value="all">所有状态</option>
            <option value="pending">待处理</option>
            <option value="resolved">已处置</option>
          </select>
        </div>

        <div className="flex items-center gap-2 p-1.5 rounded-xl" style={pillStyle}>
          <AlertTriangle size={16} color="rgba(11,58,130,0.55)" className="ml-2" />
          <select
            style={selectStyle}
            value={level}
            onChange={(e) => onLevelChange(e.target.value as AlarmLevelFilter)}
          >
            <option value="all">所有级别</option>
            <option value="high">高危</option>
            <option value="medium">警告</option>
            <option value="low">提示</option>
          </select>
        </div>
      </div>

      <div className="relative flex-1 max-w-md group">
        <input
          type="text"
          placeholder="搜索报警人、设备或位置..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-xl pl-11 pr-4 py-2.5 text-sm outline-none transition-all"
          style={{
            background:
              "linear-gradient(180deg, rgba(239,246,255,0.95), rgba(219,234,254,0.90))",
            border: "1px solid rgba(147,197,253,0.72)",
            boxShadow: "0 12px 30px rgba(7,20,63,0.20)",
            color: "#0b3a82",
          }}
        />
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors"
          color="rgba(11,58,130,0.55)"
        />
      </div>
    </div>
  );
};
