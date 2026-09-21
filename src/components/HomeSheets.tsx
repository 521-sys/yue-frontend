import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  RotateCcw,
  Search,
  Sparkles,
  TrendingUp,
  BookOpen,
  Trophy,
  Mic,
  Volume2,
  Play,
  Square,
  Send,
  Settings,
  Trash2,
} from "lucide-react";
import { FullPage, Sheet, SoundButton, StuckList } from "./Sheet";
import { markLearned, markStuck } from "../lib/store";
import { WORDS, CATS, Word, shortMan, shuffle, catOf } from "../data/words";
import { translate, reverseLookup, hasKnown } from "../data/dictionary";
import { speak, speakAiReply, stopSpeak } from "../lib/speech";
import { aiChat, isLoggedin, AUTH_CHANGED_EVENT } from "../lib/api";
import { AuthSheet } from "./AuthSheet";

/* ============================ AI语音（粤语 AI 助手） ============================ */

interface AiCfg {
  baseUrl: string;
  apiKey: string;
  model: string;
}

const CFG_KEY = "yueAiChatCfgV1";
const DEFAULT_CFG: AiCfg = {
  baseUrl: "https://api.deepseek.com/v1",
  apiKey: "",
  model: "deepseek-chat",
};

function loadCfg(): AiCfg {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) return { ...DEFAULT_CFG, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_CFG };
}

interface ChatMsg {
  role: "user" | "ai";
  yue: string;
  man?: string;
}

const WELCOME: ChatMsg = {
  role: "ai",
  yue: "哈佬！我係你嘅粤语AI老师～用粤语或者普通话同我倾偈，讲错唔紧要，我会教你点讲。",
  man: "你好！我是你的粤语AI老师～用粤语或普通话跟我聊天，说错没关系，我会教你怎么说。",
};

const SYS_PROMPT = [
  "你是一位亲切耐心的粤语老师，正在和一位普通话母语的初学者用粤语聊天练习。",
  "规则：每次回复先用简短自然的广州话口语说 1~2 句，然后另起一行用「普通话：」给出翻译。",
  "如果对方说了不地道的粤语，温和地示范正确说法；多围绕问候、饮食、购物、交通等日常场景引导对方开口。",
  "严格按以下格式回复，不要输出其他内容：",
  "粤语：……",
  "普通话：……",
].join("\n");

/* 未配置 API Key 时的本地简易应答，保证打开即可练 */
const FALLBACKS: { k: RegExp; yue: string; man: string }[] = [
  { k: /你好|哈佬|hello|hi/i, yue: "你好呀！今日过得点呀？想学啲乜嘢粤语？", man: "你好呀！今天过得怎么样？想学点什么粤语？" },
  { k: /多谢|唔该|thank/i, yue: "唔使客气！「多谢」用嚟谢人送嘢，「唔该」用嚟请人帮忙，好易分㗎。", man: "不客气！「多谢」用于谢人送东西，「唔该」用于请人帮忙，很好区分。" },
  { k: /食|饮|饿|饭|茶|餐/i, yue: "讲起食嘢，「唔该，一杯冻柠茶」呢句喺茶餐厅好常用，同我读一次啦！", man: "说起吃的，「麻烦来一杯冻柠茶」这句在茶餐厅很常用，跟我读一次吧！" },
  { k: /几多|几钱|价钱|平|贵/i, yue: "问价可以说「呢个几多钱？」，讲价就说「平啲啦！」，好实用㗎。", man: "问价可以说「这个多少钱？」，讲价就说「便宜点吧！」，很实用的。" },
  { k: /再见|拜拜|走/i, yue: "得闲饮茶！下次再同你练习啦～", man: "有空来喝茶！下次再跟你练习吧～" },
];

