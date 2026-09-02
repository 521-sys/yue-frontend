import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  Check,
  RotateCcw,
  Search,
  Sparkles,
  TrendingUp,
  BookOpen,
  Trophy,
  Mic,
  AudioLines,
  Volume2,
  Play,
  Square,
} from "lucide-react";
import { Sheet, SoundButton, StuckList } from "./Sheet";
import { markLearned, markStuck } from "../lib/store";
import { WORDS, CATS, Word, shortMan, shuffle, catOf } from "../data/words";
import { translate, reverseLookup, hasKnown } from "../data/dictionary";
import { speak } from "../lib/speech";

/* ============================ 发音跟读 ============================ */

function FollowSheet({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const word = WORDS[i % WORDS.length];
  const cat = catOf(word.cat);
  return (
    <Sheet title="发音跟读" onClose={onClose}>
      <p className="text-gray-500 text-xs mb-4">
        先听标准粤语发音，再大声跟读。点击喇叭可反复播放，读熟后换下一个词。
      </p>
      <div className="bg-white rounded-3xl p-6 shadow-lg shadow-blue-100 flex flex-col items-center gap-4">
        <span className="bg-[#EEF3FF] text-[#2B5CE6] text-xs px-2.5 py-0.5 rounded-full font-medium">
          {cat.icon} {cat.name} · {i + 1} / {WORDS.length}
        </span>
        <p className="text-6xl font-black text-[#1a1a2e] tracking-widest text-center">{word.yue}</p>
        <button
          onClick={() => speak(word.yue)}
          className="flex items-center gap-2 text-[#2B5CE6] font-mono text-base bg-[#EEF3FF] px-4 py-2 rounded-full active:scale-95 transition-transform"
        >
          {word.jyut}
        </button>
        <p className="text-gray-500 text-sm">{word.man}</p>

        <button
          onClick={() => speak(word.yue)}
          className="w-20 h-20 rounded-full flex items-center justify-center shadow-xl shadow-blue-200 active:scale-95 transition-transform"
          style={{ background: "linear-gradient(135deg, #2B5CE6, #4a7cf7)" }}
        >
          <AudioLines size={36} className="text-white" />
        </button>

        <div className="w-full bg-[#f8faff] rounded-xl p-3 flex items-start gap-2">
          <Mic size={16} className="text-[#F5A623] flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-[#1a1a2e] font-medium text-sm">{word.example}</p>
            <p className="text-gray-400 text-xs mt-1">{word.exampleMan}</p>
          </div>
          <SoundButton text={word.example} size={16} className="w-8 h-8 flex-shrink-0" />
        </div>
      </div>

      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => setI((i - 1 + WORDS.length) % WORDS.length)}
          className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center active:scale-95"
        >
          <ChevronLeft size={22} className="text-[#2B5CE6]" />
        </button>
        <button
          onClick={() => setI((i + 1) % WORDS.length)}
          className="flex-1 mx-4 py-3 rounded-xl font-bold text-white text-base active:scale-95"
          style={{ background: "linear-gradient(135deg, #2B5CE6, #4a7cf7)" }}
        >
          下一个词
        </button>
        <button
          onClick={() => speak(word.yue)}
          className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center active:scale-95"
        >
          <RotateCcw size={20} className="text-[#2B5CE6]" />
        </button>
      </div>
    </Sheet>
  );
}

/* ============================ 跟读训练（录音对比 + AI 评分） ============================ */

interface PracticeItem {
  yue: string;
  jyut: string;
  man: string;
  src: string;
}

const SRC_OK =
  typeof window !== "undefined" &&
  !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

