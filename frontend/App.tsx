import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Video,
  MapPin,
  ShieldAlert,
  Users,
  Bell,
  Settings,
  Menu,
  ChevronDown,
  Search,
  User,
  Power,
  Sun,
  Cloud,
  CloudRain,
  Snowflake,
  Lock,
  KeyRound,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { MenuKey } from "./types";
import Dashboard from "./views/Dashboard";
import FenceManagement from "./views/Fence/index";
import VideoCenter from "./views/VideoCenter";
import TrackPlayback from "./views/TrackPlayback";
import SettingsView from "./views/SettingsView";
import GroupCall from "./views/GroupCall";
import AlarmRecords from "./views/Alarm/index";
import DeviceManagement from "./views/Device/index";

// --- Login Component ---
const LoginView = ({ onLogin }: { onLogin: () => void }) => {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API delay
    setTimeout(() => {
      setLoading(false);
      onLogin();
    }, 800);
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="relative z-10 w-[450px] bg-white p-8 rounded-2xl shadow-xl animate-in fade-in zoom-in duration-500 border border-gray-200">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 tracking-wider mb-2">
            公司安全监控系统
          </h1>

          <p className="text-gray-500 text-sm">现场安全监控</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-600 tracking-wider ml-1">
              账户
            </label>
            <div className="relative group">
              <User
                className="absolute left-3 top-3 text-gray-400 group-focus-within:text-blue-500 transition-colors"
                size={20}
              />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg py-3 pl-10 pr-4 text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                placeholder="请输入账号"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-600 tracking-wider ml-1">
              密码
            </label>
            <div className="relative group">
              <KeyRound
                className="absolute left-3 top-3 text-gray-400 group-focus-within:text-blue-500 transition-colors"
                size={20}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg py-3 pl-10 pr-4 text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                placeholder="请输入密码"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-blue-500/50 transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                登录系统 <span className="text-xl">→</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
          © 2024 智能安全系统 V2.0
        </div>
      </div>
    </div>
  );
};