const LOCAL_GENERIC: ChatMsg[] = [
  { role: "ai", yue: "好呀！你可以问我「呢句粤语点讲？」，或者介绍下你今日做咗乜嘢～", man: "好呀！你可以问我「这句粤语怎么说？」，或者介绍下你今天做了什么～" },
  { role: "ai", yue: "唔使急，慢慢讲。讲错咗我会教你正确讲法㗎！试下同我打个招呼啦～", man: "不用急，慢慢说。说错了我也会教你正确说法！试着跟我打个招呼吧～" },
  { role: "ai", yue: "想学食嘢嘅粤语？「食飯未呀？」即系「吃饭了吗？」，好常用㗎！", man: "想学吃的粤语？「食饭未呀？」就是「吃饭了吗？」，很常用哦！" },
  { role: "ai", yue: "问路可以用「唔该，XX 点去呀？」例如「唔该，地铁站点去呀？」", man: "问路可以用「劳驾，XX 怎么去？」比如「请问地铁站怎么走？」" },
  { role: "ai", yue: "「早晨」系朝头早嘅问候，「午安」就系晏昼，黄昏后讲「晚安」都得㗎。", man: "「早晨」是早上的问候，「午安」是下午，黄昏后说「晚安」也可以。" },
  { role: "ai", yue: "你讲得唔错㗎！听多啲、讲多啲，粤语就会越嚟越顺。今日想学边方面呀？", man: "你说得不错哦！多听多说，粤语会越来越顺。今天想学哪方面呀？" },
  { role: "ai", yue: "想知某句普通话点讲粤语？直接打畀我，例如「谢谢」点讲？我会话你知！", man: "想知道某句普通话粤语怎么说？直接打给我，比如「谢谢」怎么说？我告诉你！" },
  { role: "ai", yue: "唔该同多谢点分？「唔该」系请人帮忙，「多谢」系收人礼物，记住咗未？", man: "「唔该」和「多谢」怎么分？「唔该」是请人帮忙，「多谢」是收人礼物，记住了吗？" },
];

/** 本地兜底回复：避免连续两次出现同一句 */
const lastGenericRef = { i: -1 };
function localReply(text: string): ChatMsg {
  const hit = FALLBACKS.find((f) => f.k.test(text));
  if (hit) return { role: "ai", yue: hit.yue, man: hit.man };
  let i = Math.floor(Math.random() * LOCAL_GENERIC.length);
  if (LOCAL_GENERIC.length > 1 && i === lastGenericRef.i) i = (i + 1) % LOCAL_GENERIC.length;
  lastGenericRef.i = i;
  return LOCAL_GENERIC[i];
}

/** 解析 AI 回复中的「粤语：/普通话：」两段 */
function parseReply(text: string): ChatMsg {
  const yueM = text.match(/粤语[:：]\s*([\s\S]*?)(?=\n\s*普通话[:：]|$)/);
  const manM = text.match(/普通话[:：]\s*([\s\S]*?)(?=\n\s*粤语[:：]|$)/);
  if (yueM) return { role: "ai", yue: yueM[1].trim(), man: manM ? manM[1].trim() : undefined };
  return { role: "ai", yue: text.trim() };
}

const SR: any =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

