import { useEffect, useRef, useState } from "react";
import { Film, Mic, RotateCcw, Square } from "lucide-react";
import { activeCueAt, cueIsValid, recordingWindow, parseSrt, serializeSrt, type DubbingCue } from "../lib/dubbing-timeline";
import { loadDubbingProject, saveDubbingProject, type DubbingProject } from "../lib/dubbing-project";
import { DubbingPreview } from "../lib/dubbing-preview";
import { transcribeLocalVideo } from "../lib/local-transcription";
import { transcribeCloudVideo } from "../lib/cloud-transcription";
import { type DubbingMaterial, type DubbingMaterialPart } from "../data/dubbing-materials";
import { loadDubbingMaterials } from "../lib/dubbing-materials-api";

const cloudTranscription = import.meta.env.PROD || import.meta.env.VITE_DUBBING_ASR_PROVIDER === "tencent";

interface MovieImitationScreenProps {
  materials?: DubbingMaterial[];
  loadProject?: typeof loadDubbingProject;
  saveProject?: typeof saveDubbingProject;
}

export default function MovieImitationScreen({
  materials: providedMaterials,
  loadProject = loadDubbingProject,
  saveProject = saveDubbingProject,
}: MovieImitationScreenProps) {
  const [remoteMaterials, setRemoteMaterials] = useState<DubbingMaterial[]>([]);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "error">(providedMaterials === undefined ? "loading" : "ready");
  const [catalogError, setCatalogError] = useState("");
  const [catalogRetry, setCatalogRetry] = useState(0);
  const materials = providedMaterials ?? remoteMaterials;
  const [storageReady, setStorageReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState("正在读取本机作品…");
  const [saveFailed, setSaveFailed] = useState(false);
  const [saveRetry, setSaveRetry] = useState(0);
  const mediaBlobs = useRef({ background: null as Blob | null, takes: {} as Record<string, Blob> });
  const loadRevision = useRef(0);
  const deferredBuiltInDraft = useRef<Extract<DubbingProject, {version: 2}> | null>(null);
  const saveRevision = useRef(0);
  const storageRevision = useRef<string | undefined>(undefined);
  const [videoSrc, setVideoSrc] = useState("");
  const [backgroundSrc, setBackgroundSrc] = useState("");
  const [backgroundName, setBackgroundName] = useState("");
  const [cues, setCues] = useState<DubbingCue[]>([]);
  const [selectedCueId, setSelectedCueId] = useState("");
  const [takeUrls, setTakeUrls] = useState<Record<string, string>>({});
  const [playVideoAudio, setPlayVideoAudio] = useState(true);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const preview = useRef<DubbingPreview | null>(null);
  const takeStarts = useRef<Record<string, number>>({});
  const takePlayer = useRef<HTMLAudioElement>(null);
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const cancelPreparation = useRef<(() => void) | null>(null);
  const [error, setError] = useState("");
  const [videoMissing, setVideoMissing] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState("正在识别");
  const [importingSubtitles, setImportingSubtitles] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [selectedPartId, setSelectedPartId] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const subtitleReadPending = useRef(false);
  const videoFile = useRef<File | null>(null);
  const transcription = useRef<AbortController | null>(null);
  const transcriptionSequence = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const subtitleInput = useRef<HTMLInputElement>(null);
  const backgroundInput = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const background = useRef<HTMLAudioElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const mounted = useRef(true);
  const pending = useRef(false);
  const urls = useRef({ video: "", background: "", takes: {} as Record<string, string> });
  const recordingCueId = useRef("");
  const recordingEndMs = useRef(0);
  const recordingInterrupted = useRef(false);
  const previousVideoMuted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function restoreDraft(draft: DubbingProject, builtIn?: {material: DubbingMaterial; part: DubbingMaterialPart}) {
    storageRevision.current = draft.storageRevision;
    if (draft.version === 1) {
      videoFile.current = new File([draft.video], draft.videoName, { type: draft.video.type });
      urls.current.video = URL.createObjectURL(draft.video);
      setVideoSrc(urls.current.video);
    } else {
      if (!builtIn) return;
      videoFile.current = null;
      setSelectedMaterialId(builtIn.material.id); setSelectedPartId(builtIn.part.id);
      setVideoSrc(builtIn.part.videoSrc);
    }
    urls.current.background = draft.background ? URL.createObjectURL(draft.background) : "";
    mediaBlobs.current = { background: draft.background, takes: {} };
    for (const [id, take] of Object.entries(draft.takes)) {
      mediaBlobs.current.takes[id] = take.blob;
      takeStarts.current[id] = take.startMs;
      urls.current.takes[id] = URL.createObjectURL(take.blob);
    }
    setBackgroundSrc(urls.current.background);
    setBackgroundName(draft.backgroundName); setCues(draft.cues);
    setTakeUrls({ ...urls.current.takes }); setSelectedCueId(draft.selectedCueId);
    setPlayVideoAudio(draft.playVideoAudio); setAutoAdvance(draft.autoAdvance);
    setEditorOpen(true); setSaveStatus("已恢复本机作品"); setStorageReady(true);
  }

  useEffect(() => {
    if (providedMaterials !== undefined) { setCatalogState("ready"); setCatalogError(""); return; }
    const controller = new AbortController();
    setCatalogState("loading"); setCatalogError("");
    void loadDubbingMaterials(controller.signal).then((items) => {
      if (controller.signal.aborted) return;
      setRemoteMaterials(items); setCatalogState("ready");
    }).catch((cause) => {
      if (controller.signal.aborted) return;
      setCatalogError(cause instanceof Error ? cause.message : "电影配音素材加载失败，请稍后重试");
      setCatalogState("error");
    });
    return () => controller.abort();
  }, [providedMaterials, catalogRetry]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelPreparation.current?.();
      preview.current?.dispose();
      transcriptionSequence.current += 1;
      transcription.current?.abort();
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
      if (urls.current.video) URL.revokeObjectURL(urls.current.video);
      if (urls.current.background) URL.revokeObjectURL(urls.current.background);
      Object.values(urls.current.takes).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const revision = loadRevision.current;
    void loadProject().then((draft) => {
      if (cancelled || revision !== loadRevision.current) return;
      if (!draft) { setSaveStatus("导入视频后自动保存到当前浏览器"); setStorageReady(true); return; }
      if (draft.version === 1) { restoreDraft(draft); return; }
      const material = materials.find((item) => item.id === draft.source.materialId);
      const part = material?.parts.find((item) => item.id === draft.source.partId);
      if (material && part) { restoreDraft(draft, {material, part}); return; }
      if (providedMaterials === undefined && catalogState !== "ready") {
        deferredBuiltInDraft.current = draft;
        setSaveStatus("正在加载素材，以恢复上次的内置配音作品…");
        return;
      }
      setSaveStatus("上次使用的内置素材当前不可用，请重新选择素材。");
      setStorageReady(true);
    }).catch(() => {
      if (cancelled || revision !== loadRevision.current) return;
      setSaveStatus("无法读取本机作品。可重新打开页面重试；导入新视频将开始新的保存。");
      setSaveFailed(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const draft = deferredBuiltInDraft.current;
    if (!draft || catalogState !== "ready") return;
    const material = materials.find((item) => item.id === draft.source.materialId);
    const part = material?.parts.find((item) => item.id === draft.source.partId);
    deferredBuiltInDraft.current = null;
    if (!material || !part) {
      setSaveStatus("上次使用的内置素材当前不可用，请重新选择素材。");
      setStorageReady(true);
      return;
    }
    restoreDraft(draft, {material, part});
  }, [catalogState, materials]);

  useEffect(() => {
    if (!storageReady || (!videoFile.current && (!selectedMaterialId || !selectedPartId))) return;
    const revision = ++saveRevision.current;
    const takes = Object.fromEntries(Object.entries(mediaBlobs.current.takes).map(([id, blob]) => [id, { blob, startMs: takeStarts.current[id] ?? 0 }]));
    setSaveStatus("正在保存到当前浏览器，请稍候再关闭页面…"); setSaveFailed(false);
    const common = { background: mediaBlobs.current.background, backgroundName, cues, takes, selectedCueId, playVideoAudio, autoAdvance };
    const project = videoFile.current
      ? { version: 1 as const, video: videoFile.current, videoName: videoFile.current.name, ...common }
      : { version: 2 as const, source: { kind: "built-in" as const, materialId: selectedMaterialId, partId: selectedPartId }, ...common };
    void saveProject(project, storageRevision).then(() => {
      if (mounted.current && revision === saveRevision.current) setSaveStatus("已保存到当前浏览器");
    }).catch((cause) => {
      if (mounted.current && revision === saveRevision.current) {
        setSaveFailed(true); setSaveStatus(cause instanceof Error && cause.message.includes("另一页面") ? cause.message : "保存失败，可能是空间不足或浏览器限制。当前更改尚未保存，请勿关闭页面。");
      }
    });
  }, [storageReady, videoSrc, backgroundSrc, backgroundName, cues, takeUrls, selectedCueId, playVideoAudio, autoAdvance, selectedMaterialId, selectedPartId, saveRetry]);

  function clearRecording(cueId: string) {
    stopPreview();
    delete takeStarts.current[cueId];
    delete mediaBlobs.current.takes[cueId];
    const url = urls.current.takes[cueId];
    if (url) URL.revokeObjectURL(url);
    delete urls.current.takes[cueId];
    setTakeUrls({ ...urls.current.takes });
  }

  function clearAllRecordings() {
    stopPreview();
    takeStarts.current = {};
    mediaBlobs.current.takes = {};
    Object.values(urls.current.takes).forEach((url) => URL.revokeObjectURL(url));
    urls.current.takes = {};
    setTakeUrls({});
  }

  function importVideo(file?: File) {
    if (!file || pending.current || recorder.current?.state === "recording") return;
    if (file.type && !file.type.startsWith("video/")) { setError("请选择视频文件"); return; }
    transcriptionSequence.current += 1;
    transcription.current?.abort();
    transcription.current = null;
    setTranscribing(false);
    loadRevision.current += 1;
    deferredBuiltInDraft.current = null;
    setStorageReady(true);
    mediaBlobs.current.background = null;
    videoFile.current = file;
    stopPreview();
    const url = URL.createObjectURL(file);
    if (urls.current.video) URL.revokeObjectURL(urls.current.video);
    if (urls.current.background) URL.revokeObjectURL(urls.current.background);
    urls.current.video = url;
    urls.current.background = "";
    clearAllRecordings();
    setCues([]); setSelectedCueId("");
    setBackgroundSrc(""); setBackgroundName("");
    setVideoSrc(url); setTime(0); setDuration(0); setVideoMissing(false); setError("");
    setSelectedMaterialId(""); setSelectedPartId(""); setEditorOpen(true); setCatalogOpen(false);
  }

  function selectBuiltInPart(material: DubbingMaterial, part: DubbingMaterialPart) {
    if (recording || starting || preparing || transcribing || importingSubtitles || previewing || pending.current || recorder.current?.state === "recording") return;
    if (material.id === selectedMaterialId && part.id === selectedPartId) {
      if (catalogOpen) { setCatalogOpen(false); setEditorOpen(false); }
      return;
    }
    const currentPart = materials.find((item) => item.id === selectedMaterialId)?.parts.find((item) => item.id === selectedPartId);
    const changed = Object.keys(takeUrls).length > 0 || Boolean(backgroundSrc) || Boolean(currentPart && JSON.stringify(cues) !== JSON.stringify(currentPart.cues));
    if (currentPart && changed && !globalThis.confirm("切换片段会清空当前片段的录音和台词修改，是否继续？")) return;
    transcriptionSequence.current += 1;
    transcription.current?.abort();
    transcription.current = null;
    setTranscribing(false);
    loadRevision.current += 1;
    deferredBuiltInDraft.current = null;
    setStorageReady(true);
    videoFile.current = null;
    stopPreview();
    if (urls.current.video) URL.revokeObjectURL(urls.current.video);
    if (urls.current.background) URL.revokeObjectURL(urls.current.background);
    urls.current.video = "";
    urls.current.background = "";
    mediaBlobs.current.background = null;
    clearAllRecordings();
    const nextCues = part.cues.map((cue) => ({ ...cue }));
    setCues(nextCues);
    setSelectedCueId(nextCues[0]?.id ?? "");
    setBackgroundSrc(""); setBackgroundName("");
    setVideoSrc(part.videoSrc); setTime(0); setDuration(0); setVideoMissing(false); setError("");
    setSelectedMaterialId(material.id); setSelectedPartId(part.id); setEditorOpen(false); setCatalogOpen(false);
  }

  function importBackground(file?: File) {
    if (!file || pending.current || recorder.current?.state === "recording") return;
    if (file.type && !file.type.startsWith("audio/")) { setError("请选择音频文件"); return; }
    stopPreview();
    const url = URL.createObjectURL(file);
    if (urls.current.background) URL.revokeObjectURL(urls.current.background);
    mediaBlobs.current.background = file;
    urls.current.background = url;
    setBackgroundSrc(url); setBackgroundName(file.name); setError("");
  }

  async function importSubtitles(file?: File) {
    if (!file || transcription.current || subtitleReadPending.current) return;
    subtitleReadPending.current = true;
    setImportingSubtitles(true);
    const sequence = transcriptionSequence.current;
    try {
      const imported = parseSrt(await file.text());
      if (!mounted.current || sequence !== transcriptionSequence.current) return;
      clearAllRecordings();
      setCues(imported);
      setSelectedCueId(imported[0].id);
      setError("");
    } catch (cause) {
      if (mounted.current && sequence === transcriptionSequence.current) {
        setError(cause instanceof Error ? cause.message : "字幕读取失败，请选择 SRT 文件");
      }
    } finally {
      subtitleReadPending.current = false;
      if (mounted.current) setImportingSubtitles(false);
    }
  }

  async function handleAutoTranscribe() {
    const file = videoFile.current;
    if (!file || !duration || videoMissing || recording || starting || pending.current || transcription.current || subtitleReadPending.current) return;
    if (duration > 300 || file.size > 200 * 1024 * 1024) { setError("请导入 5 分钟以内、最大 200 MB 的视频"); return; }
    const replace = cues.length || Object.keys(urls.current.takes).length;
    const confirmation = [cloudTranscription ? "视频将上传至应用服务器，音频发送腾讯云识别粤语。" : "", replace ? "新结果将替换当前台词及对应录音。" : ""].filter(Boolean).join("\n");
    if (confirmation && !window.confirm(`${confirmation}\n是否继续？`)) return;
    const controller = new AbortController();
    transcription.current = controller;
    const sequence = ++transcriptionSequence.current;
    setTranscribing(true);
    setError("");
    try {
      const result = cloudTranscription
        ? await transcribeCloudVideo(file, controller.signal, (message) => { if (mounted.current && sequence === transcriptionSequence.current) setTranscriptionProgress(message); })
        : await transcribeLocalVideo(file, controller.signal);
      if (!mounted.current || sequence !== transcriptionSequence.current) return;
      if (!result.length) { setError("未识别到台词，请确认视频有人声，或手动新增/导入 SRT"); return; }
      const imported = result.map((cue, index) => ({ ...cue, id: `cue-${index + 1}` }));
      clearAllRecordings();
      setCues(imported);
      setSelectedCueId(imported[0].id);
    } catch (cause) {
      if (mounted.current && sequence === transcriptionSequence.current && !controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "识别失败，请重试");
      }
    } finally {
      if (mounted.current && sequence === transcriptionSequence.current) {
        transcription.current = null;
        setTranscribing(false);
      }
    }
  }

  function updateCue(id: string, patch: Partial<DubbingCue>) {
    setCues((items) => items.map((cue) => cue.id === id ? { ...cue, ...patch } : cue));
  }

  function addCue() {
    const startMs = Math.round((video.current?.currentTime || 0) * 1000);
    const endMs = Math.min(Math.round(duration * 1000) || startMs + 3000, startMs + 3000);
    const id = `cue-${Date.now()}`;
    setCues((items) => [...items, { id, startMs, endMs: Math.max(startMs + 100, endMs), text: "新台词" }].sort((a, b) => a.startMs - b.startMs));
    setSelectedCueId(id);
  }

  function deleteCue(id: string) {
    if (recording || starting || pending.current) return;
    if (takeUrls[id] && !window.confirm("这句已有录音，删除台词也会删除录音。确定删除吗？")) return;
    const index = cues.findIndex((cue) => cue.id === id);
    if (index < 0) return;
    if (takeUrls[id]) clearRecording(id);
    setCues((items) => items.filter((cue) => cue.id !== id));
    if (selectedCueId === id) setSelectedCueId(cues[index + 1]?.id ?? cues[index - 1]?.id ?? "");
  }

  function selectCue(cue: DubbingCue) {
    setSelectedCueId(cue.id);
    if (video.current) { video.current.pause(); video.current.currentTime = cue.startMs / 1000; }
    if (background.current) { background.current.pause(); background.current.currentTime = cue.startMs / 1000; }
    setTime(cue.startMs / 1000);
  }

  function downloadSubtitles() {
    const url = URL.createObjectURL(new Blob([serializeSrt(cues)], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "粤语配音字幕.srt"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function restoreVideoAudio() {
    if (video.current) video.current.muted = previousVideoMuted.current;
    background.current?.pause();
  }

  function syncBackgroundPosition(currentVideo: HTMLVideoElement) {
    if (preview.current) return;
    if (!background.current || !backgroundSrc) return;
    background.current.playbackRate = currentVideo.playbackRate;
    if (Math.abs(background.current.currentTime - currentVideo.currentTime) > 0.15) {
      background.current.currentTime = currentVideo.currentTime;
    }
  }

  function syncPlaybackAudio(currentVideo: HTMLVideoElement) {
    if (preview.current) return;
    currentVideo.muted = !playVideoAudio;
    if (playVideoAudio || !backgroundSrc) { background.current?.pause(); return; }
    syncBackgroundPosition(currentVideo);
    if (!currentVideo.paused && background.current) {
      void background.current.play().catch(() => setError("背景音无法播放，请检查音频格式。"));
    }
  }

  function interruptRecording() {
    if (recorder.current?.state !== "recording") return;
    recordingInterrupted.current = true;
    recorder.current.stop();
    video.current?.pause();
  }

  function stopPreview() {
    preview.current?.dispose();
    preview.current = null;
    if (mounted.current) setPreviewing(false);
  }

  async function togglePreview() {
    if (preview.current) { stopPreview(); return; }
    if (!video.current || recording || pending.current || transcribing || importingSubtitles) return;
    const tracks = cues.filter((cue) => takeUrls[cue.id] && cueIsValid(cue, duration * 1000)).map((cue) => ({
      cueStartMs: cue.startMs, cueEndMs: cue.endMs,
      recordedStartMs: takeStarts.current[cue.id] ?? Math.max(0, cue.startMs - 1000),
      audio: new Audio(takeUrls[cue.id]),
    }));
    if (!tracks.length) { setError("请先录好至少一句配音"); return; }
    takePlayer.current?.pause();
    setError("");
    const controller = new DubbingPreview(video.current, tracks, backgroundSrc ? background.current : null,
      () => { stopPreview(); setError("配音预览播放失败，请检查视频、录音或背景音后重试。"); },
      stopPreview);
    preview.current = controller;
    setPreviewing(true);
    await controller.start();
  }

  async function toggleRecording() {
    if (recorder.current?.state === "recording") { recorder.current.stop(); video.current?.pause(); background.current?.pause(); return; }
    if (preview.current) return;
    takePlayer.current?.pause();
    const selectedCue = cues.find((cue) => cue.id === selectedCueId);
    if (pending.current || transcription.current || !videoSrc || videoMissing || !selectedCue) return;
    if (!cueIsValid(selectedCue, duration * 1000)) { setError("请先校正这句台词的时间和内容"); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("当前浏览器不支持录音，请使用支持录音的浏览器并通过 HTTPS 打开。"); return;
    }
    pending.current = true; setStarting(true); setError("");
    video.current?.pause();
    background.current?.pause();
    let acquired: MediaStream | null = null;
    try {
      acquired = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { acquired.getTracks().forEach((track) => track.stop()); return; }
      stream.current = acquired;
      const media = new MediaRecorder(acquired);
      recordingCueId.current = selectedCue.id;
      const { startMs, endMs, preparationMs } = recordingWindow(selectedCue, cues, duration * 1000);
      recordingEndMs.current = endMs;
      recordingInterrupted.current = false;
      let takeStartMs = startMs;
      const chunks: Blob[] = [];
      let failed = false;
      media.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      media.onerror = () => {
        failed = true;
        acquired?.getTracks().forEach((track) => track.stop());
        if (timer.current) clearTimeout(timer.current);
        restoreVideoAudio();
        if (mounted.current) { setRecording(false); setError("录音失败，请重试。"); }
      };
      media.onstop = () => {
        acquired?.getTracks().forEach((track) => track.stop());
        if (timer.current) clearTimeout(timer.current);
        restoreVideoAudio();
        if (!mounted.current) return;
        setRecording(false);
        if (recordingInterrupted.current) { setError("视频播放中断或进度改变，本次录音未保存，请重录这句。"); return; }
        if (failed || !chunks.length) { setError("未获取到录音，请重试。"); return; }
        const cueId = recordingCueId.current;
        clearRecording(cueId);
        const blob = new Blob(chunks, { type: media.mimeType || chunks[0].type });
        mediaBlobs.current.takes[cueId] = blob;
        const url = URL.createObjectURL(blob);
        takeStarts.current[cueId] = takeStartMs;
        urls.current.takes[cueId] = url; setTakeUrls({ ...urls.current.takes });
        if (autoAdvance) {
          const nextCue = cues[cues.findIndex((cue) => cue.id === cueId) + 1];
          if (nextCue) selectCue(nextCue);
        }
      };
      recorder.current = media;
      if (video.current) {
        previousVideoMuted.current = video.current.muted;
        video.current.playbackRate = 1;
        video.current.currentTime = startMs / 1000;
        video.current.muted = !playVideoAudio;
      }
      setTime(startMs / 1000);
      if (background.current && backgroundSrc) background.current.currentTime = startMs / 1000;
      const currentVideo = video.current;
      if (currentVideo?.seeking) await new Promise<void>((resolve, reject) => {
        const finish = () => { clearTimeout(timeout); currentVideo.removeEventListener("seeked", finish); resolve(); };
        const timeout = setTimeout(() => { currentVideo.removeEventListener("seeked", finish); reject(new Error("Seek timed out")); }, 5000);
        currentVideo.addEventListener("seeked", finish, { once: true });
      });
      if (!mounted.current) { acquired.getTracks().forEach((track) => track.stop()); return; }
      if (preparationMs) {
        setPreparing(true);
        await new Promise<void>((resolve) => {
          const finish = () => { clearTimeout(preparationTimer); cancelPreparation.current = null; resolve(); };
          const preparationTimer = setTimeout(finish, preparationMs);
          cancelPreparation.current = finish;
        });
        if (!mounted.current) { acquired.getTracks().forEach((track) => track.stop()); return; }
        setPreparing(false);
      }
      const playback = [video.current?.play()];
      if (!playVideoAudio && backgroundSrc && background.current) playback.push(background.current.play());
      await Promise.all(playback);
      if (!mounted.current) { acquired.getTracks().forEach((track) => track.stop()); currentVideo?.pause(); return; }
      takeStartMs = (currentVideo?.currentTime ?? startMs / 1000) * 1000;
      media.start(); setRecording(true);
      timer.current = setTimeout(() => { if (media.state === "recording") media.stop(); video.current?.pause(); background.current?.pause(); }, Math.max(0, Math.min(62000, endMs - takeStartMs)));
    } catch {
      video.current?.pause();
      acquired?.getTracks().forEach((track) => track.stop());
      restoreVideoAudio();
      if (mounted.current) { setRecording(false); setError("无法开始录音，请检查麦克风权限及视频或背景音能否播放。"); }
    } finally {
      pending.current = false;
      if (mounted.current) { setStarting(false); setPreparing(false); }
    }
  }

  const selectedCue = cues.find((cue) => cue.id === selectedCueId);
  const recordedUrl = selectedCue ? takeUrls[selectedCue.id] : "";
  const activeCue = activeCueAt(cues, time * 1000);
  const highlightedCueId = activeCue?.id;
  const selectedMaterial = materials.find((material) => material.id === selectedMaterialId);
  const selectedPart = selectedMaterial?.parts.find((part) => part.id === selectedPartId);
  const partSwitchDisabled = recording || starting || preparing || transcribing || importingSubtitles || previewing;
  const previewCueText = activeCue?.text ?? (time === 0 ? selectedPart?.cues[0]?.text : undefined);

  if (catalogOpen || !videoSrc) return <div className="min-h-full bg-[#f7f8fc] px-6 pt-12 pb-28 text-[#192b59]">
    <p className="text-[#617bd1] text-sm font-semibold">选一段 · 你来配音</p>
    <h1 className="text-[30px] font-black mt-1">电影模仿</h1>
    {saveFailed && <div role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
      <p>{saveStatus}</p>
      {storageReady && <button className="mt-2 font-bold text-[#335eea]" onClick={() => setSaveRetry((value) => value + 1)}>重试保存</button>}
    </div>}
    <section className="mt-8" aria-labelledby="built-in-dubbing-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="built-in-dubbing-heading" className="text-xl font-black">内置粤语片段</h2>
        <span className="text-xs text-[#8290aa]">只收录已核验素材</span>
      </div>
      {providedMaterials === undefined && catalogState === "loading" && <p role="status" className="mt-4 rounded-2xl bg-white p-5 text-sm text-[#66758f] shadow-sm border border-[#e6ebf4]">正在加载粤语片段…</p>}
      {providedMaterials === undefined && catalogState === "error" && <div role="alert" className="mt-4 rounded-2xl bg-red-50 p-5 text-sm text-red-700 border border-red-100"><p>{catalogError}</p><button className="mt-3 font-bold text-[#335eea]" onClick={() => setCatalogRetry((value) => value + 1)}>重试加载素材</button></div>}
      {catalogState === "ready" && materials.length ? <div className="mt-4 grid gap-3">
        {materials.map((material) => <button key={material.id} onClick={() => material.parts[0] && selectBuiltInPart(material, material.parts[0])} disabled={!material.parts.length} className="rounded-2xl bg-white p-4 text-left shadow-sm border border-[#e6ebf4] disabled:opacity-50">
          <span className="block font-black text-lg">{material.title}</span>
          <span className="mt-2 block text-xs text-[#8290aa]">{material.parts.length} 个片段 · 难度 {material.difficulty}</span>
          <span className="mt-3 flex flex-wrap gap-2">{material.tags.map((tag) => <span key={tag} className="rounded-full bg-[#eaf8ef] px-3 py-1 text-xs font-semibold text-[#259653]">{tag}</span>)}</span>
        </button>)}
      </div> : catalogState === "ready" && <div className="mt-4 rounded-2xl bg-white p-5 text-sm text-[#66758f] shadow-sm border border-[#e6ebf4]">暂时没有已发布的粤语片段，请稍后再来。</div>}
    </section>
    {videoSrc && <button onClick={() => setCatalogOpen(false)} className="mt-6 w-full rounded-2xl bg-[#36c94f] py-4 font-bold text-white">继续当前作品</button>}
    <input ref={input} aria-label="选择视频" type="file" accept="video/*" className="hidden" onChange={(e) => { importVideo(e.target.files?.[0]); e.target.value = ""; }} />
    <button onClick={() => input.current?.click()} className="mt-6 w-full rounded-2xl bg-[#edf2ff] text-[#335eea] py-4 font-bold flex items-center justify-center gap-2"><Film size={18} />导入我的视频</button>
  </div>;

  if (selectedMaterial && selectedPart && !editorOpen) return <div className="min-h-full bg-[#f7f8fc] px-6 pt-12 pb-28 text-[#192b59]">
    <p className="text-[#617bd1] text-sm font-semibold">纯粤语片段 · 你来配音</p>
    <div className="mt-5 rounded-[26px] overflow-hidden bg-[#111b37] aspect-video relative">
      <video ref={video} key={videoSrc} src={videoSrc} className="w-full h-full object-contain" playsInline controls onLoadedMetadata={(e) => { const d = e.currentTarget.duration; setDuration(Number.isFinite(d) ? d : 0); }} onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)} onError={() => setVideoMissing(true)} />
      {previewCueText && <div aria-label="当前台词" className="absolute inset-x-3 bottom-12 pointer-events-none text-center text-white text-base font-bold whitespace-pre-line [text-shadow:0_2px_6px_#000,0_0_3px_#000]">{previewCueText}</div>}
    </div>
    {videoMissing && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">视频暂时无法播放，请稍后重试或选择其他片段。</p>}
    <h1 className="mt-5 text-[26px] font-black">{selectedMaterial.title}</h1>
    <p className="mt-2 text-sm text-[#8290aa]">{selectedPart.cues.length} 句 · 难度 {selectedMaterial.difficulty}</p>
    <div className="mt-3 flex flex-wrap gap-2">{selectedMaterial.tags.map((tag) => <span key={tag} className="rounded-full bg-[#eaf8ef] px-3 py-1 text-sm font-semibold text-[#259653]">{tag}</span>)}</div>
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#617bd1]">
      <a href={selectedMaterial.sourceUrl} target="_blank" rel="noreferrer">素材来源：{selectedMaterial.sourceLabel}</a>
      <a href={selectedMaterial.licenseUrl} target="_blank" rel="noreferrer">许可：{selectedMaterial.licenseLabel}</a>
    </div>
    <section className="mt-7" aria-label="片段选集">
      <h2 className="text-lg font-black">片段选集</h2>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-2">{selectedMaterial.parts.map((part) => <button key={part.id} aria-pressed={part.id === selectedPartId} aria-label={`${part.label} ${part.title}`} disabled={partSwitchDisabled} onClick={() => selectBuiltInPart(selectedMaterial, part)} className={`min-w-36 rounded-xl border px-4 py-3 text-left disabled:opacity-50 ${part.id === selectedPartId ? "border-[#36c94f] bg-[#f1fff3] text-[#259b3d]" : "border-[#e6ebf4] bg-white"}`}><span className="block text-xs">{part.label}</span><span className="mt-1 block font-bold">{part.title}</span></button>)}</div>
    </section>
    <input ref={input} aria-label="选择视频" type="file" accept="video/*" className="hidden" onChange={(e) => { importVideo(e.target.files?.[0]); e.target.value = ""; }} />
    <button onClick={() => input.current?.click()} className="mt-5 w-full rounded-xl bg-[#edf2ff] text-[#335eea] py-3 font-bold flex items-center justify-center gap-2"><Film size={18} />导入我的视频</button>
    <div className="sticky bottom-0 z-10 -mx-6 mt-6 bg-white/95 px-6 py-4 shadow-[0_-8px_24px_rgba(25,43,89,0.08)] backdrop-blur">
      <button disabled={videoMissing} onClick={() => setEditorOpen(true)} className="mx-auto block w-full max-w-md rounded-2xl bg-[#36c94f] py-4 text-lg font-black text-white disabled:opacity-50">开始粤语配音</button>
    </div>
  </div>;

  return <div className="min-h-full bg-[#f7f8fc] px-6 pt-12 pb-8 text-[#192b59]">
    <p className="text-[#617bd1] text-sm font-semibold">导入片段 · 你来配音</p>
    <h1 className="text-[30px] font-black mt-1">电影模仿</h1>
    <p className="text-[#8290aa] text-sm mt-2">看画面猜情绪，用自己的声音完成台词。</p>
    <button disabled={partSwitchDisabled} onClick={() => setCatalogOpen(true)} className="mt-3 text-sm font-bold text-[#335eea] disabled:opacity-50">选择内置片段</button>
    <div className="mt-3 text-xs text-[#8290aa]" aria-label="作品保存状态">
      <p className={saveFailed ? "text-red-600" : ""}>{saveStatus}</p>
      {saveFailed && storageReady && <button className="mt-1 text-[#335eea]" onClick={() => setSaveRetry((value) => value + 1)}>重试保存</button>}
      <p className="mt-1">仅保存最近一个作品，导入新视频会替换。限当前浏览器；清除浏览器数据、使用无痕模式或换设备可能无法恢复。</p>
    </div>
    <div className="mt-7 rounded-[26px] overflow-hidden bg-[#18264d] aspect-video relative">
      {videoSrc && !videoMissing ? <video ref={video} key={videoSrc} src={videoSrc} className="w-full h-full object-contain" playsInline controls={!recording && !starting} onLoadedMetadata={(e) => { const d = e.currentTarget.duration; setDuration(Number.isFinite(d) ? d : 0); }} onPlay={(e) => syncPlaybackAudio(e.currentTarget)} onPause={() => { background.current?.pause(); interruptRecording(); }} onWaiting={interruptRecording} onSeeking={interruptRecording} onSeeked={(e) => syncBackgroundPosition(e.currentTarget)} onRateChange={(e) => { if (e.currentTarget.playbackRate !== 1) interruptRecording(); syncBackgroundPosition(e.currentTarget); }} onTimeUpdate={(e) => { setTime(e.currentTarget.currentTime); if (!playVideoAudio) syncBackgroundPosition(e.currentTarget); if (recording && recorder.current?.state === "recording" && e.currentTarget.currentTime * 1000 >= recordingEndMs.current) { recorder.current?.stop(); e.currentTarget.pause(); background.current?.pause(); } }} onError={() => { setVideoMissing(true); if (recorder.current?.state === "recording") recorder.current.stop(); }} /> : <div className="h-full flex items-center justify-center text-white/80 px-5 text-center">{videoMissing ? "视频无法播放，请换用浏览器支持的视频格式" : "请先导入一个视频"}</div>}
      {preparing && <div role="status" className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-2xl font-bold pointer-events-none">准备 · 1</div>}
      {activeCue && videoSrc && !videoMissing && <div aria-label="当前台词" className="absolute inset-x-3 bottom-12 pointer-events-none text-center text-white text-base font-bold whitespace-pre-line [text-shadow:0_2px_6px_#000,0_0_3px_#000]">{activeCue.text}</div>}
    </div>
    {selectedMaterial && selectedPart && <section className="mt-5" aria-label="当前内置素材">
      <h2 className="text-2xl font-black">{selectedMaterial.title}</h2>
      <p className="mt-1 text-sm text-[#8290aa]">{selectedPart.cues.length} 句 · 难度 {selectedMaterial.difficulty}</p>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-2">{selectedMaterial.parts.map((part) => <button key={part.id} aria-pressed={part.id === selectedPartId} aria-label={`${part.label} ${part.title}`} disabled={partSwitchDisabled} onClick={() => selectBuiltInPart(selectedMaterial, part)} className={`min-w-36 rounded-xl border px-4 py-3 text-left disabled:opacity-50 ${part.id === selectedPartId ? "border-[#36c94f] bg-[#f1fff3] text-[#259b3d]" : "border-[#e6ebf4] bg-white"}`}><span className="block text-xs">{part.label}</span><span className="mt-1 block font-bold">{part.title}</span></button>)}</div>
    </section>}
    <input ref={input} aria-label="选择视频" type="file" accept="video/*" className="hidden" disabled={recording || starting || previewing} onChange={(e) => { importVideo(e.target.files?.[0]); e.target.value = ""; }} />
    <button disabled={recording || starting || previewing} onClick={() => input.current?.click()} className="mt-4 w-full rounded-xl bg-[#edf2ff] text-[#335eea] py-3 font-bold flex items-center justify-center gap-2 disabled:opacity-50"><Film size={18} />导入我的视频</button>
    <p className="mt-2 text-xs text-[#8290aa]">可先导入本地视频。若原片含台词，请另备无台词背景音；自动分离尚未接入。</p>
    {!selectedMaterial && <><button disabled={!videoSrc || !duration || videoMissing || recording || starting || transcribing || importingSubtitles || previewing} onClick={() => void handleAutoTranscribe()} className="mt-3 w-full rounded-xl bg-[#335eea] text-white py-3 font-bold disabled:opacity-50">{transcribing ? transcriptionProgress : "自动生成台词"}</button>
    <p className="mt-2 text-xs text-[#8290aa]">{cloudTranscription ? "点击并确认后上传视频，音频由腾讯云识别粤语；需登录" : "仅点击后发送至本机识别服务"} · 最长 5 分钟，最大 200 MB</p></>}
    {videoSrc && !videoMissing && <div className="mt-3"><input ref={backgroundInput} aria-label="选择背景音" type="file" accept="audio/*" className="hidden" disabled={recording || starting || previewing} onChange={(e) => { importBackground(e.target.files?.[0]); e.target.value = ""; }} /><button disabled={recording || starting || previewing} onClick={() => backgroundInput.current?.click()} className="rounded-lg bg-[#edf2ff] text-[#335eea] px-3 py-2 text-sm">导入单独背景音</button>{backgroundName && <p className="text-xs text-[#8290aa] mt-1">已导入背景音：{backgroundName}</p>}<audio ref={background} data-background-track src={backgroundSrc || undefined} className="hidden" /></div>}
    {videoSrc && !videoMissing && <div className="mt-3 flex items-center gap-3"><input aria-label="视频进度" type="range" className="flex-1 min-w-0 accent-[#335eea]" min={0} max={duration || 1} step={0.1} value={Math.min(time, duration || 1)} disabled={!duration || recording || starting} onChange={(e) => { const t = Number(e.target.value); if (video.current) video.current.currentTime = t; setTime(t); }} /><span className="text-xs text-[#8290aa]">{Math.floor(time)}s / {Math.floor(duration)}s</span></div>}
    {videoSrc && !videoMissing && <section className="mt-5 bg-white rounded-2xl p-4" aria-label="字幕时间轴">
      <div className="flex items-center justify-between gap-2"><h2 className="font-bold">台词时间轴</h2><span className="text-xs text-[#8290aa]">{cues.length} 句</span></div>
      <input ref={subtitleInput} aria-label="导入字幕" type="file" accept=".srt,text/plain" className="hidden" onChange={(e) => { void importSubtitles(e.target.files?.[0]); e.target.value = ""; }} />
      <div className="flex gap-2 mt-3"><button disabled={transcribing || recording || starting || previewing} onClick={() => subtitleInput.current?.click()} className="rounded-lg bg-[#edf2ff] text-[#335eea] px-3 py-2 text-sm">导入 SRT</button><button disabled={transcribing || recording || starting || previewing} onClick={addCue} className="rounded-lg bg-[#edf2ff] text-[#335eea] px-3 py-2 text-sm">新增台词</button>{cues.length > 0 && <button onClick={downloadSubtitles} className="rounded-lg bg-[#edf2ff] text-[#335eea] px-3 py-2 text-sm">导出 SRT</button>}</div>
      {!cues.length && <p className="text-sm text-[#8290aa] mt-3">先导入 SRT，或在当前播放位置新增台词。</p>}
      <div className="mt-3 max-h-72 overflow-y-auto space-y-3">{cues.map((cue, index) => <div key={cue.id} className={`rounded-xl border p-3 ${selectedCueId === cue.id ? "border-[#335eea] bg-[#f3f6ff]" : highlightedCueId === cue.id ? "border-[#88a0ec]" : "border-[#e6ebf4]"}`}>
        <div className="flex items-center gap-2"><button aria-label={`定位到第 ${index + 1} 句`} disabled={recording || starting} onClick={() => selectCue(cue)} className="flex-1 min-w-0 flex items-center justify-between gap-2 text-left"><span className="text-sm font-bold text-[#335eea]">第 {index + 1} 句 · {takeUrls[cue.id] ? "已录" : "未录"}</span><span className="text-xs text-[#8290aa]">{(cue.startMs / 1000).toFixed(1)}–{(cue.endMs / 1000).toFixed(1)} 秒</span></button><button aria-label={`删除第 ${index + 1} 句`} disabled={recording || starting || transcribing || previewing} onClick={() => deleteCue(cue.id)} className="shrink-0 text-xs text-red-600 disabled:opacity-50">删除</button></div>
        {!cueIsValid(cue, duration * 1000) && <p className="text-xs text-red-600 mt-1">时间或台词无效，请校正后录音</p>}
        <textarea aria-label={`第 ${index + 1} 句台词`} value={cue.text} disabled={transcribing || recording || starting || previewing} onChange={(e) => updateCue(cue.id, { text: e.target.value })} className="w-full border rounded-lg px-2 py-1 mt-2 text-sm" rows={2} />
      </div>)}</div>
    </section>}
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    {videoSrc && !videoMissing && <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={autoAdvance} disabled={recording || starting || previewing} onChange={(e) => setAutoAdvance(e.target.checked)} />录完自动跳到下一句</label>}
    {videoSrc && !videoMissing && <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={playVideoAudio} disabled={previewing} onChange={(e) => { const enabled = e.target.checked; setPlayVideoAudio(enabled); if (video.current) { video.current.muted = !enabled; if (enabled) background.current?.pause(); else if (!video.current.paused && background.current && backgroundSrc) { syncBackgroundPosition(video.current); void background.current.play().catch(() => setError("背景音无法播放，请检查音频格式。")); } } }} />播放视频原音（可能含原台词）；关闭后静音或播放已导入背景音</label>}
    <button disabled={!videoSrc || videoMissing || starting || transcribing || previewing || (!recording && (!selectedCue || !cueIsValid(selectedCue, duration * 1000)))} onClick={toggleRecording} className={`mt-6 w-full rounded-2xl py-4 flex items-center justify-center gap-3 text-white font-bold disabled:opacity-50 ${recording ? "bg-[#e25d67]" : "bg-[#335eea]"}`}>{recording ? <><Square size={19} />停止配音</> : <><Mic size={21} />{starting ? preparing ? "准备，1 秒后开始" : "正在准备录音" : selectedCue ? `录制第 ${cues.findIndex((cue) => cue.id === selectedCueId) + 1} 句` : "开始配音"}</>}</button>
    {recordedUrl && !recording && <div className="mt-4"><p className="text-xs mb-2">这一句的配音</p><div className="flex items-center gap-3"><audio ref={takePlayer} aria-label="我的配音" className="flex-1 min-w-0 h-9" controls src={recordedUrl} onPlay={() => { stopPreview(); video.current?.pause(); }} /><button onClick={() => clearRecording(selectedCueId)} className="text-[#335eea] text-xs flex items-center gap-1"><RotateCcw size={14} />重录</button></div></div>}
    {videoSrc && !videoMissing && <section className="mt-5 rounded-2xl bg-white p-4" aria-label="配音成片预览">
      <button disabled={recording || starting || transcribing || importingSubtitles || !Object.keys(takeUrls).length} onClick={() => void togglePreview()} className="w-full rounded-xl bg-[#335eea] py-3 font-bold text-white disabled:opacity-50">{previewing ? "停止预览" : "预览我的配音"}</button>
      <p className="mt-2 text-xs text-[#8290aa]">已录 {cues.filter((cue) => takeUrls[cue.id]).length} / {cues.length} 句。预览自动关闭原声，播放你的配音{backgroundSrc ? "和已导入的背景音" : ""}；未录台词处没有配音。</p>
      <p className="mt-2 text-xs text-[#8290aa]">可用视频控件暂停或拖动进度。整片预览只播放台词时间段，前后留白保留在单句试听中。目前可网页预览，暂不支持导出视频。</p>
    </section>}
    <p className="mt-4 text-center text-[#8a95aa] text-xs">前后最多留 1 秒，只使用邻句之间的空隙；前方留白不足时，先静止倒计时 1 秒再录制。建议戴耳机。自动分离与成片导出尚未接入。</p>
  </div>;
}