// --- Sidebar Component ---
const Sidebar = ({
  activeMenu,
  setActiveMenu,
}: {
  activeMenu: MenuKey;
  setActiveMenu: (key: MenuKey) => void;
}) => {
  const menuItems = [
    { key: MenuKey.DASHBOARD, label: "现场管理", icon: LayoutDashboard },
    { key: MenuKey.VIDEO, label: "视频中心", icon: Video },
    { key: MenuKey.TRACK, label: "轨迹回放", icon: MapPin },
    { key: MenuKey.DEVICE, label: "设备管理", icon: LayoutDashboard },
    { key: MenuKey.FENCE, label: "电子围栏", icon: ShieldAlert },
    { key: MenuKey.GROUP_CALL, label: "群组通话", icon: Users },
    { key: MenuKey.ALARM, label: "报警记录", icon: Bell },
    { key: MenuKey.SETTINGS, label: "管理员设置", icon: Settings },
  ];

  return (
    <div className="w-64 h-full bg-white border-r border-gray-200 flex flex-col relative z-20">
      <div className="p-4 flex items-center justify-center border-b border-gray-200"></div>
      <nav className="flex-1 overflow-y-auto py-4">
        {menuItems.map((item) => (
          <button
            key={item.key}
            onClick={() => setActiveMenu(item.key)}
            className={`w-full flex items-center gap-3 px-6 py-4 text-sm transition-all duration-200 border-l-4
              ${
                activeMenu === item.key
                  ? "text-blue-600 bg-blue-50 border-blue-600 font-semibold"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50 border-transparent"
              }`}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="p-4 text-xs text-gray-400 text-center border-t border-gray-200">
        现场安全系统 V2.0
      </div>
    </div>
  );
};

// --- Header Component ---
const Header = ({ onLogout }: { onLogout: () => void }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(
    null
  );
  const [isLoadingWeather, setIsLoadingWeather] = useState(true);

  useEffect(() => {
    // Clock Timer
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Weather Fetcher (Open-Meteo API)
    // Coordinates: Shanghai (31.2304, 121.4737)
    const fetchWeather = async () => {
      try {
        setIsLoadingWeather(true);
        const res = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=31.2304&longitude=121.4737&current=temperature_2m,weather_code&timezone=Asia%2FShanghai"
        );
        const data = await res.json();

        if (data.current) {
          setWeather({
            temp: Math.round(data.current.temperature_2m),
            code: data.current.weather_code,
          });
        }
      } catch (error) {
        console.error("Failed to fetch weather data:", error);
      } finally {
        setIsLoadingWeather(false);
      }
    };

    fetchWeather();
    // Refresh weather every 15 minutes
    const weatherTimer = setInterval(fetchWeather, 15 * 60 * 1000);

    return () => {
      clearInterval(timer);
      clearInterval(weatherTimer);
    };
  }, []);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
  };

  const getWeatherIcon = (code: number) => {
    // WMO Weather interpretation codes
    if (code === 0 || code === 1)
      return <Sun size={16} className="text-yellow-500" />;
    if (code >= 2 && code <= 3)
      return <Cloud size={16} className="text-slate-400" />;
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82))
      return <CloudRain size={16} className="text-blue-400" />;
    if (code >= 71 && code <= 77)
      return <Snowflake size={16} className="text-cyan-200" />;
    // Default fallback
    return <Cloud size={16} className="text-slate-400" />;
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 relative z-20 shadow-sm">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-700 tracking-widest uppercase">
          公司安全监控系统
        </h1>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4 text-gray-600 text-sm font-mono bg-gray-100 px-4 py-1.5 rounded-full border border-gray-200">
          <div className="flex items-center gap-2 min-w-[60px] justify-center">
            {isLoadingWeather ? (
              <Loader2 size={14} className="animate-spin text-gray-400" />
            ) : weather ? (
              <>
                {getWeatherIcon(weather.code)}
                <span>{weather.temp}°C</span>
              </>
            ) : (
              <span className="text-xs text-gray-400">无数据</span>
            )}
          </div>
          <span className="text-gray-300">|</span>
          <span>{formatDate(currentTime)}</span>
          <span className="text-blue-600 font-bold w-20 text-center">
            {formatTime(currentTime)}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Bell
              size={20}
              className="text-gray-500 hover:text-blue-600 cursor-pointer"
            />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
          </div>

          <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2 rounded-lg transition-colors group">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center border border-blue-500/50 group-hover:border-blue-500">
              <User size={16} className="text-blue-600" />
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs text-gray-800">管理员</span>
              <span className="text-[10px] text-gray-500">系统管理员</span>
            </div>
            <ChevronDown size={14} className="text-gray-400" />
          </div>

          <button
            onClick={onLogout}
            className="text-gray-500 hover:text-red-500 transition-colors"
            title="退出登录"
          >
            <Power size={20} />
          </button>
        </div>
      </div>
    </header>
  );
};

// --- Main App Component ---
export default function App() {
  const [activeMenu, setActiveMenu] = useState<MenuKey>(MenuKey.FENCE);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Simple animation or loading effect could go here
  if (!isLoggedIn) {
    return <LoginView onLogin={() => setIsLoggedIn(true)} />;
  }

  const renderContent = () => {
    switch (activeMenu) {
      case MenuKey.DASHBOARD:
        return <Dashboard />;
      case MenuKey.VIDEO:
        return <VideoCenter />;
      case MenuKey.FENCE:
        return <FenceManagement />;
      case MenuKey.DEVICE:
        return <DeviceManagement />;
      case MenuKey.TRACK:
        return <TrackPlayback />;
      case MenuKey.SETTINGS:
        return <SettingsView />;
      case MenuKey.GROUP_CALL:
        return <GroupCall />;
      case MenuKey.ALARM:
        return <AlarmRecords />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen w-screen bg-white overflow-hidden">
      <div className="relative z-10 flex w-full h-full">
        <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <Header onLogout={() => setIsLoggedIn(false)} />
          <main className="flex-1 p-4 overflow-hidden relative bg-gray-50">
            {/* Decorative HUD Elements */}
            <div className="absolute top-0 left-0 w-32 h-32 border-t-2 border-l-2 border-blue-400/20 rounded-tl-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 right-0 w-32 h-32 border-b-2 border-r-2 border-blue-400/20 rounded-br-3xl pointer-events-none"></div>

            {renderContent()}
          </main>
        </div>
      </div>
    </div>
  );
}
