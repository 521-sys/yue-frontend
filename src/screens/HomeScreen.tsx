import { useState } from "react";
import { AudioLines, Mic, Sparkles } from "lucide-react";
import { HomeSheet } from "../components/HomeSheets";

export default function HomeScreen() {
  const [voiceOpen, setVoiceOpen] = useState(false);
  return (
    <div className="voice-home min-h-full flex flex-col px-7 pt-12 pb-10">
      <header className="flex items-center gap-2 text-[#21346b]">
        <span className="w-10 h-10 rounded-2xl bg-[#335eea] text-white flex items-center justify-center font-black text-xl">粤</span>
        <span className="text-lg font-bold tracking-tight">粤语开口练</span>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center text-center py-8">
        <div className="flex items-center gap-1.5 text-[#4969c7] text-sm font-semibold mb-5"><Sparkles size={15} /> AI 语音陪练</div>
        <h1 className="text-[32px] leading-tight font-black text-[#192b59]">开口讲，慢慢学。</h1>
        <p className="text-[#7180a0] text-sm mt-3 leading-6">用粤语或普通话说一句，AI 会陪你接着聊</p>
        <button type="button" onClick={() => setVoiceOpen(true)} aria-label="开始 AI 语音对话" className="voice-orb mt-12 w-52 h-52 rounded-full flex flex-col items-center justify-center text-white active:scale-95 transition-transform focus-visible:outline-4 focus-visible:outline-[#9cb2ff]">
          <Mic size={54} strokeWidth={1.8} /><span className="font-bold text-lg mt-3">开始对话</span>
        </button>
        <p className="mt-11 text-[#8490aa] text-xs flex items-center gap-2"><AudioLines size={16} /> 点击麦克风，开始练习</p>
      </main>
      <div className="rounded-2xl bg-white/65 border border-[#e6ebf8] px-4 py-3 text-center text-[#7c89a4] text-xs">每天几分钟，让粤语更自然</div>
      {voiceOpen && <HomeSheet kind="follow" onClose={() => setVoiceOpen(false)} />}
    </div>
  );
}
