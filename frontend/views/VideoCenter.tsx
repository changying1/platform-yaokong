import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Trash2,
  MonitorPlay,
  Maximize2,
  X,
  Camera,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Grid3x3,
  Grid2x2,
  LayoutGrid,
  Loader,
  Settings,
  Edit2,
  // --- ✅ 新增图标（已合并，无重复）---
  Shield,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import VideoPlayer from "../src/components/VideoPlayer";
import PTZControlPanel from "../src/components/PTZControlPanel";
import {
  getAllVideos,
  deleteVideo,
  getVideoStreamUrl,
  addCameraViaRTSP,
  updateVideo,
  ptzControl,
  Video,
  VideoCreate,
  VideoUpdate,
  // --- ✅ 新增 API（已合并，无重复）---
  startAIMonitoring,
  stopAIMonitoring,
} from "../src/api/videoApi";

export default function VideoCenter() {
  // --- 状态管理 ---
  // const [algoType, setAlgoType] = useState("helmet");
  const [activeAlgos, setActiveAlgos] = useState<string[]>([]); 
  const algos = [
    { id: "helmet", name: "安全帽检测", icon: "⛑️" },
    { id: "off_post", name: "离岗检测", icon: "🏃" },
    { id: "hole_curb", name: "孔口挡坎检测", icon: "🕳️" },
    { id: "signage", name: "安全标识检测", icon: "⚠️" },];
  const [devices, setDevices] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [maximizedVideo, setMaximizedVideo] = useState<Video | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  
  // --- ✅ 新增 AI 监控状态 ---
  const [isAIEnabled, setIsAIEnabled] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // --- 分页与网格状态 ---
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(9);
  const [gridInputValue, setGridInputValue] = useState("9");
  const [previewStreams, setPreviewStreams] = useState<Record<number, string>>({});
  const [previewLoading, setPreviewLoading] = useState<Record<number, boolean>>({});
  const [previewErrors, setPreviewErrors] = useState<Record<number, string>>({});

  // --- 弹窗与表单状态 ---
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Video | null>(null);
  const [editingDevice, setEditingDevice] = useState<Video | null>(null);

  const [newDeviceForm, setNewDeviceForm] = useState<VideoCreate>({
    name: "",
    ip_address: "",
    port: 80,
    username: "",
    password: "",
    stream_url: "",
    status: "offline",
    remark: "",
  });

  const [editDeviceForm, setEditDeviceForm] = useState<VideoUpdate>({
    name: "",
    ip_address: "",
    port: 80,
    username: "",
    password: "",
    stream_url: "",
    status: "offline",
    remark: "",
  });

  // --- ✅ 新增：切换摄像头时重置 AI 状态 ---
  useEffect(() => {
    setIsAIEnabled(false);
  }, [maximizedVideo]);

  // --- ✅ 改进：AI 开关处理逻辑 ---

  // 1. 处理单个功能的开启/关闭
  const handleSingleAI = async (type: string) => {
    if (!maximizedVideo) return;
    setAiLoading(true);
    try {
      if (activeAlgos.includes(type)) {
        // --- 修改开始：更安全的关闭逻辑 ---
        
        // 1. 算出关闭当前功能后，还剩哪些功能
        const remainingAlgos = activeAlgos.filter(t => t !== type);

        // 2. 停止该设备目前的所有 AI 任务
        await stopAIMonitoring(String(maximizedVideo.id));

        // 3. 循环重新启动剩下的那些功能
        for (const algo of remainingAlgos) {
           await startAIMonitoring(
             String(maximizedVideo.id), 
             maximizedVideo.stream_url || maximizedVideo.rtsp_url || "", 
             algo
           );
        }

        // 4. 更新前端状态
        setActiveAlgos(remainingAlgos);
        
        // --- 修改结束 ---
      } else {
        // 如果未开启，则启动
        await startAIMonitoring(
          String(maximizedVideo.id), 
          maximizedVideo.stream_url || maximizedVideo.rtsp_url || "", 
          type 
        );
        setActiveAlgos(prev => [...prev, type]);
      }
    } catch (error) {
      console.error(`${type} 操作失败:`, error);
      alert("AI 服务同步失败");
    } finally {
      setAiLoading(false);
    }
  };

  // 2. 处理一键全开启/全关闭
  const handleToggleAll = async (enable: boolean) => {
    if (!maximizedVideo) return;
    setAiLoading(true);
    try {
      if (enable) {
        // 循环开启所有未开启的功能
        for (const algo of algos) {
          if (!activeAlgos.includes(algo.id)) {
            await startAIMonitoring(
              String(maximizedVideo.id), 
              maximizedVideo.stream_url || maximizedVideo.rtsp_url || "", 
              algo.id
            );
          }
        }
        setActiveAlgos(algos.map(a => a.id));
      } else {
        // 一键关闭该设备所有 AI
        await stopAIMonitoring(String(maximizedVideo.id));
        setActiveAlgos([]);
      }
    } catch (error) {
      alert("批量操作失败");
    } finally {
      setAiLoading(false);
    }
  };

  // --- 初始化加载 ---
  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const data = await getAllVideos();
      setDevices(data);
      setError(null);
    } catch (e: any) {
      setError("无法加载设备。请确认后端服务已启动。");
    } finally {
      setLoading(false);
    }
  };

  // --- 逻辑处理 ---
  const handleSearch = (val: string) => {
    setSearchTerm(val);
    setCurrentPage(1);
  };

  const filteredDevices = devices.filter(
    (h) =>
      h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(h.id).includes(searchTerm)
  );

  const totalPages = Math.ceil(filteredDevices.length / itemsPerPage) || 1;
  const currentVideos = filteredDevices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleShowStream = async (device: Video) => {
    try {
      let url = previewStreams[device.id];
      if (!url) {
        const data = await getVideoStreamUrl(device.id);
        url = data.url;
        setPreviewStreams((prev) => ({ ...prev, [device.id]: url }));
      }
      setStreamUrl(url);
      setMaximizedVideo(device);
    } catch (err: any) {
      alert(`获取视频流失败: ${err.message}`);
    }
  };

  const loadPreviewStream = useCallback(
    async (device: Video) => {
      if (!device || previewStreams[device.id] || previewLoading[device.id]) {
        return;
      }
      setPreviewLoading((prev) => ({ ...prev, [device.id]: true }));
      try {
        const data = await getVideoStreamUrl(device.id);
        setPreviewStreams((prev) => ({ ...prev, [device.id]: data.url }));
        setPreviewErrors((prev) => ({ ...prev, [device.id]: "" }));
      } catch (err: any) {
        setPreviewErrors((prev) => ({
          ...prev,
          [device.id]: err?.message || "加载失败",
        }));
      } finally {
        setPreviewLoading((prev) => ({ ...prev, [device.id]: false }));
      }
    },
    [previewLoading, previewStreams]
  );

  useEffect(() => {
    currentVideos.forEach((device) => {
      if (device) {
        loadPreviewStream(device);
      }
    });
  }, [currentVideos, loadPreviewStream]);

  const handleGridInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setGridInputValue(value);

    if (value === "") return;

    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 1 && num <= 100) {
      setItemsPerPage(num);
      setCurrentPage(1);
    }
  };

  const handleVideoDoubleClick = async (device: Video) => {
    await handleShowStream(device);
  };

  const handleAddDevice = async () => {
    if (!newDeviceForm.name || !newDeviceForm.stream_url) {
      alert("请填写必填字段：设备名称和流地址");
      return;
    }

    const payload = {
      name: newDeviceForm.name,
      rtsp_url: newDeviceForm.stream_url,
      ip_address: newDeviceForm.ip_address || undefined,
      port: newDeviceForm.port,
      username: newDeviceForm.username,
      password: newDeviceForm.password,
      remark: newDeviceForm.remark,
    };

    try {
      const newDevice = await addCameraViaRTSP(payload);
      setDevices([newDevice, ...devices]);
      setShowAddModal(false);
      setNewDeviceForm({
        name: "",
        ip_address: "",
        port: 80,
        username: "",
        password: "",
        stream_url: "",
        status: "offline",
        remark: "",
      });
    } catch (err: any) {
      console.error("添加失败详情:", err);
      const errorMsg = err.message || JSON.stringify(err);
      alert(`添加失败: ${errorMsg}`);
    }
  };

  const handleEditClick = (device: Video, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDevice(device);
    setEditDeviceForm({
      name: device.name,
      ip_address: device.ip_address,
      port: device.port,
      username: device.username || "",
      password: device.password || "",
      stream_url: device.stream_url || "",
      status: device.status,
      remark: device.remark || "",
    });
    setShowEditModal(true);
  };

  const handleUpdateDevice = async () => {
    if (!editingDevice) return;
    if (!editDeviceForm.name || !editDeviceForm.stream_url) {
      alert("请填写必填字段：设备名称和流地址");
      return;
    }

    try {
      const updatedDevice = await updateVideo(editingDevice.id, editDeviceForm);
      setDevices(
        devices.map((d) => (d.id === editingDevice.id ? updatedDevice : d))
      );
      setShowEditModal(false);
      setEditingDevice(null);
    } catch (err: any) {
      alert(`更新失败: ${err.message}`);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`确定删除设备 ID: ${id} 吗？`)) {
      try {
        await deleteVideo(id);
        setDevices((prev) => prev.filter((d) => d.id !== id));
      } catch (err: any) {
        alert(`删除失败: ${err.message}`);
      }
    }
  };

  const cols = Math.ceil(Math.sqrt(itemsPerPage));

  if (loading)
    return (
      <div className="h-full flex items-center justify-center text-blue-500">
        <Loader className="animate-spin" size={48} />
      </div>
    );

  return (
    <div className="h-full flex gap-4 p-4 bg-gradient-to-br from-white via-gray-50 to-gray-100 text-gray-900">
      {/* 左侧列表 */}
      <div className="w-80 flex flex-col gap-3 bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <h3 className="font-bold flex items-center gap-2 text-gray-900">
            <MonitorPlay size={18} className="text-blue-600" /> 设备管理
          </h3>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded text-xs flex items-center gap-1 shadow-md"
          >
            <Plus size={14} />
            新增
          </button>
        </div>
        <input
          type="text"
          placeholder="搜索设备..."
          className="bg-gray-50 border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 text-gray-900 placeholder-gray-500"
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
        />
        <div className="flex-1 overflow-y-auto space-y-2">
          {filteredDevices.map((device) => (
            <div
              key={device.id}
              onClick={() => setSelectedDevice(device)}
              className={`p-3 rounded border cursor-pointer transition-all flex justify-between items-center ${
                selectedDevice?.id === device.id
                  ? "border-blue-500 bg-blue-50 shadow-sm"
                  : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50"
              }`}
            >
              <div className="overflow-hidden">
                <p className="text-sm font-medium truncate text-gray-900">
                  {device.name}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-gray-600 font-mono">
                  <span>
                    {device.ip_address}:{device.port}
                  </span>
                  {device.remark && (
                    <span className="bg-gray-200 px-1 rounded truncate max-w-[80px]">
                      {device.remark}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={(e) => handleEditClick(device, e)}
                  className="text-gray-400 hover:text-blue-500 transition-colors"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={(e) => handleDelete(device.id, e)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧网格 */}
      <div className="flex-1 flex flex-col gap-4">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gap: "1rem",
          }}
          className="flex-1"
        >
          {Array.from({ length: itemsPerPage }).map((_, i) => {
            const device = currentVideos[i];
            return (
              <div
                key={`${device?.id ?? "slot"}-${i}`}
                className="bg-white rounded border border-gray-200 relative group overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                {device ? (
                  <>
                    <div
                      className="relative w-full pt-[56.25%] bg-black"
                      onDoubleClick={() => handleVideoDoubleClick(device)}
                    >
                      <div className="absolute inset-0">
                        {previewStreams[device.id] ? (
                          <VideoPlayer
                            key={previewStreams[device.id]}
                            src={previewStreams[device.id]}
                          />
                        ) : previewLoading[device.id] ? (
                          <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm">
                            正在加载预览...
                          </div>
                        ) : previewErrors[device.id] ? (
                          <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-xs text-red-500">
                            <span>{previewErrors[device.id]}</span>
                            <button
                              className="px-3 py-1 bg-red-500 text-white rounded"
                              onClick={(e) => {
                                e.stopPropagation();
                                loadPreviewStream(device);
                              }}
                            >
                              重试
                            </button>
                          </div>
                        ) : (
                          <button
                            className="h-full w-full flex items-center justify-center text-gray-300 text-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              loadPreviewStream(device);
                            }}
                          >
                            点击加载预览
                          </button>
                        )}
                      </div>
                    </div>
                    {/* 状态指示器 */}
                    <div className="absolute top-2 left-2 flex items-center gap-2 z-10">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          device.status === "online"
                            ? "bg-green-500 animate-pulse"
                            : "bg-gray-400"
                        }`}
                      />
                      <span className="text-xs bg-white/80 backdrop-blur px-2 py-0.5 rounded text-gray-900 border border-gray-200 shadow-sm">
                        {device.name}
                      </span>
                    </div>
                    {/* 悬浮操作栏 */}
                    <div className="absolute bottom-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button
                        onClick={() => handleShowStream(device)}
                        className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded text-white shadow-lg transition-all"
                        title="全屏播放"
                      >
                        <Maximize2 size={14} />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-200">
                    <Plus size={32} opacity={0.2} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {/* 分页控制 */}
        <div className="h-12 bg-white border border-gray-200 rounded-lg flex items-center justify-between px-4 shadow-sm">
          <div className="text-xs text-gray-600">
            共 {filteredDevices.length} 个设备
          </div>
          <div className="flex gap-3 items-center">
            <label className="text-xs text-gray-600 font-medium">布局：</label>
            <input
              type="number"
              min="1"
              max="100"
              value={gridInputValue}
              onChange={handleGridInputChange}
              className="w-16 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-50 text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
              placeholder="1-100"
            />
            <span className="text-xs text-gray-500">屏</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="p-1 disabled:opacity-30 hover:bg-gray-100 rounded transition-colors text-gray-600"
            >
              <ChevronLeft />
            </button>
            <span className="text-xs font-mono w-10 text-center text-gray-700">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="p-1 disabled:opacity-30 hover:bg-gray-100 rounded transition-colors text-gray-600"
            >
              <ChevronRight />
            </button>
          </div>
        </div>
      </div>

      {/* 添加设备弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white border border-gray-200 rounded-lg w-[500px] p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900">
                <Settings size={18} className="text-blue-600" /> 添加监控设备
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            {/* 表单内容 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  设备名称 <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full bg-gray-50 border border-gray-300 rounded p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-100 outline-none text-gray-900"
                  value={newDeviceForm.name}
                  onChange={(e) =>
                    setNewDeviceForm({ ...newDeviceForm, name: e.target.value })
                  }
                  placeholder="例如：北门入口摄像头"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">IP 地址</label>
                <input
                  className="w-full bg-gray-50 border border-gray-300 rounded p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-100 outline-none text-gray-900"
                  value={newDeviceForm.ip_address}
                  onChange={(e) =>
                    setNewDeviceForm({ ...newDeviceForm, ip_address: e.target.value })
                  }
                  placeholder="192.168.1.100"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">端口</label>
                <input
                  type="number"
                  className="w-full bg-gray-50 border border-gray-300 rounded p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-100 outline-none text-gray-900"
                  value={newDeviceForm.port}
                  onChange={(e) =>
                    setNewDeviceForm({ ...newDeviceForm, port: parseInt(e.target.value) || 80 })
                  }
                  placeholder="80"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">用户名</label>
                <input
                  className="w-full bg-gray-50 border border-gray-300 rounded p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-100 outline-none text-gray-900"
                  value={newDeviceForm.username || ""}
                  onChange={(e) =>
                    setNewDeviceForm({ ...newDeviceForm, username: e.target.value })
                  }
                  placeholder="请输入登录账号"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">密码</label>
                <input
                  type="password"
                  className="w-full bg-gray-50 border border-gray-300 rounded p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-100 outline-none text-gray-900"
                  value={newDeviceForm.password || ""}
                  onChange={(e) =>
                    setNewDeviceForm({ ...newDeviceForm, password: e.target.value })
                  }
                  placeholder="******"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  流地址（RTSP/HLS）
                </label>
                <input
                  className="w-full bg-gray-50 border border-gray-300 rounded p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-100 outline-none text-gray-900"
                  value={newDeviceForm.stream_url || ""}
                  onChange={(e) =>
                    setNewDeviceForm({ ...newDeviceForm, stream_url: e.target.value })
                  }
                  placeholder="示例：rtsp://账号:密码@192.168.1.100:554/..."
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-700 block mb-1">备注</label>
                <input
                  className="w-full bg-gray-50 border border-gray-300 rounded p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-100 outline-none text-gray-900"
                  value={newDeviceForm.remark || ""}
                  onChange={(e) =>
                    setNewDeviceForm({ ...newDeviceForm, remark: e.target.value })
                  }
                  placeholder="位置描述或其他信息"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button
                onClick={handleAddDevice}
                className="flex-1 bg-blue-600 hover:bg-blue-500 py-2 rounded text-sm font-bold text-white transition-colors shadow-md"
              >
                保存配置
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 py-2 rounded text-sm text-gray-700 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑设备弹窗 */}
      {showEditModal && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white border border-gray-200 rounded-lg w-[500px] p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900">
                <Settings size={18} className="text-blue-600" /> 编辑监控设备
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            {/* 表单内容 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  设备名称 <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full bg-gray-50 border border-gray-300 rounded p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-100 outline-none text-gray-900"
                  value={editDeviceForm.name}
                  onChange={(e) =>
                    setEditDeviceForm({ ...editDeviceForm, name: e.target.value })
                  }
                  placeholder="例如：北门入口摄像头"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">IP 地址</label>
                <input
                  className="w-full bg-gray-50 border border-gray-300 rounded p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-100 outline-none text-gray-900"
                  value={editDeviceForm.ip_address}
                  onChange={(e) =>
                    setEditDeviceForm({ ...editDeviceForm, ip_address: e.target.value })
                  }
                  placeholder="192.168.1.100"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">端口</label>
                <input
                  type="number"
                  className="w-full bg-gray-50 border border-gray-300 rounded p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-100 outline-none text-gray-900"
                  value={editDeviceForm.port}
                  onChange={(e) =>
                    setEditDeviceForm({ ...editDeviceForm, port: parseInt(e.target.value) || 80 })
                  }
                  placeholder="80"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">用户名</label>
                <input
                  className="w-full bg-gray-50 border border-gray-300 rounded p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-100 outline-none text-gray-900"
                  value={editDeviceForm.username || ""}
                  onChange={(e) =>
                    setEditDeviceForm({ ...editDeviceForm, username: e.target.value })
                  }
                  placeholder="请输入登录账号"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">密码</label>
                <input
                  type="password"
                  className="w-full bg-gray-50 border border-gray-300 rounded p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-100 outline-none text-gray-900"
                  value={editDeviceForm.password || ""}
                  onChange={(e) =>
                    setEditDeviceForm({ ...editDeviceForm, password: e.target.value })
                  }
                  placeholder="******"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  流地址（RTSP/HLS）
                </label>
                <input
                  className="w-full bg-gray-50 border border-gray-300 rounded p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-100 outline-none text-gray-900"
                  value={editDeviceForm.stream_url || ""}
                  onChange={(e) =>
                    setEditDeviceForm({ ...editDeviceForm, stream_url: e.target.value })
                  }
                  placeholder="示例：rtsp://账号:密码@192.168.1.100:554/..."
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-700 block mb-1">备注</label>
                <input
                  className="w-full bg-gray-50 border border-gray-300 rounded p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-100 outline-none text-gray-900"
                  value={editDeviceForm.remark || ""}
                  onChange={(e) =>
                    setEditDeviceForm({ ...editDeviceForm, remark: e.target.value })
                  }
                  placeholder="位置描述或其他信息"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button
                onClick={handleUpdateDevice}
                className="flex-1 bg-blue-600 hover:bg-blue-500 py-2 rounded text-sm font-bold text-white transition-colors shadow-md"
              >
                更新配置
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 py-2 rounded text-sm text-gray-700 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 播放弹窗 (包含 AI 侧边栏) */}
      {maximizedVideo && (
        <div className="fixed inset-0 z-[200] bg-white flex flex-col p-4 gap-4">
          {/* Header */}
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-3 text-gray-900">
              {maximizedVideo.name}
              <span className="text-sm font-mono font-normal text-gray-600 bg-gray-100 px-2 rounded border border-gray-300">
                {maximizedVideo.ip_address}
              </span>
            </h2>
            <button
              onClick={() => {
                setMaximizedVideo(null);
                setStreamUrl(null);
              }}
              className="p-2 text-gray-500 hover:bg-red-100 hover:text-red-600 rounded-full transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex gap-4 min-h-0">
            {/* Video Section */}
            <div className="flex-1 flex flex-col bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
              {streamUrl ? (
                <>
                  <div className="p-3 bg-blue-50 border-b border-blue-200 text-sm text-blue-800">
                    <div className="flex items-center gap-2 font-semibold">
                      <MonitorPlay size={18} /> 流信息
                    </div>
                    <code className="mt-2 block text-xs bg-white p-2 rounded border border-gray-300 break-all text-gray-800 max-h-20 overflow-auto">
                      {streamUrl}
                    </code>
                  </div>
                  <div className="flex-1 flex items-center justify-center bg-black relative min-h-0">
                    <VideoPlayer src={streamUrl} />
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center flex-1">
                  <Loader className="animate-spin text-blue-500" size={48} />
                </div>
              )}
            </div>

            {/* Right Sidebar: AI Control + PTZ */}
            {streamUrl && (
              <div className="w-80 flex flex-col gap-3 h-full">
                
                {/* ✅ 新增：AI 智脑控制中心 (下拉菜单版) */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-lg shrink-0">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <Shield size={18} className="text-blue-600" />
                      AI 智脑控制
                    </h3>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleToggleAll(true)}
                        className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                      >全开启</button>
                      <button 
                        onClick={() => handleToggleAll(false)}
                        className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded hover:bg-red-100 transition-colors"
                      >全关闭</button>
                    </div>
                  </div>

                  {/* 下拉选择菜单 */}
                  <div className="relative mb-4">
                    <select 
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-md text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                      value=""
                      onChange={(e) => handleSingleAI(e.target.value)}
                      disabled={aiLoading}
                    >
                      <option value="" disabled>＋ 添加/切换算法功能</option>
                      {algos.map(algo => (
                        <option key={algo.id} value={algo.id}>
                          {activeAlgos.includes(algo.id) ? "✅ 已开启：" : "⭕ 未开启："} {algo.name}
                        </option>
                      ))}
                    </select>
                    {/* 自定义下拉箭头图标 */}
                    <div className="absolute right-3 top-3.5 pointer-events-none text-gray-400">
                      <Settings size={14} />
                    </div>
                  </div>

                  {/* 已开启功能状态标签 */}
                  <div className="flex flex-wrap gap-2 min-h-[24px]">
                    {activeAlgos.length === 0 ? (
                      <span className="text-[11px] text-gray-400 italic flex items-center gap-1">
                        <AlertCircle size={12} /> 暂无监测任务运行
                      </span>
                    ) : (
                      activeAlgos.map(id => {
                        const algo = algos.find(a => a.id === id);
                        return (
                          <div key={id} className="flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 px-2 py-1 rounded text-[11px] animate-pulse">
                            <ShieldCheck size={12} />
                            {algo?.name}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* 加载状态提示 */}
                  {aiLoading && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-center gap-2 text-[11px] text-blue-500">
                      <Loader size={12} className="animate-spin" /> 正在同步云端算法状态...
                    </div>
                  )}
                </div>

                {/* PTZ Control Panel */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-y-auto shadow-lg flex-1">
                  <PTZControlPanel
                    video={maximizedVideo}
                    onSuccess={(msg) => console.log(msg)}
                    onError={(err) => console.error(err)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}