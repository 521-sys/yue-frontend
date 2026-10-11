export type TranscriptionCue = { startMs: number; endMs: number; text: string };

export async function transcribeLocalVideo(file: File, signal?: AbortSignal): Promise<TranscriptionCue[]> {
  const form = new FormData();
  form.append("file", file);
  let response: Response;
  try {
    const base = (import.meta.env.VITE_LOCAL_ASR_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
    response = await fetch(`${base}/transcribe`, { method: "POST", body: form, signal });
  } catch (cause) {
    if (signal?.aborted || (cause instanceof DOMException && cause.name === "AbortError")) throw cause;
    throw new Error("本地识别服务未启动或无法连接，请启动本机服务后重试");
  }
  let body;
  try { body = await response.json(); }
  catch { throw new Error("识别服务响应格式错误，请检查本机服务"); }
  if (!response.ok) throw new Error(typeof body?.error === "string" ? body.error : "识别失败，请稍后重试");
  if (!Array.isArray(body?.cues) || !body.cues.every((cue: TranscriptionCue | null) =>
    cue && Number.isSafeInteger(cue.startMs) && Number.isSafeInteger(cue.endMs) &&
    cue.startMs >= 0 && cue.endMs > cue.startMs && typeof cue.text === "string" && cue.text.trim()
  )) throw new Error("识别服务返回的台词格式错误");
  return body.cues;
}