function AiChatSheet({ onClose }: { onClose: () => void }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const [cfg, setCfg] = useState<AiCfg>(loadCfg);
  const listRef = useRef<HTMLDivElement>(null);
  const recogRef = useRef<any>(null);
  const hasKey = cfg.apiKey.trim().length > 0;
  const [authed, setAuthed] = useState(isLoggedin());
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    const sync = () => setAuthed(isLoggedin());
    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (list && typeof list.scrollTo === "function") {
      list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
    }
  }, [msgs, sending]);

  function handleClose() {
    stopSpeak();
    onClose();
  }

  async function callAi(history: ChatMsg[]): Promise<ChatMsg> {
    const messages = [
      { role: "system", content: SYS_PROMPT },
      ...history.slice(-12).map((m) => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.man ? `粤语：${m.yue}\n普通话：${m.man}` : m.yue,
      })),
    ];
    let text = "";
    if (hasKey) {
      // 直连模式：用户自备 OpenAI 兼容接口
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30000);
      try {
        const res = await fetch(cfg.baseUrl.replace(/\/+$/, "") + "/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cfg.apiKey.trim()}`,
          },
          body: JSON.stringify({ model: cfg.model, messages, temperature: 0.7 }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        text = data.choices?.[0]?.message?.content ?? "";
      } finally {
        clearTimeout(timer);
      }
    } else {
      // 服务端代理：已登录用户无需自备 Key
      const data = await aiChat(messages);
      text = data.choices?.[0]?.message?.content ?? "";
    }
    if (!text.trim()) throw new Error("empty reply");
    return parseReply(text);
  }

  async function send(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || sending) return;
    setInput("");
    const history: ChatMsg[] = [...msgs, { role: "user", yue: text }];
    setMsgs(history);
    setSending(true);
    try {
      const reply = hasKey || authed ? await callAi(history) : localReply(text);
      setMsgs((prev) => [...prev, reply]);
      setTimeout(() => speakAiReply(reply.yue), 200);
    } catch (e) {
      const detail = e instanceof Error && e.message ? e.message : "";
      setMsgs((prev) => [
        ...prev,
        {
          role: "ai",
          yue: "唔好意思，我暫時聯絡唔上大腦，你遲啲再試下啦～",
          man: detail
            ? `AI 调用失败：${detail}`
            : "AI 调用失败，请检查网络或右上角设置里的接口配置。",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function toggleListen() {
    if (listening) {
      recogRef.current?.stop();
      setListening(false);
      return;
    }
    if (!SR) return;
    try {
      const r = new SR();
      r.lang = "zh-HK";
      r.interimResults = false;
      r.maxAlternatives = 1;
      r.onresult = (ev: any) => {
        const t = ev?.results?.[0]?.[0]?.transcript;
        if (t) send(t);
      };
      r.onend = () => setListening(false);
      r.onerror = () => setListening(false);
      recogRef.current = r;
      setListening(true);
      r.start();
    } catch {
      setListening(false);
    }
  }

  return (
    <FullPage
      title="AI语音助手"
      subtitle="粤语对话练习"
      onClose={handleClose}
      right={
        <>
          <button
            onClick={() => {
              stopSpeak();
              setMsgs([WELCOME]);
            }}
            className="w-8 h-8 rounded-full bg-white/15 text-white flex items-center justify-center active:scale-90 transition-transform"
            title="清空对话"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={() => setShowCfg((v) => !v)}
            className="w-8 h-8 rounded-full bg-white/15 text-white flex items-center justify-center active:scale-90 transition-transform"
            title="AI 接口设置"
          >
            <Settings size={14} />
          </button>
        </>
      }
    >
      <div className="flex-1 min-h-0 flex flex-col px-4">
        <div className="flex items-center justify-between mb-3 flex-shrink-0 pt-3">
          {hasKey ? (
            <span className="text-xs text-gray-400">直连 AI · {cfg.model}</span>
          ) : authed ? (
            <span className="text-xs text-gray-400">已连接 AI 老师（服务端）</span>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className="text-xs text-[#2B5CE6] bg-[#EEF3FF] px-2.5 py-1 rounded-full font-medium active:scale-95 transition-transform"
            >
              本地练习模式 · 点此登录，解锁 AI 老师
            </button>
          )}
        </div>

        {showCfg && (
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-3 flex flex-col gap-2 flex-shrink-0">
            <p className="text-xs text-gray-500 leading-relaxed">
              登录用户默认使用服务端 AI（无需 Key）。也可以填自己的 OpenAI 兼容接口（DeepSeek / 智谱 /
              通义等）直连，Key 仅保存在本机浏览器。
            </p>
            <input
              value={cfg.baseUrl}
              onChange={(e) => setCfg({ ...cfg, baseUrl: e.target.value })}
              placeholder="API 地址（以 /v1 结尾）"
              className="bg-[#f8faff] rounded-xl px-3 py-2 text-sm outline-none"
            />
            <input
              value={cfg.apiKey}
              onChange={(e) => setCfg({ ...cfg, apiKey: e.target.value })}
              type="password"
              placeholder="API Key"
              className="bg-[#f8faff] rounded-xl px-3 py-2 text-sm outline-none"
            />
            <input
              value={cfg.model}
              onChange={(e) => setCfg({ ...cfg, model: e.target.value })}
              placeholder="模型名"
              className="bg-[#f8faff] rounded-xl px-3 py-2 text-sm outline-none"
            />
            <button
              onClick={() => setShowCfg(false)}
              className="py-2 rounded-xl font-bold text-white text-sm active:scale-95 transition-transform"
              style={{ background: "linear-gradient(135deg, #2B5CE6, #4a7cf7)" }}
            >
              保存
            </button>
          </div>
        )}

        <div ref={listRef} className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto mb-2 pr-1">
          {msgs.map((m, i) =>
            m.role === "ai" ? (
              <div
                key={i}
                className="self-start max-w-[85%] bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm shadow-blue-50"
              >
                <p className="text-[#1a1a2e] text-sm leading-relaxed whitespace-pre-wrap">{m.yue}</p>
                {m.man && <p className="text-gray-400 text-xs mt-1.5 leading-relaxed">{m.man}</p>}
                <button
                  onClick={() => speakAiReply(m.yue)}
                  className="mt-2 flex items-center gap-1 text-[#2B5CE6] text-xs bg-[#EEF3FF] px-2.5 py-1 rounded-full active:scale-95 transition-transform"
                >
                  <Volume2 size={12} /> 再听一次
                </button>
              </div>
            ) : (
              <div
                key={i}
                className="self-end max-w-[85%] rounded-2xl rounded-br-md px-4 py-3 text-white text-sm leading-relaxed"
                style={{ background: "linear-gradient(135deg, #2B5CE6, #4a7cf7)" }}
              >
                {m.yue}
              </div>
            )
          )}
          {sending && (
            <div className="self-start bg-white rounded-2xl px-4 py-3 shadow-sm shadow-blue-50 text-gray-400 text-sm">
              AI 老师思考中…
            </div>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 px-4 pb-6 pt-1">
        <div className="flex items-center gap-2">
          {SR && (
            <button
              onClick={toggleListen}
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform ${
                listening ? "bg-red-500 animate-pulse" : "bg-white shadow-sm"
              }`}
              title={listening ? "停止录音" : "讲粤语"}
            >
              <Mic size={18} className={listening ? "text-white" : "text-[#2B5CE6]"} />
            </button>
          )}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder={listening ? "听到你讲嘢啦…" : "用粤语或普通话打字"}
            disabled={sending}
            className="flex-1 bg-white rounded-full px-4 py-2.5 text-sm text-[#1a1a2e] outline-none placeholder:text-gray-400 disabled:opacity-60"
          />
          <button
            onClick={() => send()}
            disabled={sending || !input.trim()}
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #2B5CE6, #4a7cf7)" }}
            title="发送"
          >
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>

      {showAuth && <AuthSheet onClose={() => setShowAuth(false)} />}
    </FullPage>
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
      <FullPage title="跟读训练" subtitle="听 · 读 · 评分" onClose={onClose}>
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <div className="flex flex-col items-center gap-4 py-2">
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
        </div>
      </FullPage>
    );
  }

  /* 完成 */
  if (done) {
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const recs = recCount - baseRec;
    return (
      <FullPage title="跟读训练" onClose={onClose}>
        <div className="flex-1 overflow-y-auto px-4 py-6">
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
        </div>
      </FullPage>
    );
  }

  /* 练习中 */
  return (
    <FullPage
      title="跟读训练"
      onClose={onClose}
      right={
        <span className="bg-white/15 rounded-xl px-3 py-1.5 text-white text-sm font-mono font-bold">
          {idx + 1} / {list.length}
        </span>
      }
    >
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">{it.src}</span>
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
      </div>
    </FullPage>
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
      return <AiChatSheet onClose={onClose} />;
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
