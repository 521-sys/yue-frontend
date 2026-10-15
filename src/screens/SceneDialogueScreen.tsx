import { useEffect, useRef, useState } from "react";
import { Volume2, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Dialogue } from "../data/dialogues";
import { speak, stopSpeak, playSceneAudio } from "../lib/speech";
import { listPublishedScenes, getPublishedScene } from "../lib/scene-api";
import { aiChat } from "../lib/api";
import { dialoguePrompt, parseGeneratedDialogue, readCustomDialogues, saveCustomDialogue } from "../lib/dialogue-data";

export default function SceneDialogueScreen() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [custom, setCustom] = useState<Dialogue[]>([]);
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [official, setOfficial] = useState<Dialogue[]>([]);
  const [selected, setSelected] = useState<Dialogue>();
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  async function refresh() {
    const ticket=++sequence.current; setLoading(true); setError("");
    try { const items=await listPublishedScenes();if(ticket===sequence.current)setOfficial(items); }
    catch(e){if(ticket===sequence.current){setOfficial([]);setError(e instanceof Error?e.message:"场景读取失败");}}
    finally{if(ticket===sequence.current)setLoading(false);}
  }
  useEffect(() => {setCustom(readCustomDialogues());void refresh();return () => {sequence.current++;stopSpeak();};}, []);
  const all = [...official, ...custom.map(d=>({...d,id:'local:'+d.id}))];
  const dialogue: Dialogue | undefined = activeId?.startsWith('official:')?selected:all.find((d) => d.id === activeId);
  async function open(d:Dialogue){
    stopSpeak();setError('');if(!d.id.startsWith('official:')){setActiveId(d.id);return;}
    const ticket=++sequence.current;setLoading(true);setSelected(undefined);
    try{const fresh=await getPublishedScene(Number(d.id.slice(9)));if(ticket===sequence.current){setSelected(fresh);setActiveId(d.id);}}
    catch(e){if(ticket===sequence.current){setOfficial(items=>items.filter(s=>s.id!==d.id));setActiveId(null);setError(e instanceof Error?e.message:'场景读取失败');}}
    finally{if(ticket===sequence.current)setLoading(false);}
  }

  async function generate() {
    if (!topic.trim() || generating) return;
    setGenerating(true); setError("");
    try {
      const result = await aiChat([{ role: "system", content: dialoguePrompt(topic) }]);
      const raw = result.choices?.[0]?.message?.content || "";
      const d = parseGeneratedDialogue(raw);
      saveCustomDialogue(d); setCustom(readCustomDialogues()); setActiveId('local:'+d.id); setTopic("");
    } catch (e) { setError(e instanceof Error ? e.message : "生成失败，请稍后再试"); }
    finally { setGenerating(false); }
  }

  /* ---------- 对话详情 ---------- */
  if (dialogue) {
    return (
      <div className="flex flex-col h-full bg-[#f0f4ff]">
        <div
          className="px-4 pt-10 pb-5"
          style={{ background: "linear-gradient(160deg, #1a3fbf 0%, #2B5CE6 50%, #4a7cf7 100%)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => {stopSpeak();setSelected(undefined);setActiveId(null);void refresh();}}
              className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center active:scale-90 transition-transform"
            >
              <ChevronLeft size={18} className="text-white" />
            </button>
            <div>
              <p className="text-white font-bold text-lg leading-tight">
                {dialogue.emoji} {dialogue.title}
              </p>
              <p className="text-white/70 text-xs mt-0.5">
                {dialogue.place} · {dialogue.lines.length} 句 · 点击喇叭听发音
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 px-4 py-4 flex flex-col gap-3 overflow-y-auto">
          {dialogue.lines.map((line, i) => {
            const isA = line.speaker === "A";
            const roleName = isA ? dialogue.roles[0] : dialogue.roles[1];
            return (
              <div key={i} className={`flex flex-col ${isA ? "items-start" : "items-end"}`}>
                <span className="text-[10px] text-gray-400 mb-1 px-1">{roleName}</span>
                <div className={`flex items-end gap-2 max-w-[85%] ${isA ? "" : "flex-row-reverse"}`}>
                  <div
                    className={`px-4 py-3 rounded-2xl shadow-sm ${
                      isA
                        ? "bg-white rounded-tl-sm"
                        : "bg-gradient-to-br from-[#2B5CE6] to-[#4a7cf7] rounded-tr-sm"
                    }`}
                  >
                    <p
                      className={`font-bold text-base leading-snug ${
                        isA ? "text-[#1a1a2e]" : "text-white"
                      }`}
                    >
                      {line.yue}
                    </p>
                    {line.jyutping&&<p className={`text-xs mt-1 ${isA?'text-gray-500':'text-white/80'}`}>{line.jyutping}</p>}
                    <p className={`text-xs mt-1 ${isA ? "text-gray-400" : "text-white/70"}`}>
                      {line.man}
                    </p>
                  </div>
                  <button
                    onClick={() => line.audioUrl ? playSceneAudio(line.audioUrl) : speak(line.yue)}
                    className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform ${
                      isA ? "bg-[#EEF3FF]" : "bg-white/80"
                    }`}
                  >
                    <Volume2 size={16} className="text-[#2B5CE6]" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ---------- 场景列表 ---------- */
  return (
    <div className="flex flex-col h-full bg-[#f0f4ff]">
      <div
        className="px-4 pt-10 pb-6"
        style={{ background: "linear-gradient(160deg, #1a3fbf 0%, #2B5CE6 50%, #4a7cf7 100%)" }}
      >
        <p className="text-white/70 text-xs">跟住场景学地道粤语</p>
        <p className="text-white font-bold text-lg mt-0.5">场景对话</p>
        <div className="flex gap-2 mt-3">
          <span className="bg-white/15 text-white text-[11px] px-2.5 py-1 rounded-full">
            {all.length} 个场景
          </span>
          <span className="bg-white/15 text-white text-[11px] px-2.5 py-1 rounded-full">
            {all.reduce((n, d) => n + d.lines.length, 0)} 句对话练习
          </span>
        </div>
        <div className="mt-4 flex gap-2">
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="例如：在茶餐厅点餐" className="flex-1 rounded-xl px-3 py-2 text-sm outline-none" />
          <button onClick={generate} disabled={generating || !topic.trim()} className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-[#2B5CE6] disabled:opacity-50"><Sparkles size={15} className="inline mr-1" />{generating ? "生成中" : "AI生成"}</button>
        </div>
        {error && <div className="mt-2 text-xs text-red-100"><p role="alert">{error}</p><button onClick={()=>void refresh()}>重试</button></div>}
        {loading&&<p className="mt-2 text-xs text-white">正在加载场景…</p>}
      </div>

      <div className="flex-1 px-4 py-4 flex flex-col gap-3 overflow-y-auto">
        {!loading&&!error&&!official.length&&<p className="text-sm text-gray-500">暂无已发布的场景</p>}
        {all.map((d) => (
          <button
            key={d.id}
            disabled={loading}
            onClick={() => void open(d)}
            className="bg-white rounded-2xl p-4 shadow-sm shadow-blue-50 flex items-center gap-3 text-left transition-all active:scale-[0.98]"
          >
            <div className="w-12 h-12 rounded-xl bg-[#EEF3FF] flex items-center justify-center flex-shrink-0 text-2xl">
              {d.emoji}
            </div>
            <div className="flex-1">
              <p className="font-bold text-[#1a1a2e] text-base">{d.title}</p>
              <p className="text-gray-400 text-xs mt-0.5">
                {d.place} · {d.lines.length} 句 · {d.roles[0]} × {d.roles[1]}
              </p>
            </div>
            <ChevronRight size={18} className="text-gray-300" />
          </button>
        ))}
      </div>
    </div>
  );
}
