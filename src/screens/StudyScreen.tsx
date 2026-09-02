import { useState, useEffect } from "react";
import { Volume2, ChevronLeft, ChevronRight, Check, X, RotateCcw } from "lucide-react";
import { useLearning, markReviewed, markStuck } from "../lib/store";
import { WORDS, CATS, Word, shuffle } from "../data/words";
import { speak } from "../lib/speech";

const GROUP_SIZE = 10;

const toneColors: Record<string, string> = {
  "1": "#2B5CE6",
  "2": "#22c55e",
  "3": "#F5A623",
  "4": "#a855f7",
  "5": "#ef4444",
  "6": "#64748b",
};

function buildQueue(stuck: string[]): Word[] {
  const stuckWords = WORDS.filter((w) => stuck.includes(w.id));
  const rest = shuffle(WORDS.filter((w) => !stuck.includes(w.id)));
  return [...stuckWords, ...rest].slice(0, GROUP_SIZE);
}

export default function StudyScreen() {
  const s = useLearning();
  const [queue, setQueue] = useState<Word[]>(() => buildQueue(s.stuck));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<Record<string, "know" | "learn">>({});

  const word = queue[index];

  useEffect(() => {
    if (queue.length) setTimeout(() => speak(queue[0].yue), 350);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (dir: number) => {
    setFlipped(false);
    const ni = Math.max(0, Math.min(queue.length - 1, index + dir));
    setIndex(ni);
    speak(queue[ni].yue);
  };

  const mark = (result: "know" | "learn") => {
    if (!word) return;
    setResults((r) => ({ ...r, [word.id]: result }));
    if (result === "know") markReviewed(word.id);
    else markStuck(word.id);
    if (index < queue.length - 1) {
      setFlipped(false);
      setIndex(index + 1);
      setTimeout(() => speak(queue[index + 1].yue), 250);
    }
  };

  const replay = () => {
    setQueue(buildQueue(s.stuck));
    setIndex(0);
    setFlipped(false);
    setResults({});
    setTimeout(() => speak(queue[0]?.yue ?? ""), 300);
  };

  const done = word && results[word.id];

  return (
    <div className="flex flex-col h-full bg-[#f0f4ff]">
      {/* Header */}
      <div
        className="px-4 pt-10 pb-6"
        style={{ background: "linear-gradient(160deg, #1a3fbf 0%, #2B5CE6 50%, #4a7cf7 100%)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/70 text-xs">背粤语</p>
            <p className="text-white font-bold text-lg">粤语词汇跟读</p>
          </div>
          <div className="bg-white/15 rounded-xl px-3 py-1.5 text-white text-sm font-mono font-bold">
            {index + 1} / {queue.length}
          </div>
        </div>
        <div className="h-2 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-white transition-all duration-500"
            style={{ width: `${((index + 1) / queue.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1 px-4 py-4 flex flex-col gap-4 overflow-y-auto">
        {done || !word ? (
          /* Completion screen */
          <div className="flex-1 flex flex-col items-center justify-center gap-6 py-10">
            <div className="w-24 h-24 rounded-full bg-[#2B5CE6] flex items-center justify-center shadow-xl shadow-blue-200">
              <Check size={44} className="text-white" strokeWidth={3} />
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-[#1a1a2e]">完成本组背诵！</p>
              <p className="text-gray-500 text-sm mt-1">背了 {queue.length} 个粤语词汇</p>
            </div>
            <div className="flex gap-4">
              <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
                <p className="text-2xl font-black text-[#22c55e]">
                  {Object.values(results).filter((r) => r === "know").length}
                </p>
                <p className="text-xs text-gray-500 mt-1">已掌握</p>
              </div>
              <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
                <p className="text-2xl font-black text-[#F5A623]">
                  {Object.values(results).filter((r) => r === "learn").length}
                </p>
                <p className="text-xs text-gray-500 mt-1">待加强</p>
              </div>
            </div>
            <button
              onClick={replay}
              className="flex items-center gap-2 bg-[#2B5CE6] text-white px-6 py-3 rounded-xl font-bold active:scale-95"
            >
              <RotateCcw size={16} /> 再次练习
            </button>
          </div>
        ) : (
          <>
            {/* Card */}
            <button
              onClick={() => setFlipped((f) => !f)}
              className="bg-white rounded-3xl p-6 shadow-lg shadow-blue-100 flex flex-col items-center gap-4 transition-all active:scale-[0.98]"
            >
              {/* Category tag */}
              <div className="flex gap-2 flex-wrap justify-center">
                <span className="bg-[#EEF3FF] text-[#2B5CE6] text-xs px-2.5 py-0.5 rounded-full font-medium">
                  {CATS.find((c) => c.id === word.cat)?.icon} {CATS.find((c) => c.id === word.cat)?.name}
                </span>
              </div>

              {/* Main character */}
              <div className="w-full text-center">
                <p className="text-7xl font-black text-[#1a1a2e] tracking-widest">{word.yue}</p>
              </div>

              {/* Jyutping with tones */}
              <div className="flex gap-2 items-center flex-wrap justify-center">
                {word.jyut.split(" ").map((syllable, i) => {
                  const toneNum = syllable.slice(-1);
                  const text = syllable.slice(0, -1);
                  return (
                    <div key={i} className="flex flex-col items-center">
                      <span className="text-xl font-bold text-[#2B5CE6] font-mono">{text}</span>
                      <span
                        className="text-xs font-bold px-1.5 py-0.5 rounded-md text-white"
                        style={{ backgroundColor: toneColors[toneNum] || "#2B5CE6" }}
                      >
                        {toneNum}声
                      </span>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  speak(word.yue);
                }}
                className="w-12 h-12 rounded-full bg-[#EEF3FF] flex items-center justify-center active:scale-90 transition-transform"
              >
                <Volume2 size={20} className="text-[#2B5CE6]" />
              </button>

              {/* Flip reveal */}
              {flipped ? (
                <div className="w-full border-t border-[#eef3ff] pt-4 flex flex-col gap-3">
                  <div className="text-center">
                    <p className="text-gray-500 text-xs mb-1">普通话释义</p>
                    <p className="text-[#1a1a2e] font-medium text-base">{word.man}</p>
                  </div>
                  <div className="bg-[#f8faff] rounded-xl p-3">
                    <p className="text-[#1a1a2e] font-medium text-sm">{word.example}</p>
                    <p className="text-gray-400 text-xs mt-1">{word.exampleMan}</p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-400 text-xs">点击卡片查看释义</p>
              )}
            </button>

            {/* Tone guide */}
            <div className="bg-white rounded-2xl p-4 shadow-sm shadow-blue-50">
              <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">粤语九声六调</p>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries({ "1": "阴平", "2": "阴上", "3": "阴去", "4": "阳平", "5": "阳上", "6": "阳去" }).map(
                  ([num, name]) => (
                    <div key={num} className="flex items-center gap-1.5">
                      <span
                        className="w-5 h-5 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: toneColors[num] }}
                      >
                        {num}
                      </span>
                      <span className="text-xs text-gray-600">{name}</span>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Know / Learn buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => mark("learn")}
                className="flex-1 py-4 rounded-2xl border-2 border-[#ef4444] text-[#ef4444] font-bold text-base flex items-center justify-center gap-2 transition-all active:bg-red-50"
              >
                <X size={20} strokeWidth={2.5} /> 再背一次
              </button>
              <button
                onClick={() => mark("know")}
                className="flex-1 py-4 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-green-200"
                style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
              >
                <Check size={20} strokeWidth={2.5} /> 认识
              </button>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => go(-1)}
                disabled={index === 0}
                className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center disabled:opacity-30"
              >
                <ChevronLeft size={20} className="text-[#2B5CE6]" />
              </button>
              <div className="flex gap-1.5">
                {queue.map((w, i) => (
                  <button
                    key={w.id}
                    onClick={() => {
                      setIndex(i);
                      setFlipped(false);
                      speak(w.yue);
                    }}
                    className={`h-1.5 rounded-full transition-all ${
                      i === index
                        ? "w-6 bg-[#2B5CE6]"
                        : results[w.id] === "know"
                        ? "w-2 bg-green-400"
                        : results[w.id] === "learn"
                        ? "w-2 bg-orange-400"
                        : "w-2 bg-gray-200"
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={() => go(1)}
                disabled={index === queue.length - 1}
                className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center disabled:opacity-30"
              >
                <ChevronRight size={20} className="text-[#2B5CE6]" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
