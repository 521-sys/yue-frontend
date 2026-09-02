import { useState } from "react";
import { Target, Check, Flame } from "lucide-react";
import { Sheet, SoundButton, WordRow, StuckList } from "./Sheet";
import { useLearning } from "../lib/store";
import { WORDS } from "../data/words";
import type { LearningState } from "../lib/store";

/* ============================ 成就定义 ============================ */

export const ACHIEVEMENTS: {
  icon: string;
  label: string;
  desc: string;
  test: (s: LearningState) => boolean;
}[] = [
  { icon: "🔥", label: "连续7天", desc: "连续学习 7 天", test: (s) => s.streak >= 7 },
  { icon: "📖", label: "学习50词", desc: "累计记住 50 个词", test: (s) => s.learned.length >= 50 },
  { icon: "🎯", label: "背词30个", desc: "累计背诵 30 个词", test: (s) => s.reviewed.length >= 30 },
  { icon: "🏆", label: "生词清零", desc: "清空生词本", test: (s) => s.stuck.length === 0 && s.learned.length > 0 },
  { icon: "👑", label: "连续30天", desc: "连续学习 30 天", test: (s) => s.streak >= 30 },
  { icon: "🎓", label: "学完全部", desc: `记住全部 ${WORDS.length} 个词`, test: (s) => s.learned.length >= WORDS.length },
  { icon: "💪", label: "背完全部", desc: `背完全部 ${WORDS.length} 个词`, test: (s) => s.reviewed.length >= WORDS.length },
  { icon: "⚡", label: "今日达标", desc: "完成今日学习目标", test: (s) => s.todayLearned >= s.dailyGoal },
];

/* ============================ 已掌握词 ============================ */

export function MasteredSheet({ onClose }: { onClose: () => void }) {
  const s = useLearning();
  const words = WORDS.filter((w) => s.learned.includes(w.id));
  return (
    <Sheet title="已掌握词汇" onClose={onClose}>
      {words.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-16 h-16 rounded-2xl bg-[#EEF3FF] flex items-center justify-center text-3xl">
            📖
          </div>
          <p className="text-gray-500 text-sm">还没有斩下的词</p>
          <p className="text-gray-400 text-xs">去「记粤语」斩对第一个词吧</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-400">
            共 {words.length} / {WORDS.length} 词 · 掌握率 {Math.round((words.length / WORDS.length) * 100)}%
          </p>
          {words.map((w) => (
            <WordRow key={w.id} w={w} />
          ))}
        </div>
      )}
    </Sheet>
  );
}

/* ============================ 学习记录 ============================ */

