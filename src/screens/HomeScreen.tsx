import { useState } from "react";
import {
  Zap,
  Trophy,
  ClipboardList,
  Search,
  Bell,
  Volume2,
  ChevronRight,
  Star,
  BookMarked,
  Mic,
  AudioLines,
  CheckSquare,
  Check,
  X,
  RotateCcw,
  RefreshCw,
} from "lucide-react";
import { useLearning, markLearned, markStuck } from "../lib/store";
import { WORDS, CATS, Word, shortMan, shuffle } from "../data/words";
import { speak } from "../lib/speech";
import { HomeSheet, SheetKind } from "../components/HomeSheets";
import { MasteredSheet, CheckinSheet } from "../components/ProfileSheets";

const DAILY_GOAL = 10;

function makeOptions(word: Word): string[] {
  const correct = shortMan(word.man);
  const distractors = shuffle(
    WORDS.filter((w) => w.id !== word.id && shortMan(w.man) !== correct)
  )
    .slice(0, 3)
    .map((w) => shortMan(w.man));
  return shuffle([correct, ...distractors]);
}

const quickModules = [
  { icon: Mic, label: "发音跟读", kind: "follow" as SheetKind },
  { icon: AudioLines, label: "跟读训练", kind: "practice" as SheetKind },
  { icon: BookMarked, label: "生词本", kind: "vocab" as SheetKind },
  { icon: CheckSquare, label: "自我检测", kind: "quiz" as SheetKind },
];

