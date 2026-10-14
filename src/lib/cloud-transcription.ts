import { getToken } from "./api";
import type { TranscriptionCue } from "./local-transcription";

export async function transcribeCloudVideo(file: File, signal?: AbortSignal, onProgress?: (message: string) => void): Promise<TranscriptionCue[]> {
  signal?.throwIfAborted();
  const token = getToken();
  if (!token) throw new Error("请先登录，再使用云端粤语识别");
  if (!file.size || file.size > 200 * 1024 * 1024) throw new Error("视频必须非空且不超过 200 MB");
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(cancel, 20 * 60 * 1000);
  const base = (import.meta.env.VITE_API_BASE || "https://gnep.online").replace(/\/$/, "");
  const request = async (path: string, method: string, body?: FormData) => {
    let response: Response;
    try {
      response = await fetch(`${base}/api/dubbing/transcriptions${path}`, {
        method, body, headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
      });
    } catch (cause) {
      if (signal?.aborted) throw cause;
      throw new Error("连接中断或等待超时，原台词已保留；云端可能仍在识别，请勿立即重复提交");
    }
    if (response.status === 401) throw new Error("登录已过期，请重新登录");
    if (response.status === 413) throw new Error("视频超过服务器上传限制，请缩短视频或联系管理员");
    let result;
    try { result = await response.json(); } catch { throw new Error("识别服务响应格式错误，请稍后重试"); }
    if (!response.ok) throw new Error(typeof result?.error === "string" ? result.error : "云端识别暂不可用");
    return result;
  };
  try {
    onProgress?.("正在上传视频");
    const form = new FormData(); form.append("file", file);
    let job = await request("", "POST", form);
    if (typeof job?.id !== "string" || !/^[\w-]+$/.test(job.id)) throw new Error("识别任务格式错误");
    const id = job.id;
    while (job.status === "preparing" || job.status === "recognizing") {
      onProgress?.(job.status === "preparing" ? "正在提取音频" : "正在识别粤语");
      await delay(2000, controller.signal);
      job = await request(`/${encodeURIComponent(id)}`, "GET");
    }
    if (job.status === "failed") throw new Error(typeof job.error === "string" ? job.error : "识别失败，原台词已保留");
    if (job.status !== "succeeded" || !Array.isArray(job.cues) || !job.cues.every((cue: TranscriptionCue | null) =>
      cue && Number.isSafeInteger(cue.startMs) && Number.isSafeInteger(cue.endMs) && cue.startMs >= 0 &&
      cue.endMs > cue.startMs && cue.endMs <= 301000 && typeof cue.text === "string" && cue.text.trim()
    )) throw new Error("识别结果格式错误，原台词已保留");
    return job.cues;
  } finally {
    clearTimeout(timeout); signal?.removeEventListener("abort", cancel);
  }
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