export function HistorySheet({ onClose }: { onClose: () => void }) {
  const s = useLearning();
  const totalActions = Object.values(s.activity).reduce((a, b) => a + b, 0);

  const week: { label: string; value: number; isToday: boolean }[] = [];
  const WEEK_CN = ["一", "二", "三", "四", "五", "六", "日"];
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

  return (
    <Sheet title="学习记录" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          { label: "已记词", value: s.learned.length, color: "#2B5CE6" },
          { label: "已背词", value: s.reviewed.length, color: "#22c55e" },
          { label: "连续天数", value: s.streak, color: "#F5A623" },
          { label: "累计学习", value: totalActions, color: "#a855f7" },
        ].map((x) => (
          <div key={x.label} className="bg-white rounded-2xl p-3 text-center shadow-sm shadow-blue-50">
            <p className="text-2xl font-black" style={{ color: x.color }}>
              {x.value}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">{x.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm shadow-blue-50">
        <p className="text-xs font-bold text-gray-400 mb-3">近 7 天学习次数</p>
        <div className="flex items-end gap-2 h-24">
          {week.map((w, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-gray-400">{w.value || ""}</span>
              <div
                className="w-full rounded-t-md"
                style={{
                  height: `${Math.max(4, (w.value / maxVal) * 56)}px`,
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
    </Sheet>
  );
}

/* ============================ 全部成就 ============================ */

export function AchieveSheet({ onClose }: { onClose: () => void }) {
  const s = useLearning();
  const unlocked = ACHIEVEMENTS.filter((a) => a.test(s)).length;
  return (
    <Sheet title="我的成就" onClose={onClose}>
      <p className="text-xs text-gray-400 mb-3">
        已解锁 {unlocked} / {ACHIEVEMENTS.length}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {ACHIEVEMENTS.map((a) => {
          const done = a.test(s);
          return (
            <div
              key={a.label}
              className={`rounded-2xl p-3 flex items-center gap-3 ${
                done ? "bg-gradient-to-br from-[#EEF3FF] to-[#dce8ff] shadow-md" : "bg-white shadow-sm shadow-blue-50"
              }`}
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${
                  done ? "" : "bg-gray-100 grayscale opacity-40"
                }`}
              >
                {a.icon}
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-bold ${done ? "text-[#1a1a2e]" : "text-gray-400"}`}>{a.label}</p>
                <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{a.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

/* ============================ 打卡日历 ============================ */

export function CheckinSheet({ onClose }: { onClose: () => void }) {
  const s = useLearning();
  const DAYS = 35;
  const cells: { key: string; day: number; count: number; isToday: boolean }[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    cells.push({
      key,
      day: d.getDate(),
      count: s.activity[key] || 0,
      isToday: i === 0,
    });
  }
  const checkedCount = cells.filter((c) => c.count > 0).length;

  return (
    <Sheet title="打卡日历" onClose={onClose}>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 bg-white rounded-2xl p-3 text-center shadow-sm shadow-blue-50">
          <p className="text-2xl font-black text-[#F5A623] flex items-center justify-center gap-1">
            <Flame size={20} /> {s.streak}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">连续天数</p>
        </div>
        <div className="flex-1 bg-white rounded-2xl p-3 text-center shadow-sm shadow-blue-50">
          <p className="text-2xl font-black text-[#2B5CE6]">{checkedCount}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">近 35 天打卡</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm shadow-blue-50">
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
            <span key={d} className="text-center text-[10px] text-gray-400">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((c) => (
            <div
              key={c.key}
              className="aspect-square rounded-md flex items-center justify-center text-[10px] font-bold"
              style={{
                background: c.count > 0
                  ? c.isToday
                    ? "linear-gradient(135deg, #F5A623, #e8950f)"
                    : "linear-gradient(135deg, #2B5CE6, #4a7cf7)"
                  : "#eef1f7",
                color: c.count > 0 ? "#fff" : "#b8c0d0",
                boxShadow: c.isToday ? "0 0 0 2px #2B5CE6" : undefined,
              }}
              title={`${c.key}${c.count ? ` · ${c.count} 次` : ""}`}
            >
              {c.day}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-[#eef1f7] inline-block" /> 未学习
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-[#2B5CE6] inline-block" /> 已打卡
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-[#F5A623] inline-block" /> 今天
          </span>
        </div>
      </div>
    </Sheet>
  );
}

/* ============================ 生词本（包装共享组件） ============================ */

export function StuckSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="生词本" onClose={onClose}>
      <StuckList />
    </Sheet>
  );
}

/* ============================ 汇总（「我」页菜单用） ============================ */

export type ProfileSheetKind = "stuck" | "history" | "achieve" | "checkin" | "mastered" | null;

export function ProfileSheet({
  kind,
  onClose,
}: {
  kind: ProfileSheetKind;
  onClose: () => void;
}) {
  switch (kind) {
    case "stuck":
      return <StuckSheet onClose={onClose} />;
    case "history":
      return <HistorySheet onClose={onClose} />;
    case "achieve":
      return <AchieveSheet onClose={onClose} />;
    case "checkin":
      return <CheckinSheet onClose={onClose} />;
    case "mastered":
      return <MasteredSheet onClose={onClose} />;
    default:
      return null;
  }
}

/** 每日目标完成度小组件（学习记录面板顶部用） */
export function GoalBadge() {
  const s = useLearning();
  const pct = Math.min(100, Math.round((s.todayLearned / s.dailyGoal) * 100));
  return (
    <div className="flex items-center gap-2 bg-white rounded-2xl p-3 shadow-sm shadow-blue-50">
      <Target size={20} className="text-[#2B5CE6]" />
      <div className="flex-1">
        <p className="text-xs font-bold text-[#1a1a2e]">今日目标 {s.dailyGoal} 词</p>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
          <div className="h-full bg-[#2B5CE6] rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {pct >= 100 ? (
        <Check size={18} className="text-[#22c55e]" strokeWidth={3} />
      ) : (
        <span className="text-xs font-bold text-[#2B5CE6]">{s.todayLearned}/{s.dailyGoal}</span>
      )}
    </div>
  );
}

/** 未使用的 SoundButton 重导出，方便页面直接引用 */
export { SoundButton };
