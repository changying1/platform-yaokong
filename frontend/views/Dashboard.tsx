import React, { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import chinaJson from "../src/assets/china.json";

type BranchStatus = "正常" | "告警" | "离线";

type Branch = {
  province: string;
  name: string;
  coord?: [number, number];
  address?: string;
  project?: string;

  // ✅ 新增信息（弹窗展示）
  manager?: string; // 负责人
  phone?: string; // 联系电话
  deviceCount?: number; // 设备数量
  status?: BranchStatus; // 状态
  updatedAt?: string; // 更新时间
  remark?: string; // 备注
};

const BRANCHES: Branch[] = [
  {
    province: "北京",
    name: "北京总部",
    coord: [116.4074, 39.9042],
    address: "北京市东城区（示例地址，可替换为真实地址）",
    project: "总部",
    manager: "张三",
    phone: "138****0001",
    deviceCount: 128,
    status: "正常",
    updatedAt: "2026-01-11 21:30:00",
    remark: "总部数据中心",
  },
  {
    province: "浙江",
    name: "浙江分公司",
    coord: [120.1551, 30.2741],
    address: "浙江省杭州市西湖区（示例地址，可替换为真实地址）",
    project: "华东",
    manager: "李四",
    phone: "138****0002",
    deviceCount: 86,
    status: "告警",
    updatedAt: "2026-01-11 21:25:10",
    remark: "近期存在多次报警",
  },
  {
    province: "广东",
    name: "广东分公司",
    coord: [113.2644, 23.1291],
    address: "广东省广州市越秀区（示例地址，可替换为真实地址）",
    project: "华南",
    manager: "王五",
    phone: "138****0003",
    deviceCount: 102,
    status: "正常",
    updatedAt: "2026-01-11 21:18:45",
    remark: "运行稳定",
  },
];

// 只注册一次地图
if (!echarts.getMap("china")) {
  echarts.registerMap("china", chinaJson as any);
}

export default function Dashboard() {
  const [summary, setSummary] = useState({
    fenceCount: 0,
    alarmCount: 0,
    deviceCount: 0,
  });

  // ✅ 点击分公司点位弹窗数据
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  // 你现在是“全宽地图、无左侧栏”，这里固定“全部”
  const selectedProvince = "全部";

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/dashboard/summary");
        const data = await res.json();
        setSummary({
          fenceCount: data.fenceCount ?? 0,
          alarmCount: data.alarmCount ?? 0,
          deviceCount: data.deviceCount ?? 0,
        });
      } catch (e) {
        console.error("dashboard summary fetch failed:", e);
      }
    })();
  }, []);

  const selectedCenter = useMemo(() => undefined, []);

  const mapOption = useMemo(() => {
    const visibleBranches =
      selectedProvince === "全部"
        ? BRANCHES
        : BRANCHES.filter((b) => b.province === selectedProvince);

    const highlighted =
      selectedProvince === "全部"
        ? Array.from(new Set(BRANCHES.map((b) => b.province)))
        : [selectedProvince];

    // 点位数据：tooltip 也会用到
    const branchPoints = visibleBranches
      .filter((b) => b.coord)
      .map((b) => ({
        name: b.name,
        province: b.province,
        address: b.address ?? "",
        value: [...(b.coord as [number, number]), 1],
      }));

    const MAP_AREA = "#3b78a6";
    const MAP_AREA_HL = "#5a96c8";
    const MAP_AREA_HOVER = "#6aa2cf";

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(15,23,42,0.92)",
        borderColor: "rgba(59,130,246,0.25)",
        borderWidth: 1,
        textStyle: { color: "#e2e8f0" },
        extraCssText: "border-radius:10px; padding:10px 12px;",
        formatter: (params: any) => {
          const isPoint =
            params?.seriesType === "effectScatter" ||
            params?.seriesType === "scatter";

          if (isPoint) {
            const d = params.data || {};
            const lng = Array.isArray(d.value) ? d.value[0] : "";
            const lat = Array.isArray(d.value) ? d.value[1] : "";
            const addr = (d.address ?? "").trim() || "—";
            return `
              <div style="font-weight:800; font-size:13px; margin-bottom:6px;">
                ${d.name ?? ""}
              </div>
              <div style="opacity:.95; line-height:1.6;">
                <div><span style="opacity:.75;">省份：</span>${d.province ?? ""}</div>
                <div><span style="opacity:.75;">地址：</span>${addr}</div>
                <div style="opacity:.7; margin-top:6px;">
                  坐标：${lng}, ${lat}
                </div>
              </div>
            `;
          }

          return params?.name ?? "";
        },
      },

      geo: {
        map: "china",
        roam: true,
        zoom: selectedProvince === "全部" ? 1.12 : 2.25,
        center: selectedCenter,

        itemStyle: {
          areaColor: MAP_AREA,
          borderColor: "#3b82f6",
          borderWidth: 1.2,
          shadowColor: "rgba(59,130,246,0.25)",
          shadowBlur: 18,
          shadowOffsetY: 0,
        },

        label: {
          show: true,
          color: "rgba(255,255,255,0.72)",
          fontSize: 11,
        },

        emphasis: {
          itemStyle: {
            areaColor: MAP_AREA_HOVER,
            borderColor: "#60a5fa",
            borderWidth: 1.5,
            shadowColor: "rgba(96,165,250,0.55)",
            shadowBlur: 22,
          },
          label: {
            color: "rgba(255,255,255,0.92)",
            fontWeight: "bold",
          },
        },

        regions: highlighted.map((name) => ({
          name,
          itemStyle: {
            areaColor: MAP_AREA_HL,
            borderColor: "#38bdf8",
            borderWidth: 2,
            shadowColor: "rgba(56,189,248,0.55)",
            shadowBlur: 24,
          },
          label: {
            show: true,
            color: "rgba(255,255,255,0.92)",
            fontWeight: "bold",
          },
        })),
      },

      series: branchPoints.length
        ? [
            {
              type: "scatter",
              coordinateSystem: "geo",
              symbolSize: 22,
              itemStyle: {
                color: "rgba(56,189,248,0.18)",
                borderColor: "rgba(56,189,248,0.55)",
                borderWidth: 1.4,
              },
              data: branchPoints,
              tooltip: { show: false },
              silent: true,
              zlevel: 2,
            },
            {
              name: "分公司",
              type: "effectScatter",
              coordinateSystem: "geo",
              zlevel: 3,
              rippleEffect: { scale: 4.0, brushType: "stroke" },
              symbolSize: 13,
              itemStyle: {
                color: "#38bdf8",
                shadowBlur: 20,
                shadowColor: "rgba(56,189,248,0.85)",
              },
              label: {
                show: true,
                formatter: "{b}",
                position: "right",
                fontSize: 13,
                fontWeight: "bold",
                color: "#0b2b5a",
                backgroundColor: "rgba(255,255,255,0.92)",
                padding: [4, 8],
                borderRadius: 8,
                borderColor: "rgba(147,197,253,0.9)",
                borderWidth: 1,
              },
              data: branchPoints,
            },
          ]
        : [],
    };
  }, [selectedProvince, selectedCenter]);

  // ✅ 点击事件：点分公司点位 -> 打开弹窗；点空白/省份 -> 关闭
  const onChartEvents = useMemo(() => {
    return {
      click: (params: any) => {
        if (params?.seriesType === "effectScatter") {
          const name = params?.name;
          const b = BRANCHES.find((x) => x.name === name) || null;
          setSelectedBranch(b);
          return;
        }
        setSelectedBranch(null);
      },
    };
  }, []);

  const statusColor = (s?: BranchStatus) => {
    if (s === "告警") return "#dc2626";
    if (s === "离线") return "#f59e0b";
    return "#16a34a";
  };

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <div style={styles.title}>公司安全监控系统</div>
        <div style={styles.headerRight}>
          <div style={styles.pill}>10°C</div>
          <div style={styles.pill}>2026/01/04</div>
          <div style={styles.pill}>15:05:09</div>
        </div>
      </div>

      <div style={styles.cardsRow3}>
        <div style={styles.card}>
          <div style={styles.cardLabel}>电子围栏数量</div>
          <div style={styles.cardValue}>{summary.fenceCount}</div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardLabel}>报警数量（今日）</div>
          <div style={styles.cardValueRed}>{summary.alarmCount}</div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardLabel}>设备数量</div>
          <div style={styles.cardValueBlue}>{summary.deviceCount}</div>
        </div>
      </div>

      <div style={styles.middleRow}>
        <div style={styles.mapCard}>
          <div style={styles.mapTitle}>全国分公司部署地图（拖拽/滚轮缩放）</div>

          <div style={styles.mapWrap}>
            <ReactECharts
              option={mapOption}
              style={{ width: "100%", height: "100%" }}
              notMerge
              lazyUpdate
              onEvents={onChartEvents}
            />

            {/* ✅ 点击分公司点位：弹窗 */}
            {selectedBranch && (
              <div style={styles.popup}>
                <div style={styles.popupHeader}>
                  <div style={styles.popupTitle}>{selectedBranch.name}</div>
                  <button
                    style={styles.popupClose}
                    onClick={() => setSelectedBranch(null)}
                    aria-label="close"
                  >
                    ×
                  </button>
                </div>

                <div style={styles.popupBody}>
                  <div style={styles.popupRow}>
                    <span style={styles.popupLabel}>省份：</span>
                    <span style={styles.popupValue}>{selectedBranch.province}</span>
                  </div>

                  <div style={styles.popupRow}>
                    <span style={styles.popupLabel}>地址：</span>
                    <span style={styles.popupValue}>
                      {selectedBranch.address?.trim() || "—"}
                    </span>
                  </div>

                  <div style={styles.popupRow}>
                    <span style={styles.popupLabel}>坐标：</span>
                    <span style={styles.popupValue}>
                      {selectedBranch.coord
                        ? `${selectedBranch.coord[0].toFixed(4)}, ${selectedBranch.coord[1].toFixed(
                            4
                          )}`
                        : "—"}
                    </span>
                  </div>

                  {/* ✅ 新增信息 */}
                  {selectedBranch.project && (
                    <div style={styles.popupRow}>
                      <span style={styles.popupLabel}>项目：</span>
                      <span style={styles.popupValue}>{selectedBranch.project}</span>
                    </div>
                  )}

                  {selectedBranch.manager && (
                    <div style={styles.popupRow}>
                      <span style={styles.popupLabel}>负责人：</span>
                      <span style={styles.popupValue}>{selectedBranch.manager}</span>
                    </div>
                  )}

                  {selectedBranch.phone && (
                    <div style={styles.popupRow}>
                      <span style={styles.popupLabel}>电话：</span>
                      <span style={styles.popupValue}>{selectedBranch.phone}</span>
                    </div>
                  )}

                  {typeof selectedBranch.deviceCount === "number" && (
                    <div style={styles.popupRow}>
                      <span style={styles.popupLabel}>设备数：</span>
                      <span style={styles.popupValue}>{selectedBranch.deviceCount} 台</span>
                    </div>
                  )}

                  {selectedBranch.status && (
                    <div style={styles.popupRow}>
                      <span style={styles.popupLabel}>状态：</span>
                      <span
                        style={{
                          ...styles.popupValue,
                          fontWeight: 800,
                          color: statusColor(selectedBranch.status),
                        }}
                      >
                        {selectedBranch.status}
                      </span>
                    </div>
                  )}

                  {selectedBranch.updatedAt && (
                    <div style={styles.popupRow}>
                      <span style={styles.popupLabel}>更新时间：</span>
                      <span style={styles.popupValue}>{selectedBranch.updatedAt}</span>
                    </div>
                  )}

                  {selectedBranch.remark && (
                    <div style={styles.popupRow}>
                      <span style={styles.popupLabel}>备注：</span>
                      <span style={styles.popupValue}>{selectedBranch.remark}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 18,
    background: "#f5f7fb",
    minHeight: "100vh",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  title: { fontSize: 22, fontWeight: 800, color: "#1e3a8a" },
  headerRight: { display: "flex", gap: 8 },
  pill: {
    background: "#fff",
    border: "1px solid #e6eef9",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 12,
    color: "#334155",
  },

  cardsRow3: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
    marginBottom: 12,
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #e6eef9",
    padding: 14,
  },
  cardLabel: { fontSize: 13, color: "#64748b", marginBottom: 8 },
  cardValue: { fontSize: 28, fontWeight: 800, color: "#0f172a" },
  cardValueBlue: { fontSize: 28, fontWeight: 800, color: "#2563eb" },
  cardValueRed: { fontSize: 28, fontWeight: 800, color: "#dc2626" },

  middleRow: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
    flex: 1,
    minHeight: 0,
  },

  mapCard: {
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #e6eef9",
    padding: 14,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
  },
  mapTitle: { fontSize: 14, fontWeight: 800, color: "#0f172a" },

  // ✅ 必须 relative，弹窗才好定位
  mapWrap: { flex: 1, marginTop: 10, minHeight: 0, position: "relative" },

  // ✅ 弹窗
  popup: {
    position: "absolute",
    right: 16,
    top: 16,
    width: 340,
    background: "rgba(255,255,255,0.96)",
    border: "1px solid #e6eef9",
    borderRadius: 12,
    boxShadow: "0 12px 30px rgba(15,23,42,0.12)",
    overflow: "hidden",
    zIndex: 10,
  },
  popupHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px",
    borderBottom: "1px solid #eef2ff",
    background: "linear-gradient(180deg, rgba(59,130,246,0.10), rgba(255,255,255,0))",
  },
  popupTitle: { fontSize: 14, fontWeight: 800, color: "#0f172a" },
  popupClose: {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: "1px solid #e6eef9",
    background: "#fff",
    cursor: "pointer",
    fontSize: 18,
    lineHeight: "24px",
    color: "#334155",
  },
  popupBody: { padding: 12 },
  popupRow: { display: "flex", gap: 8, marginBottom: 8 },
  popupLabel: { width: 66, color: "#64748b", fontSize: 12, flex: "0 0 auto" },
  popupValue: { color: "#0f172a", fontSize: 12, lineHeight: 1.5 },
};
