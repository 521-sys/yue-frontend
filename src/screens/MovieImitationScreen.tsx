import { useEffect, useRef, useState } from "react";
import { Film, Mic, Play, RotateCcw, Square, VolumeX } from "lucide-react";

const lines = [
  { title: "街头相遇", mood: "惊喜 · 重逢", yue: "好耐冇見！你最近過成點呀？", man: "好久不见！你最近过得怎么样？" },
  { title: "勇敢表态", mood: "坚定 · 表达", yue: "我諗清楚喇，今次我一定會試。", man: "我想清楚了，这次我一定会试。" },
];

// 公开授权的粤语视频测试片段（VOA，来自 Wikimedia Commons）；后续可替换为自有电影素材。
const VIDEO_SRC = "https://commons.wikimedia.org/wiki/Special:FilePath/2018-09-13%20%E7%BE%8E%E5%9B%BD%E4%B9%8B%E9%9F%B3%E8%A7%86%E9%A2%91%E6%96%B0%E9%97%BB-%20%E7%BE%8E%E5%9B%BD%E4%B8%9C%E5%B2%B8%E5%B1%85%E6%B0%91%E9%A2%84%E5%A4%87%E4%BD%9B%E7%BD%97%E4%BC%A6%E6%96%AF%E9%A2%91%E9%A3%8E%E5%90%B9%E8%A2%AD.webm";

export default function MovieImitationScreen() {
  const [recording, setRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState("");
  const [videoMissing, setVideoMissing] = useState(false);
  const [videoSrc, setVideoSrc] = useState(VIDEO_SRC);
  const [importedVideo, setImportedVideo] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const line = lines[0];

  useEffect(() => () => { recorder.current?.stop(); }, []);

  async function toggleRecording() {
    if (recording) { recorder.current?.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      const media = new MediaRecorder(stream);
      media.ondataavailable = (event) => event.data.size && chunks.current.push(event.data);
      media.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const url = URL.createObjectURL(new Blob(chunks.current, { type: "audio/webm" }));
        setRecordedUrl((old) => { if (old) URL.revokeObjectURL(old); return url; });
        setRecording(false);
      };
      recorder.current = media;
      media.start();
      setRecording(true);
    } catch { setRecording(false); }
  }

  function importVideo(file?: File) {
    if (!file) return;
    setVideoSrc((old) => { if (old !== VIDEO_SRC) URL.revokeObjectURL(old); return URL.createObjectURL(file); });
    setImportedVideo(true);
    setVideoMissing(false);
  }

  return (
    <div className="min-h-full bg-[#f7f8fc] px-6 pt-12 pb-8 text-[#192b59]">
      <p className="text-[#617bd1] text-sm font-semibold">无声片段 · 你来配音</p>
      <h1 className="text-[30px] font-black mt-1">电影模仿</h1>
      <p className="text-[#8290aa] text-sm mt-2">看画面猜情绪，用自己的声音完成台词。</p>
      <div className="mt-7 rounded-[26px] overflow-hidden bg-[#18264d] aspect-video relative shadow-[0_14px_35px_rgba(28,49,104,.18)]">
        {!videoMissing ? <video className="w-full h-full object-cover" src={videoSrc} muted={!importedVideo} autoPlay loop playsInline controls onError={() => setVideoMissing(true)} /> : <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8 bg-gradient-to-br from-[#263d78] to-[#121c3b]"><div className="text-5xl mb-3">🎬</div><p className="text-white font-bold">视频片段加载失败</p><p className="text-white/60 text-xs mt-2">请导入本地视频继续配音</p></div>}
        <span className="absolute top-3 right-3 rounded-full bg-black/45 px-2.5 py-1 text-white text-[11px] flex items-center gap-1"><VolumeX size={13} /> {importedVideo ? "保留原声" : "已静音"}</span>
      </div>
      <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => importVideo(e.target.files?.[0])} />
      <button onClick={() => inputRef.current?.click()} className="mt-4 w-full rounded-xl bg-[#edf2ff] text-[#335eea] py-3 font-bold flex items-center justify-center gap-2"><Film size={18} />导入我的视频</button>
      <div className="mt-5 bg-white rounded-[24px] p-5 shadow-[0_12px_32px_rgba(31,57,120,.07)]"><div className="flex items-center justify-between"><span className="text-[#7f8da9] text-xs">配音台词 · {line.mood}</span><span className="text-[#a0a9bb] text-xs">跟着画面说</span></div><p className="text-xl font-bold leading-[1.5] mt-5">「{line.yue}」</p><p className="text-[#8b96ac] text-sm mt-2">{line.man}</p></div>
      <button onClick={toggleRecording} className={`mt-6 w-full rounded-2xl py-4 flex items-center justify-center gap-3 text-white font-bold shadow-lg ${recording ? "bg-[#e25d67]" : "bg-[#335eea]"}`}>{recording ? <><Square size={19} />停止配音</> : <><Mic size={21} />开始配音</>}</button>
      {recordedUrl && <div className="mt-4 flex items-center gap-3"><audio className="flex-1 h-9" controls src={recordedUrl} /><button onClick={() => setRecordedUrl("")} className="text-[#335eea] text-xs font-semibold flex items-center gap-1"><RotateCcw size={14} />重录</button></div>}
      <p className="mt-4 text-center text-[#8a95aa] text-xs flex items-center justify-center gap-1"><Play size={12} />视频始终静音，专心听自己的配音</p>
    </div>
  );
}