function cleanTxt(t: string): string {
  return String(t).replace(/[\s.,?!，。？！、'"「」（）()·…]/g, "");
}

function similarity(a: string, b: string): number {
  a = cleanTxt(a);
  b = cleanTxt(b);
  if (!a || !b) return 0;
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return Math.round((dp[m][n] / Math.max(m, n)) * 100);
}

function makePracticeList(): PracticeItem[] {
  return shuffle(
    WORDS.map((w) => ({ yue: w.yue, jyut: w.jyut, man: w.man, src: catOf(w.cat).name }))
  ).slice(0, 10);
}

function PracticeSheet({ onClose }: { onClose: () => void }) {
  const [started, setStarted] = useState(false);
  const [list, setList] = useState<PracticeItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recUrl, setRecUrl] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [recCount, setRecCount] = useState(0);
  const [baseRec, setBaseRec] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [errMsg, setErrMsg] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recUrlRef = useRef<string | null>(null);

  const it = list[idx];
  const done = started && idx >= list.length;

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state === "recording") {
        try {
          recorderRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (recUrlRef.current) URL.revokeObjectURL(recUrlRef.current);
    };
  }, []);

  function clearRec() {
    if (recUrlRef.current) URL.revokeObjectURL(recUrlRef.current);
    recUrlRef.current = null;
    setRecUrl(null);
  }

  function start() {
    const l = makePracticeList();
    setList(l);
    setIdx(0);
    clearRec();
    setScore(null);
    setTranscript("");
    setListening(false);
    setErrMsg("");
    setBaseRec(recCount);
    setScores([]);
    setStarted(true);
    setTimeout(() => speak(l[0].yue, 1), 400);
  }

  async function toggleRec() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrMsg("需通过 localhost 或 https 打开才能录音");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (recUrlRef.current) URL.revokeObjectURL(recUrlRef.current);
        recUrlRef.current = URL.createObjectURL(blob);
        setRecUrl(recUrlRef.current);
        setRecCount((c) => c + 1);
        setErrMsg("");
      };
      clearRec();
      rec.start();
      setRecording(true);
      setErrMsg("");
    } catch (e) {
      setErrMsg("无法访问麦克风：" + ((e as any)?.name || ""));
    }
  }

  function playRec() {
    if (!recUrlRef.current) {
      setErrMsg("还没有录音，先点麦克风");
      return;
    }
    new Audio(recUrlRef.current).play();
  }

  function grade() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setErrMsg("当前浏览器不支持语音识别（建议 Chrome / Edge）");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrMsg("需通过 localhost 或 https 打开才能评分");
      return;
    }
    const r = new SR();
    r.lang = "zh-HK";
    r.interimResults = false;
    r.maxAlternatives = 1;
    setListening(true);
    setErrMsg("");
    r.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      const sc = similarity(t, it.yue);
      setTranscript(t);
      setScore(sc);
      setScores((arr) => [...arr, sc]);
      setListening(false);
    };
    r.onerror = (e: any) => {
      setListening(false);
      setErrMsg("识别失败：" + (e.error === "not-allowed" ? "麦克风被拒绝" : e.error));
    };
    r.onend = () => {
      setListening(false);
    };
    try {
      r.start();
    } catch {
      setListening(false);
      setErrMsg("无法启动识别");
    }
  }

  function next() {
    const ni = idx + 1;
    setIdx(ni);
    setScore(null);
    setTranscript("");
    clearRec();
    if (ni < list.length) setTimeout(() => speak(list[ni].yue, 1), 350);
  }

  /* 未开始 */
  if (!started) {
    return (
      <Sheet title="跟读训练" onClose={onClose}>
        <div className="flex flex-col items-center gap-4 py-4">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg shadow-blue-200"
            style={{ background: "linear-gradient(135deg, #2B5CE6, #4a7cf7)" }}
          >
            <Mic size={36} className="text-white" />
          </div>
          <p className="text-lg font-bold text-[#1a1a2e]">跟读训练模式</p>
          <div className="w-full bg-white rounded-2xl p-4 text-sm text-gray-500 leading-7 shadow-sm shadow-blue-50">
            <p>① 🔊 听标准发音（可切 🐢 慢速）</p>
            <p>② 🎤 点大按钮，跟住读一句</p>
            <p>③ ▶ 回放自己的录音对比</p>
            <p>④ 🎯 AI 听你讲，发音打分</p>
          </div>
          {!SRC_OK && (
            <p className="w-full text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
              ⚠️ 当前浏览器不支持语音识别评分（跟读录音仍可用），建议用 Chrome 或 Edge 打开。
            </p>
          )}
          <button
            onClick={start}
            className="w-full py-3.5 rounded-xl font-bold text-white text-base active:scale-95 transition-all"
            style={{ background: "linear-gradient(135deg, #2B5CE6, #4a7cf7)" }}
          >
            🚀 开始练习（10 句）
          </button>
        </div>
      </Sheet>
    );
  }

  /* 完成 */
  if (done) {
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const recs = recCount - baseRec;
    return (
      <Sheet title="跟读训练" onClose={onClose}>
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-20 h-20 rounded-full bg-[#2B5CE6] flex items-center justify-center shadow-xl shadow-blue-200">
            <Check size={40} className="text-white" strokeWidth={3} />
          </div>
          <p className="text-xl font-black text-[#1a1a2e]">本轮跟读完成！</p>
          {avg !== null && (
            <>
              <p className="text-4xl font-black text-[#2B5CE6]">
                {avg}
                <span className="text-sm text-gray-400 font-normal"> 平均分</span>
              </p>
              <p className="text-amber-500 text-lg tracking-widest">
                {avg >= 85 ? "★★★★★" : avg >= 70 ? "★★★★" : avg >= 50 ? "★★★" : "★★"}
              </p>
            </>
          )}
          <p className="text-gray-500 text-sm">
            {avg === null
              ? "完成跟读！下次试试 🎯 AI 评分"
              : avg >= 85
              ? "犀利！发音好正 🇭🇰"
              : avg >= 70
              ? "好嘢！保持呢个节奏 💪"
              : "多听多讲，好快上手！"}
          </p>
          <p className="text-gray-400 text-xs">🎤 本次录音 {recs} 次 · 跟读总数 {recCount} 次</p>
          <div className="flex gap-3 w-full max-w-xs">
            <button
              onClick={start}
              className="flex-1 flex items-center justify-center gap-2 bg-[#2B5CE6] text-white px-6 py-3 rounded-xl font-bold active:scale-95"
            >
              <RotateCcw size={16} /> 再练一轮
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-white border border-gray-200 text-[#1a1a2e] px-6 py-3 rounded-xl font-bold active:scale-95"
            >
              返回
            </button>
          </div>
        </div>
      </Sheet>
    );
  }

  /* 练习中 */
  return (
    <Sheet title="跟读训练" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 font-medium">
            第 {idx + 1} / {list.length} 句 · {it.src}
          </span>
          <span className="text-xs text-[#2B5CE6] font-bold">🎤 {recCount} 次</span>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-lg shadow-blue-100 flex flex-col items-center gap-2.5">
          <button
            onClick={() => speak(it.yue)}
            className="text-5xl font-black text-[#1a1a2e] tracking-widest active:scale-95 transition-transform"
          >
            {it.yue}
          </button>
          <span className="text-[#2B5CE6] text-sm font-mono font-medium">{it.jyut}</span>
          <span className="text-gray-400 text-xs">{it.man}</span>
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => speak(it.yue, 1)}
              className="flex items-center gap-1 text-xs font-bold text-[#2B5CE6] bg-[#EEF3FF] px-3 py-1.5 rounded-full active:scale-95 transition-transform"
            >
              <Volume2 size={13} /> 标准音
            </button>
            <button
              onClick={() => speak(it.yue, 0.6)}
              className="flex items-center gap-1 text-xs font-bold text-[#2B5CE6] bg-[#EEF3FF] px-3 py-1.5 rounded-full active:scale-95 transition-transform"
            >
              🐢 慢速
            </button>
            <button
              onClick={() => speak(it.yue, 1.3)}
              className="flex items-center gap-1 text-xs font-bold text-[#2B5CE6] bg-[#EEF3FF] px-3 py-1.5 rounded-full active:scale-95 transition-transform"
            >
              🐇 快速
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-sm shadow-blue-50 flex flex-col items-center gap-3">
          {recording && <p className="text-red-500 text-xs font-bold">● 录音中…读完再点一下停止</p>}
          <button
            onClick={toggleRec}
            className="w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl active:scale-95 transition-all"
            style={
              recording
                ? { background: "#ef4444", boxShadow: "0 12px 24px -6px rgba(239,68,68,0.5)" }
                : { background: "linear-gradient(135deg, #2B5CE6, #4a7cf7)", boxShadow: "0 12px 24px -6px rgba(43,92,230,0.5)" }
            }
          >
            {recording ? <Square size={28} fill="currentColor" /> : <Mic size={28} />}
          </button>
          <div className="flex gap-2">
            {recUrl && (
              <button
                onClick={playRec}
                className="flex items-center gap-1 text-xs font-bold text-[#1a1a2e] bg-gray-100 px-3 py-1.5 rounded-full active:scale-95 transition-transform"
              >
                <Play size={13} /> 我的录音
              </button>
            )}
            <button
              onClick={grade}
              className="flex items-center gap-1 text-xs font-bold text-[#2B5CE6] bg-[#EEF3FF] px-3 py-1.5 rounded-full active:scale-95 transition-transform"
            >
              <Sparkles size={13} /> {listening ? "识别中…" : "AI 评分"}
            </button>
          </div>
          {errMsg && <p className="text-xs text-red-500">{errMsg}</p>}
          {score !== null && (
            <div className="w-full bg-[#f8faff] rounded-xl p-3 text-center">
              <p className="text-3xl font-black text-[#2B5CE6]">
                {score}
                <span className="text-sm text-gray-400 font-normal"> 分</span>
              </p>
              <p className="text-amber-500 text-sm mt-0.5 tracking-widest">
                {score >= 85 ? "★★★★★" : score >= 70 ? "★★★★" : score >= 50 ? "★★★" : "★★"}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                {score >= 85
                  ? "犀利！好接近母语者 🎉"
                  : score >= 70
                  ? "唔錯！发音基本到位 💪"
                  : score >= 50
                  ? "基本听得出，再练练音调"
                  : "唔緊要，先听慢速多跟几遍"}
              </p>
              <p className="text-gray-400 text-xs mt-1">👂 AI 听到你讲：「{transcript || "(冇听到内容)"}」</p>
            </div>
          )}
        </div>

        <button
          onClick={next}
          className="w-full py-3.5 rounded-xl font-bold text-white text-base active:scale-95 transition-all"
          style={{ background: "linear-gradient(135deg, #2B5CE6, #4a7cf7)" }}
        >
          下一句 ›
        </button>
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl font-bold text-gray-400 text-sm bg-white border border-gray-100 active:scale-95"
        >
          结束练习
        </button>
      </div>
    </Sheet>
  );
}

