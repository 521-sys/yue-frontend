import { useState } from "react";
import {
  Settings,
  BookMarked,
  Trophy,
  Zap,
  Target,
  ChevronRight,
  Star,
  Calendar,
  TrendingUp,
  LogIn,
  LogOut,
} from "lucide-react";
import { useLearning, setDailyGoal, resetAll, isLoggedin, currentUser, logout } from "../lib/store";
import { WORDS } from "../data/words";
import { ProfileSheet, ProfileSheetKind, ACHIEVEMENTS } from "../components/ProfileSheets";
import { AuthSheet } from "../components/AuthSheet";

const WEEK_CN = ["一", "二", "三", "四", "五", "六", "日"];

export default function ProfileScreen() {
  const s = useLearning();
  const [sheet, setSheet] = useState<ProfileSheetKind>(null);
  const [authOpen, setAuthOpen] = useState(false);

  const total = WORDS.length;
  const mastery = total ? Math.round((s.learned.length / total) * 100) : 0;

  // 近 7 天活动柱状图
  const week: { label: string; value: number; isToday: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    week.push({
      label: WEEK_CN[(d.getDay() + 6) % 7],
      value: s.activity[key] || 0,
      isToday: i === 0,
    });
  }
  const maxVal = Math.max(...week.map((w) => w.value), 1);

  const unlockedCount = ACHIEVEMENTS.filter((a) => a.test(s)).length;
  const achievements = ACHIEVEMENTS.slice(0, 4).map((a) => ({ ...a, done: a.test(s) }));

  const menu = [
    { icon: BookMarked, label: "我的生词本", sub: `${s.stuck.length} 个生词`, color: "#2B5CE6", kind: "stuck" as ProfileSheetKind },
    { icon: Zap, label: "学习记录", sub: `已记 ${s.learned.length} 词 · 已背 ${s.reviewed.length} 词`, color: "#F5A623", kind: "history" as ProfileSheetKind },
    { icon: Trophy, label: "我的成就", sub: `${unlockedCount}/${ACHIEVEMENTS.length} 已解锁`, color: "#22c55e", kind: "achieve" as ProfileSheetKind },
    { icon: Calendar, label: "打卡日历", sub: `连续 ${s.streak} 天打卡`, color: "#a855f7", kind: "checkin" as ProfileSheetKind },
  ];

  return (
    <div className="flex flex-col h-full bg-[#f0f4ff]">
      {/* Header */}
      <div
        className="px-4 pt-10 pb-8 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #1a3fbf 0%, #2B5CE6 50%, #4a7cf7 100%)" }}
      >
        <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/5" />
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center text-4xl">
              😊
            </div>
            <div>
              <p className="text-white font-black text-xl">{isLoggedin() ? currentUser() : "粤语学习者"}</p>
              <p className="text-white/70 text-xs mt-0.5">
                {isLoggedin() ? "已登录 · 进度云端同步" : "入门级 · 广州方言"}
              </p>
              <div className="flex items-center gap-1 mt-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star
                    key={i}
                    size={12}
                    fill={i < Math.min(5, Math.round(mastery / 20)) ? "#F5A623" : "none"}
                    className={i < Math.min(5, Math.round(mastery / 20)) ? "text-[#F5A623]" : "text-white/40"}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isLoggedin() ? (
              <button
                onClick={() => {
                  if (confirm("确定退出登录吗？")) logout();
                }}
                className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center active:scale-95 transition-transform"
                title="退出登录"
              >
                <LogOut size={18} className="text-white" />
              </button>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center active:scale-95 transition-transform"
                title="登录/注册"
              >
                <LogIn size={18} className="text-white" />
              </button>
            )}
            <button
              onClick={() => {
                if (confirm("确定清空全部学习进度吗？此操作不可撤销。")) resetAll();
              }}
              className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center active:scale-95 transition-transform"
              title="重置进度"
            >
              <Settings size={18} className="text-white" />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "学习词汇", value: String(s.learned.length) },
            { label: "连续天数", value: String(s.streak) },
            { label: "已背词", value: String(s.reviewed.length) },
            { label: "掌握率", value: `${mastery}%` },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/15 rounded-xl py-2 px-1 text-center">
              <p className="text-white font-black text-base">{stat.value}</p>
              <p className="text-white/60 text-[10px] mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {/* Weekly chart */}
        <div className="bg-white rounded-2xl p-4 shadow-sm shadow-blue-50">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-[#1a1a2e]">本周学习</span>
            <div className="flex items-center gap-1 text-[#F5A623] text-xs font-bold">
              <TrendingUp size={13} />
              <span>{week.reduce((a, b) => a + b.value, 0)} 次学习</span>
            </div>
          </div>
          <div className="flex items-end gap-2 h-20">
            {week.map((w, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-md relative"
                  style={{
                    height: `${Math.max(4, (w.value / maxVal) * 60)}px`,
                    background: w.value > 0
                      ? w.isToday
                        ? "linear-gradient(180deg, #F5A623, #e8950f)"
                        : "linear-gradient(180deg, #2B5CE6, #4a7cf7)"
                      : "#e5e7eb",
                  }}
                />
                <span className={`text-[10px] ${w.isToday ? "text-[#F5A623] font-bold" : "text-gray-400"}`}>
                  {w.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Daily goal */}
        <div className="bg-white rounded-2xl p-4 shadow-sm shadow-blue-50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target size={18} className="text-[#2B5CE6]" />
              <span className="font-bold text-[#1a1a2e]">每日目标</span>
            </div>
            <span className="text-[#2B5CE6] font-black text-lg">{s.dailyGoal} 词</span>
          </div>
          <input
            type="range"
            min={5}
            max={50}
            step={5}
            value={s.dailyGoal}
            onChange={(e) => setDailyGoal(Number(e.target.value))}
            className="w-full accent-[#2B5CE6]"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>5词/天</span>
            <span>25词/天</span>
            <span>50词/天</span>
          </div>
        </div>

        {/* Achievements */}
        <div className="bg-white rounded-2xl p-4 shadow-sm shadow-blue-50">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-[#1a1a2e]">成就徽章</span>
            <button
              onClick={() => setSheet("achieve")}
              className="text-[#2B5CE6] text-xs flex items-center gap-0.5"
            >
              全部 <ChevronRight size={12} />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {achievements.map((a) => (
              <div key={a.label} className="flex flex-col items-center gap-1">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${
                    a.done ? "bg-gradient-to-br from-[#EEF3FF] to-[#dce8ff] shadow-md" : "bg-gray-100 grayscale opacity-40"
                  }`}
                >
                  {a.icon}
                </div>
                <span className="text-[10px] text-gray-500 text-center leading-tight">{a.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Menu items */}
        <div className="bg-white rounded-2xl shadow-sm shadow-blue-50 overflow-hidden">
          {menu.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={() => setSheet(item.kind)}
                className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 last:border-0 active:bg-gray-50 transition-colors"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: item.color + "22" }}
                >
                  <Icon size={18} style={{ color: item.color }} />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-sm text-[#1a1a2e]">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.sub}</p>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </button>
            );
          })}
        </div>
      </div>

      {/* 抽屉弹层 */}
      <ProfileSheet kind={sheet} onClose={() => setSheet(null)} />
      {authOpen && <AuthSheet onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
