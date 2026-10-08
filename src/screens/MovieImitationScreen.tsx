import { useEffect, useRef, useState } from "react";
import { Film, Mic, RotateCcw, Square } from "lucide-react";

export default function MovieImitationScreen() {
  const [videoSrc, setVideoSrc] = useState("");
  const [recordedUrl, setRecordedUrl] = useState("");
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [videoMissing, setVideoMissing] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const mounted = useRef(true);
  const pending = useRef(false);
  const urls = useRef({ video: "", audio: "" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
      Object.values(urls.current).forEach((url) => { if (url) URL.revokeObjectURL(url); });
    };
  }, []);

  function clearRecording() {
    if (urls.current.audio) URL.revokeObjectURL(urls.current.audio);
    urls.current.audio = "";
    setRecordedUrl("");
  }

  function importVideo(file?: File) {
    if (!file || pending.current || recorder.current?.state === "recording") return;
    if (file.type && !file.type.startsWith("video/")) { setError("请选择视频文件"); return; }
    const url = URL.createObjectURL(file);
    if (urls.current.video) URL.revokeObjectURL(urls.current.video);
    urls.current.video = url;
    clearRecording();
    setVideoSrc(url); setTime(0); setDuration(0); setVideoMissing(false); setError("");
  }

  async function toggleRecording() {
    if (recorder.current?.state === "recording") { recorder.current.stop(); return; }
    if (pending.current || !videoSrc || videoMissing) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("当前浏览器不支持录音，请使用支持录音的浏览器并通过 HTTPS 打开。"); return;
    }
    pending.current = true; setStarting(true); setError("");
    let acquired: MediaStream | null = null;
    try {
      acquired = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { acquired.getTracks().forEach((track) => track.stop()); return; }
      stream.current = acquired;
      const media = new MediaRecorder(acquired);
      const chunks: Blob[] = [];
      let failed = false;
      media.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      media.onerror = () => {
        failed = true;
        acquired?.getTracks().forEach((track) => track.stop());
        if (timer.current) clearTimeout(timer.current);
        if (mounted.current) { setRecording(false); setError("录音失败，请重试。"); }
      };
      media.onstop = () => {
        acquired?.getTracks().forEach((track) => track.stop());
        if (timer.current) clearTimeout(timer.current);
        if (!mounted.current) return;
        setRecording(false);
        if (failed || !chunks.length) { setError("未获取到录音，请重试。"); return; }
        clearRecording();
        const url = URL.createObjectURL(new Blob(chunks, { type: media.mimeType || chunks[0].type }));
        urls.current.audio = url; setRecordedUrl(url);
      };
      recorder.current = media;
      media.start(); setRecording(true);
      timer.current = setTimeout(() => { if (media.state === "recording") media.stop(); }, 60000);
    } catch {
      acquired?.getTracks().forEach((track) => track.stop());
      if (mounted.current) { setRecording(false); setError("无法开始录音，请检查麦克风权限后重试。"); }
    } finally {
      pending.current = false;
      if (mounted.current) setStarting(false);
    }
  }

  return <div className="min-h-full bg-[#f7f8fc] px-6 pt-12 pb-8 text-[#192b59]">
    <p className="text-[#617bd1] text-sm font-semibold">导入片段 · 你来配音</p>
    <h1 className="text-[30px] font-black mt-1">电影模仿</h1>
    <p className="text-[#8290aa] text-sm mt-2">看画面猜情绪，用自己的声音完成台词。</p>
    <div className="mt-7 rounded-[26px] overflow-hidden bg-[#18264d] aspect-video relative">
      {videoSrc && !videoMissing ? <video ref={video} key={videoSrc} src={videoSrc} className="w-full h-full object-contain" playsInline controls onLoadedMetadata={(e) => { const d = e.currentTarget.duration; setDuration(Number.isFinite(d) ? d : 0); }} onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)} onError={() => { setVideoMissing(true); if (recorder.current?.state === "recording") recorder.current.stop(); }} /> : <div className="h-full flex items-center justify-center text-white/80 px-5 text-center">{videoMissing ? "视频无法播放，请换用浏览器支持的视频格式" : "请先导入一个视频"}</div>}
    </div>
    <input ref={input} aria-label="选择视频" type="file" accept="video/*" className="hidden" disabled={recording || starting} onChange={(e) => { importVideo(e.target.files?.[0]); e.target.value = ""; }} />
    <button disabled={recording || starting} onClick={() => input.current?.click()} className="mt-4 w-full rounded-xl bg-[#edf2ff] text-[#335eea] py-3 font-bold flex items-center justify-center gap-2 disabled:opacity-50"><Film size={18} />导入我的视频</button>
    <p className="mt-2 text-xs text-[#8290aa]">请选择已去掉台词、保留背景音的视频；导入后保留原声，可在播放器调节音量。</p>
    {videoSrc && !videoMissing && <div className="mt-3 flex items-center gap-3"><input aria-label="视频进度" type="range" className="flex-1 min-w-0 accent-[#335eea]" min={0} max={duration || 1} step={0.1} value={Math.min(time, duration || 1)} disabled={!duration} onChange={(e) => { const t = Number(e.target.value); if (video.current) video.current.currentTime = t; setTime(t); }} /><span className="text-xs text-[#8290aa]">{Math.floor(time)}s / {Math.floor(duration)}s</span></div>}
    <details className="mt-5 bg-white rounded-2xl p-4"><summary className="text-sm cursor-pointer">练习台词示例（与导入视频无关）</summary><p className="mt-3 font-bold">好耐冇見！你最近過成點呀？</p><p className="mt-1 text-sm text-[#8290aa]">好久不见！你最近过得怎么样？</p></details>
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    <button disabled={!videoSrc || videoMissing || starting} onClick={toggleRecording} className={`mt-6 w-full rounded-2xl py-4 flex items-center justify-center gap-3 text-white font-bold disabled:opacity-50 ${recording ? "bg-[#e25d67]" : "bg-[#335eea]"}`}>{recording ? <><Square size={19} />停止配音</> : <><Mic size={21} />{starting ? "正在开启麦克风" : "开始配音"}</>}</button>
    {recordedUrl && !recording && <div className="mt-4"><p className="text-xs mb-2">我的配音</p><div className="flex items-center gap-3"><audio aria-label="我的配音" className="flex-1 min-w-0 h-9" controls src={recordedUrl} onPlay={() => video.current?.pause()} /><button onClick={clearRecording} className="text-[#335eea] text-xs flex items-center gap-1"><RotateCcw size={14} />重录</button></div></div>}
    <p className="mt-4 text-center text-[#8a95aa] text-xs">每次最多录制 60 秒。视频和录音仅在当前页面使用。建议戴耳机配音。</p>
  </div>;
}