/* ============================ 生词本 ============================ */

function VocabSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="生词本" onClose={onClose}>
      <StuckList />
    </Sheet>
  );
}

/* ============================ 自我检测 ============================ */

const QUIZ_N = 5;

function makeYueOptions(word: Word): string[] {
  const correct = word.yue;
  const distractors = shuffle(WORDS.filter((w) => w.id !== word.id && w.yue !== correct))
    .slice(0, 3)
    .map((w) => w.yue);
  return shuffle([correct, ...distractors]);
}

function QuizSheet({ onClose }: { onClose: () => void }) {
  const [queue, setQueue] = useState<Word[]>(() => shuffle(WORDS).slice(0, QUIZ_N));
  const [idx, setIdx] = useState(0);
  const [options, setOptions] = useState<string[]>(() => makeYueOptions(shuffle(WORDS)[0]));
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);

  const word = queue[idx];
  const done = idx >= queue.length;

  function start() {
    const q = shuffle(WORDS).slice(0, QUIZ_N);
    setQueue(q);
    setIdx(0);
    setPicked(null);
    setCorrect(0);
    setOptions(makeYueOptions(q[0]));
  }

  function answer(i: number) {
    if (picked !== null || !word) return;
    setPicked(i);
    const ok = options[i] === word.yue;
    if (ok) {
      markLearned(word.id);
      setCorrect((c) => c + 1);
    } else {
      markStuck(word.id);
    }
    setTimeout(() => {
      const ni = idx + 1;
      setIdx(ni);
      setPicked(null);
      if (ni < queue.length) setOptions(makeYueOptions(queue[ni]));
    }, ok ? 900 : 1400);
  }

  return (
    <Sheet title="自我检测" onClose={onClose}>
      {done ? (
        <div className="flex flex-col items-center gap-5 py-10">
          <div className="w-20 h-20 rounded-full bg-[#2B5CE6] flex items-center justify-center shadow-xl shadow-blue-200">
            <Check size={40} className="text-white" strokeWidth={3} />
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-[#1a1a2e]">检测完成</p>
            <p className="text-gray-500 text-sm mt-1">
              答对 {correct} / {queue.length} 题
            </p>
          </div>
          <div className="flex gap-3 w-full max-w-xs">
            <button
              onClick={start}
              className="flex-1 flex items-center justify-center gap-2 bg-[#2B5CE6] text-white px-6 py-3 rounded-xl font-bold active:scale-95"
            >
              <RotateCcw size={16} /> 再测一次
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-white border border-gray-200 text-[#1a1a2e] px-6 py-3 rounded-xl font-bold active:scale-95"
            >
              返回
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">
              第 {idx + 1} / {queue.length} 题 · 选释义对应的粤语词
            </span>
            <span className="text-xs text-[#2B5CE6] font-bold">已对 {correct}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2B5CE6] rounded-full transition-all duration-500"
              style={{ width: `${((idx + 1) / queue.length) * 100}%` }}
            />
          </div>
          <div className="bg-white rounded-3xl p-6 shadow-lg shadow-blue-100 text-center">
            <p className="text-gray-400 text-xs mb-3">「{word.man}」是哪个粤语词？</p>
            <div className="flex flex-col gap-2">
              {options.map((opt, i) => {
                const isCorrect = opt === word.yue;
                const isPicked = picked === i;
                let cls = "bg-[#f8faff] border-[#e8edff] text-[#1a1a2e]";
                if (picked !== null) {
                  if (isCorrect) cls = "bg-green-50 border-green-400 text-green-700";
                  else if (isPicked) cls = "bg-red-50 border-red-400 text-red-600";
                  else cls = "bg-[#f8faff] border-[#e8edff] text-gray-300";
                }
                return (
                  <button
                    key={i}
                    onClick={() => answer(i)}
                    className={`flex items-center justify-between px-5 py-3.5 rounded-2xl border-2 font-bold text-lg transition-all active:scale-[0.98] ${cls}`}
                  >
                    <span>{opt}</span>
                    {picked !== null && isCorrect && <Check size={20} className="text-green-500" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/* ============================ 粤语字典 ============================ */

function SearchSheet({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const kw = q.trim();
  const lower = kw.toLowerCase();

  // 1) 词典收录词条匹配（粤语词 / 粤拼 / 释义 / 例句）
  const wordHits = useMemo(() => {
    if (!kw) return [];
    return WORDS.filter(
      (w) =>
        w.yue.includes(kw) ||
        w.jyut.toLowerCase().includes(lower) ||
        w.man.includes(kw) ||
        shortMan(w.man).includes(kw) ||
        w.example.includes(kw) ||
        w.exampleMan.includes(kw)
    ).slice(0, 20);
  }, [kw, lower]);

  // 2) 普通话 → 粤语（整句 + 逐词）
  const trans = useMemo(() => (kw ? translate(kw) : []), [kw]);
  const transKnown = hasKnown(trans);
  const transYue = trans.map((s) => s.yue).join("");
  const transJyut = trans
    .map((s) => s.jyut)
    .filter(Boolean)
    .join(" ");

  // 3) 粤语 → 普通话（反向查询）
  const reverse = useMemo(() => (kw ? reverseLookup(kw) : []), [kw]);

  const nothing = !transKnown && reverse.length === 0 && wordHits.length === 0;

  return (
    <Sheet title="粤语字典" onClose={onClose}>
      {/* 搜索框 */}
      <div className="flex items-center gap-2 bg-white rounded-2xl px-3 py-2.5 mb-3 shadow-sm border border-[#e8edff]">
        <Search size={18} className="text-gray-400 flex-shrink-0" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="输入普通话或粤语，如：吃饭 / 食 / 嘅 / 唔該"
          className="flex-1 bg-transparent outline-none text-sm text-[#1a1a2e] placeholder:text-gray-300"
        />
        {q && (
          <button onClick={() => setQ("")} className="text-gray-400 text-xs flex-shrink-0 active:scale-90">
            清除
          </button>
        )}
      </div>

      {kw === "" ? (
        <div className="flex flex-col items-center gap-3 py-14">
          <div className="w-16 h-16 rounded-2xl bg-[#EEF3FF] flex items-center justify-center">
            <Search size={28} className="text-[#2B5CE6]" />
          </div>
          <p className="text-gray-500 text-sm font-medium">像查字典一样，双向检索</p>
          <div className="flex flex-col gap-1.5 text-xs text-gray-400 text-center">
            <p>· 普通话 → 粤语：输入「吃饭」得到「食飯」</p>
            <p>· 粤语 → 普通话：输入「嘅」得到「的」</p>
            <p>· 查词条：输入「唔該」看完整释义例句</p>
          </div>
        </div>
      ) : nothing ? (
        <div className="flex flex-col items-center gap-2 py-14">
          <p className="text-gray-400 text-sm">没找到「{kw}」相关的解释</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* 普通话 → 粤语 */}
          {transKnown && (
            <section>
              <p className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1">
                <Sparkles size={12} /> 普通话 → 粤语
              </p>
              <div className="bg-white rounded-2xl p-4 shadow-sm shadow-blue-50">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-2xl font-black text-[#1a1a2e] tracking-wide">{transYue}</p>
                    {transJyut && <p className="text-[#2B5CE6] text-xs font-mono mt-1">{transJyut}</p>}
                  </div>
                  <SoundButton text={transYue} size={22} className="w-12 h-12 flex-shrink-0" />
                </div>
                <div className="mt-3 pt-3 border-t border-gray-50 flex flex-col gap-1">
                  {trans.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400 w-14 flex-shrink-0">{s.man}</span>
                      <span className="text-gray-300">→</span>
                      <span className={`font-bold ${s.known ? "text-[#1a1a2e]" : "text-gray-300"}`}>{s.yue}</span>
                      {s.known && <span className="text-[#2B5CE6] text-xs font-mono">{s.jyut}</span>}
                      {s.known && <SoundButton text={s.yue} size={14} className="w-7 h-7 ml-auto" />}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* 粤语 → 普通话 */}
          {!transKnown && reverse.length > 0 && (
            <section>
              <p className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1">
                <BookOpen size={12} /> 粤语 → 普通话
              </p>
              <div className="flex flex-col gap-2">
                {reverse.map((r, i) => (
                  <div key={i} className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm shadow-blue-50">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#F5A623] to-[#ffc24b] flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-lg">{r.yue}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-gray-500 text-sm">{r.man}</span>
                      <span className="text-[#2B5CE6] text-xs font-mono ml-2">{r.jyut}</span>
                    </div>
                    <SoundButton text={r.yue} size={16} className="w-9 h-9 flex-shrink-0" />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 词典收录词条 */}
          {wordHits.length > 0 && (
            <section>
              <p className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1">
                <BookOpen size={12} /> 词典词条（{wordHits.length}）
              </p>
              <div className="flex flex-col gap-2">
                {wordHits.map((w) => (
                  <div key={w.id} className="bg-white rounded-2xl p-3.5 shadow-sm shadow-blue-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#2B5CE6] to-[#4a7cf7] flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-lg">{w.yue}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[#2B5CE6] text-sm font-mono font-medium">{w.jyut}</span>
                        <div className="text-gray-500 text-xs">{shortMan(w.man)}</div>
                      </div>
                      <SoundButton text={w.yue} size={16} className="w-9 h-9 flex-shrink-0" />
                    </div>
                    <div className="mt-2.5 bg-[#f8faff] rounded-xl px-3 py-2 flex items-start gap-2">
                      <p className="text-[#1a1a2e] text-xs leading-relaxed">{w.example}</p>
                      <SoundButton text={w.example} size={14} className="w-7 h-7 flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </Sheet>
  );
}

/* ============================ 通知 ============================ */

const NOTICES = [
  { icon: BookOpen, color: "#2B5CE6", title: "今日学习提醒", body: "还有 3 个词没记完，快去完成今日计划吧", time: "10:00" },
  { icon: Trophy, color: "#22c55e", title: "连续打卡 7 天", body: "你已连续学习 7 天，解锁「坚持」成就！", time: "昨天" },
  { icon: Sparkles, color: "#F5A623", title: "跟读训练上线", body: "听标准音 · 录音对比 · AI 评分，开口练粤语发音", time: "3 天前" },
  { icon: TrendingUp, color: "#a855f7", title: "周报", body: "本周累计学习 42 次，比上周提升 20%", time: "上周" },
];

function NotifySheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="通知" onClose={onClose}>
      <div className="flex flex-col gap-2">
        {NOTICES.map((n) => {
          const Icon = n.icon;
          return (
            <div key={n.title} className="bg-white rounded-2xl p-3 flex items-start gap-3 shadow-sm shadow-blue-50">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: n.color + "22" }}
              >
                <Icon size={20} style={{ color: n.color }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm text-[#1a1a2e]">{n.title}</p>
                  <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">{n.time}</span>
                </div>
                <p className="text-gray-500 text-xs mt-1 leading-relaxed">{n.body}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

/* ============================ 全部词汇 ============================ */

function AllWordsSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="全部词汇" onClose={onClose}>
      <p className="text-gray-400 text-xs mb-3">共 {WORDS.length} 个粤语词 · 点击喇叭发音</p>
      <div className="flex flex-col gap-4">
        {CATS.map((cat) => {
          const list = WORDS.filter((w) => w.cat === cat.id);
          if (!list.length) return null;
          return (
            <div key={cat.id}>
              <p className="text-sm font-bold text-[#1a1a2e] mb-2">
                {cat.icon} {cat.name}
                <span className="text-gray-400 text-xs font-normal ml-2">{list.length} 词</span>
              </p>
              <div className="flex flex-col gap-2">
                {list.map((w) => (
                  <div key={w.id} className="bg-white rounded-xl p-2.5 flex items-center gap-3 shadow-sm shadow-blue-50">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2B5CE6] to-[#4a7cf7] flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold">{w.yue}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[#2B5CE6] text-xs font-mono font-medium">{w.jyut}</span>
                      <div className="text-gray-500 text-xs truncate">{shortMan(w.man)}</div>
                    </div>
                    <SoundButton text={w.yue} size={14} className="w-8 h-8" />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

/* ============================ 汇总导出 ============================ */

export type SheetKind = "follow" | "practice" | "vocab" | "quiz" | "search" | "notify" | "all" | null;

export function HomeSheet({ kind, onClose }: { kind: SheetKind; onClose: () => void }) {
  if (kind === null) return null;
  switch (kind) {
    case "follow":
      return <FollowSheet onClose={onClose} />;
    case "practice":
      return <PracticeSheet onClose={onClose} />;
    case "vocab":
      return <VocabSheet onClose={onClose} />;
    case "quiz":
      return <QuizSheet onClose={onClose} />;
    case "search":
      return <SearchSheet onClose={onClose} />;
    case "notify":
      return <NotifySheet onClose={onClose} />;
    case "all":
      return <AllWordsSheet onClose={onClose} />;
    default:
      return null;
  }
}