export default function HomeScreen({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const s = useLearning();
  const [view, setView] = useState<"home" | "quiz" | "done">("home");
  const [queue, setQueue] = useState<Word[]>([]);
  const [idx, setIdx] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [extraSheet, setExtraSheet] = useState<"mastered" | "checkin" | null>(null);
  const [recommend, setRecommend] = useState<Word[]>(() => shuffle(WORDS).slice(0, 4));

  const word: Word | undefined = queue[idx];
  const correctText = word ? shortMan(word.man) : "";
  const learnedPct = Math.min(100, Math.round((s.learned.length / WORDS.length) * 100));

  function refreshRecommend() {
    setRecommend(shuffle(WORDS).slice(0, 4));
  }

  function startQuiz() {
    const stuckWords = WORDS.filter((w) => s.stuck.includes(w.id));
    const rest = shuffle(WORDS.filter((w) => !s.stuck.includes(w.id)));
    const pool = [...stuckWords, ...rest].slice(0, DAILY_GOAL);
    if (!pool.length) return;
    setQueue(pool);
    setIdx(0);
    setPicked(null);
    setCorrectCount(0);
    setWrongCount(0);
    setOptions(makeOptions(pool[0]));
    setView("quiz");
    setTimeout(() => speak(pool[0].yue), 350);
  }

  function answer(i: number) {
    if (picked !== null || !word) return;
    setPicked(i);
    const ok = options[i] === correctText;
    if (ok) {
      markLearned(word.id);
      setCorrectCount((c) => c + 1);
    } else {
      markStuck(word.id);
      setWrongCount((c) => c + 1);
    }
    setTimeout(next, ok ? 900 : 1500);
  }

  function next() {
    if (idx + 1 >= queue.length) {
      setView("done");
      return;
    }
    const ni = idx + 1;
    setIdx(ni);
    setPicked(null);
    setOptions(makeOptions(queue[ni]));
    setTimeout(() => speak(queue[ni].yue), 250);
  }

  /* ---------- 斩词流程 ---------- */
  if (view === "quiz" && word) {
    const progress = ((idx + 1) / queue.length) * 100;
    return (
      <div className="flex flex-col h-full bg-[#f0f4ff]">
        <div className="px-4 pt-10 pb-5" style={{ background: "linear-gradient(160deg, #1a3fbf 0%, #2B5CE6 50%, #4a7cf7 100%)" }}>
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setView("home")} className="text-white/80 text-sm font-medium">
              ✕ 退出
            </button>
            <span className="text-white font-bold text-sm">记粤语 · 斩词</span>
            <span className="bg-white/15 rounded-xl px-3 py-1 text-white text-sm font-mono font-bold">
              {idx + 1} / {queue.length}
            </span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="flex-1 px-4 py-5 flex flex-col gap-5 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 shadow-lg shadow-blue-100 flex flex-col items-center gap-4">
            <span className="bg-[#EEF3FF] text-[#2B5CE6] text-xs px-2.5 py-0.5 rounded-full font-medium">
              {CATS.find((c) => c.id === word.cat)?.icon} {CATS.find((c) => c.id === word.cat)?.name}
            </span>
            <p className="text-6xl font-black text-[#1a1a2e] tracking-widest text-center">{word.yue}</p>
            <button
              onClick={() => speak(word.yue)}
              className="flex items-center gap-2 text-[#2B5CE6] font-mono text-base bg-[#EEF3FF] px-4 py-2 rounded-full active:scale-95 transition-transform"
            >
              <Volume2 size={18} /> {word.jyut}
            </button>
            <p className="text-gray-400 text-xs">选出正确释义</p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {options.map((opt, i) => {
              const isCorrect = opt === correctText;
              const isPicked = picked === i;
              let cls = "bg-white border-gray-100 text-[#1a1a2e]";
              if (picked !== null) {
                if (isCorrect) cls = "bg-green-50 border-green-400 text-green-700";
                else if (isPicked) cls = "bg-red-50 border-red-400 text-red-600";
                else cls = "bg-white border-gray-100 text-gray-300";
              }
              return (
                <button
                  key={i}
                  onClick={() => answer(i)}
                  className={`flex items-center justify-between px-5 py-4 rounded-2xl border-2 font-bold text-base transition-all active:scale-[0.98] ${cls}`}
                >
                  <span>{opt}</span>
                  {picked !== null && isCorrect && <Check size={20} className="text-green-500" />}
                  {picked !== null && isPicked && !isCorrect && <X size={20} className="text-red-500" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- 斩词完成 ---------- */
  if (view === "done") {
    return (
      <div className="flex flex-col h-full bg-[#f0f4ff]">
        <div className="px-4 pt-10 pb-6" style={{ background: "linear-gradient(160deg, #1a3fbf 0%, #2B5CE6 50%, #4a7cf7 100%)" }}>
          <p className="text-white/70 text-xs">记粤语</p>
          <p className="text-white font-bold text-lg">本组斩词完成</p>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          <div className="w-24 h-24 rounded-full bg-[#2B5CE6] flex items-center justify-center shadow-xl shadow-blue-200">
            <Check size={44} className="text-white" strokeWidth={3} />
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-[#1a1a2e]">今日记词完成！</p>
            <p className="text-gray-500 text-sm mt-1">共记 {queue.length} 个粤语词</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
              <p className="text-2xl font-black text-[#22c55e]">{correctCount}</p>
              <p className="text-xs text-gray-500 mt-1">斩掉</p>
            </div>
            <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
              <p className="text-2xl font-black text-[#F5A623]">{wrongCount}</p>
              <p className="text-xs text-gray-500 mt-1">进生词本</p>
            </div>
          </div>
          <div className="flex gap-3 w-full max-w-xs">
            <button
              onClick={startQuiz}
              className="flex-1 flex items-center justify-center gap-2 bg-[#2B5CE6] text-white px-6 py-3 rounded-xl font-bold active:scale-95"
            >
              <RotateCcw size={16} /> 再来一组
            </button>
            <button
              onClick={() => setView("home")}
              className="flex-1 bg-white border border-gray-200 text-[#1a1a2e] px-6 py-3 rounded-xl font-bold active:scale-95"
            >
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- 首页 ---------- */
  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div
        className="px-4 pt-10 pb-5 relative overflow-hidden rounded-b-[32px] shadow-lg shadow-blue-100"
        style={{ background: "linear-gradient(160deg, #1a3fbf 0%, #2B5CE6 50%, #4a7cf7 100%)" }}
      >
        <div className="pointer-events-none absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute top-4 -right-4 w-28 h-28 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 w-40 h-40 rounded-full bg-white/5" />

        <div className="relative z-10 flex items-center gap-2 mb-5">
          <button
            onClick={() => setExtraSheet("mastered")}
            className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5 active:bg-white/25 transition-colors"
          >
            <Zap size={15} className="text-[#F5A623]" fill="#F5A623" />
            <span className="text-white text-sm font-bold">{s.learned.length}</span>
          </button>
          <button
            onClick={() => setExtraSheet("checkin")}
            className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5 active:bg-white/25 transition-colors"
          >
            <Trophy size={15} className="text-white" />
            <span className="text-white text-sm">连续 {s.streak} 天</span>
          </button>
          <button
            onClick={() => setSheet("vocab")}
            className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5 active:bg-white/25 transition-colors"
          >
            <ClipboardList size={15} className="text-[#F5A623]" />
            <span className="text-white text-sm">生词 {s.stuck.length}</span>
          </button>
          <div className="ml-auto flex items-center gap-3">
            <button onClick={() => setSheet("search")} className="active:scale-90 transition-transform">
              <Search size={20} className="text-white" />
            </button>
            <button onClick={() => setSheet("notify")} className="relative active:scale-90 transition-transform">
              <Bell size={20} className="text-white" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
            </button>
          </div>
        </div>

        {/* Course card */}
        <div className="bg-gradient-to-r from-[#1535a8] to-[#2348d4] rounded-2xl px-4 py-3 flex items-center gap-3">
          <div className="w-12 h-14 rounded-xl bg-[#F5A623] flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="text-white text-2xl font-black">廣</span>
          </div>
          <div className="flex-1">
            <p className="text-white text-sm font-bold">粤语入门基础课程</p>
            <div className="mt-1.5 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-[#F5A623]" style={{ width: `${learnedPct}%` }} />
            </div>
            <p className="text-white/70 text-[11px] mt-1">已记 {s.learned.length} / {WORDS.length} 词</p>
          </div>
          <button
            onClick={() => setSheet("all")}
            className="bg-[#F5A623] text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 flex-shrink-0 active:scale-95 transition-transform"
          >
            词库 <ChevronRight size={12} />
          </button>
        </div>
      </div>

      <div className="px-3 flex flex-col gap-3 pb-6 mt-3">
        {/* Today's plan */}
        <div className="bg-white rounded-2xl p-4 shadow-lg shadow-blue-100">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-[#1a1a2e] text-base">今日计划</span>
            <button onClick={() => setSheet("practice")} className="text-[#2B5CE6] text-xs font-medium">
              🎤 跟读训练上线啦！
            </button>
          </div>
          <div className="flex gap-6 mb-4">
            <div>
              <p className="text-gray-400 text-xs mb-1">已记词</p>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-black text-[#1a1a2e]">{s.todayLearned}</span>
                <span className="text-gray-400 text-sm">/ {DAILY_GOAL}</span>
              </div>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">已背词</p>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-black text-[#1a1a2e]">{s.todayReviewed}</span>
                <span className="text-gray-400 text-sm">/ 30</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={startQuiz}
              className="flex-1 py-3.5 rounded-xl font-bold text-white text-base transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #2B5CE6, #4a7cf7)" }}
            >
              记粤语
            </button>
            <button
              onClick={() => onNavigate?.("study")}
              className="flex-1 py-3.5 rounded-xl font-bold text-white text-base transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #2B5CE6, #4a7cf7)" }}
            >
              背粤语
            </button>
          </div>
        </div>

        {/* Quick modules */}
        <div className="bg-white rounded-2xl px-4 py-4 shadow-sm shadow-blue-50">
          <div className="grid grid-cols-4 gap-2">
            {quickModules.map((mod) => {
              const Icon = mod.icon;
              const isVocab = mod.label === "生词本";
              const badge = isVocab && s.stuck.length > 0 ? String(s.stuck.length) : "";
              return (
                <button
                  key={mod.label}
                  onClick={() => setSheet(mod.kind)}
                  className="flex flex-col items-center gap-2 py-2 rounded-xl transition-all active:bg-blue-50"
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-[#EEF3FF] flex items-center justify-center">
                      <Icon size={22} className="text-[#2B5CE6]" />
                    </div>
                    {badge && (
                      <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                        {badge}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[#1a1a2e] font-medium">{mod.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Streak card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm shadow-blue-50">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-[#1a1a2e]">本周打卡</span>
            <span className="text-[#F5A623] text-xs font-bold flex items-center gap-1">
              <Zap size={12} fill="#F5A623" /> 连续 {s.streak} 天
            </span>
          </div>
          <div className="flex gap-2 justify-between">
            {["一", "二", "三", "四", "五", "六", "日"].map((day, i) => (
              <div key={day} className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i < Math.min(s.streak, 7)
                      ? "bg-[#2B5CE6] text-white shadow-md shadow-blue-200"
                      : "bg-gray-100 text-gray-300"
                  }`}
                >
                  {i < Math.min(s.streak, 7) ? <Star size={14} fill="white" className="text-white" /> : day}
                </div>
                <span className="text-[10px] text-gray-400">周{day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recommended words */}
        <div className="bg-white rounded-2xl p-4 shadow-sm shadow-blue-50">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-[#1a1a2e]">今日推荐词汇</span>
            <div className="flex items-center gap-2">
              <button
                onClick={refreshRecommend}
                className="flex items-center gap-1 text-[#2B5CE6] text-xs font-medium bg-[#EEF3FF] px-2.5 py-1 rounded-full active:scale-95 transition-transform"
                title="换一批"
              >
                <RefreshCw size={12} /> 刷新
              </button>
              <button
                onClick={() => setSheet("all")}
                className="text-[#2B5CE6] text-xs flex items-center gap-0.5"
              >
                查看全部 <ChevronRight size={12} />
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {recommend.map((w) => (
              <div
                key={w.id}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-[#f8faff] border border-[#e8edff]"
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#2B5CE6] to-[#4a7cf7] flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-lg">{w.yue}</span>
                </div>
                <div className="flex-1">
                  <span className="text-[#2B5CE6] text-sm font-mono font-medium">{w.jyut}</span>
                  <div className="text-gray-500 text-xs">{shortMan(w.man)}</div>
                </div>
                <button
                  onClick={() => speak(w.yue)}
                  className="w-8 h-8 rounded-full bg-[#EEF3FF] flex items-center justify-center active:scale-90 transition-transform"
                >
                  <Volume2 size={14} className="text-[#2B5CE6]" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 抽屉弹层 */}
      <HomeSheet kind={sheet} onClose={() => setSheet(null)} />
      {extraSheet === "mastered" && <MasteredSheet onClose={() => setExtraSheet(null)} />}
      {extraSheet === "checkin" && <CheckinSheet onClose={() => setExtraSheet(null)} />}
    </div>
  );
}
