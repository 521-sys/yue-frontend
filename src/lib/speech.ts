import { AUDIO_MANIFEST } from "../data/audio-manifest";
import { ttsCantonese, getToken } from "./api";

/* ==================== 语音服务：离线粤语语音包 ====================
 * 优先播放预生成的离线粤语真人发音（微软晓佳 zh-HK-HiuGaaiNeural），
 * 未收录的文本再回退到浏览器 Web Speech API（zh-HK）。
 * ==================================================================== */

let curAudio: HTMLAudioElement | null = null;
let hkVoice: SpeechSynthesisVoice | null = null;
export function playSceneAudio(url: string) { stopSpeak(); playFile(url, 1); }

/** 朗读结果：供 UI 区分「成功 / 被自动播放拦截 / 服务端失败 / 浏览器不支持」，不再静默无声 */
export type SpeakOutcome =
  | { ok: true; source: "offline" | "server" | "browser" }
  | { ok: false; reason: "autoplay-blocked" | "server-tts-failed" | "no-cantonese-voice" | "tts-unsupported" };

function stopAudio() {
  if (curAudio) {
    try {
      curAudio.pause();
      curAudio.src = "";
    } catch {
      /* ignore */
    }
    curAudio = null;
  }
}

function pickVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;
  const isCantonese = (v: SpeechSynthesisVoice) =>
    v.lang === "zh-HK" ||
    /yue|Cantonese|粤/i.test(v.name + v.lang) ||
    /HiuGaai|HiuMaan|KaLing/i.test(v.name);
  return (
    // 1. 在线神经语音（如 Edge 的 Microsoft HiuGaai Online (Natural)）——口音最标准
    voices.find((v) => isCantonese(v) && /natural|online/i.test(v.name)) ||
    // 2. 本地粤语语音（Windows 粤语语言包自带 HiuGaai / HiuMaan / KaLing）
    voices.find(isCantonese) ||
    // 3. 没有粤语语音时不指定 voice，避免用普通话语音硬读粤语
    null
  );
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  hkVoice = pickVoice();
  speechSynthesis.onvoiceschanged = () => {
    hkVoice = pickVoice();
  };
}

/** 播放离线音频文件（场景对话等按钮点击，保留 fire-and-forget） */
function playFile(src: string, rate: number) {
  stopAudio();
  try {
    const a = new Audio(src);
    a.playbackRate = rate;
    curAudio = a;
    a.play().catch(() => {
      /* ignore */
    });
  } catch {
    /* ignore */
  }
}

/** 播放音频文件，返回是否成功起播（失败多为移动端自动播放策略拦截） */
function playFileAsync(src: string, rate: number): Promise<boolean> {
  stopAudio();
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: boolean) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    try {
      const a = new Audio(src);
      a.playbackRate = rate;
      curAudio = a;
      a.onended = () => done(true);
      a.onerror = () => done(false);
      a.play().then(() => done(true), () => done(false));
    } catch {
      done(false);
    }
  });
}

/** 浏览器 TTS 兜底 */
function speakTTS(text: string, rate: number) {
  if (!("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-HK";
    u.rate = rate;
    if (hkVoice) u.voice = hkVoice;
    speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

/** 浏览器粤语语音能力：ok 有粤语语音 / no-voice 无粤语语音 / unsupported 无 speechSynthesis */
function browserTtsState(): "ok" | "no-voice" | "unsupported" {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return "unsupported";
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return "no-voice";
  const hasYue = voices.some(
    (v) => v.lang === "zh-HK" || /yue|cantonese|粤|HiuGaai|HiuMaan|KaLing/i.test(v.name + v.lang)
  );
  return hasYue ? "ok" : "no-voice";
}

/** 是否有离线粤语音频 */
export function hasAudio(text: string): boolean {
  return !!AUDIO_MANIFEST[text];
}

/** 服务端 TTS 已合成音频的对象 URL 缓存（文本 -> URL）。
 * 作用：首次自动播放被手机浏览器拦截后，用户再次点按可在手势内立即播放（无网络等待）。 */
const ttsBlobUrls = new Map<string, string>();
const MAX_TTS_CACHE_ENTRIES = 8;

function cacheTtsBlobUrl(text: string, url: string) {
  if (ttsBlobUrls.size >= MAX_TTS_CACHE_ENTRIES) {
    const oldest = ttsBlobUrls.entries().next().value as [string, string] | undefined;
    if (oldest) {
      ttsBlobUrls.delete(oldest[0]);
      URL.revokeObjectURL(oldest[1]);
    }
  }
  ttsBlobUrls.set(text, url);
}

/** 结束 AI 对话时释放会话内缓存的 TTS 音频，避免 Blob URL 长期占用内存。 */
export function clearSpeechCache() {
  stopAudio();
  for (const url of ttsBlobUrls.values()) URL.revokeObjectURL(url);
  ttsBlobUrls.clear();
}

/** 播放 Blob 音频，返回是否成功起播。缓存 URL 不释放，供二次手势内播放。 */
function playBlobAsync(url: string, rate: number): Promise<boolean> {
  stopAudio();
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: boolean) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    try {
      const a = new Audio(url);
      a.playbackRate = rate;
      curAudio = a;
      a.onended = () => done(true);
      a.onerror = () => done(false);
      a.play().then(() => done(true), () => done(false));
    } catch {
      done(false);
    }
  });
}

/** 朗读文本：优先离线粤语真人发音，未收录则回退浏览器 TTS。返回是否命中离线音频 */
export function speak(text: string, rate = 1): boolean {
  const src = AUDIO_MANIFEST[text];
  if (src) {
    playFile(src, rate);
    return true;
  }
  speakTTS(text, rate);
  return false;
}

/** AI 对话回复朗读：离线音频 → 服务端粤语 TTS（晓佳音色，需登录）→ 浏览器 TTS 兜底。
 * 用于 AI 动态回复这类离线包覆盖不到的长文本，获得与离线音频同款的高质量粤语发音。
 * 默认 1.2 倍速朗读，更接近自然对话节奏（离线音频 / 服务端 TTS / 浏览器 TTS 三条链路一致生效）。
 * 返回 SpeakOutcome：成功返回来源，失败返回原因，调用方据此提示（不再静默无声）。 */
export async function speakAiReply(text: string, rate = 1.2): Promise<SpeakOutcome> {
  // 1. 离线粤语真人发音
  const src = AUDIO_MANIFEST[text];
  if (src) {
    const ok = await playFileAsync(src, rate);
    return ok ? { ok: true, source: "offline" } : { ok: false, reason: "autoplay-blocked" };
  }

  // 2. 服务端已合成过的音频：二次点按直接在用户手势内播放（无网络等待，绕过自动播放拦截）
  const cached = ttsBlobUrls.get(text);
  if (cached) {
    const ok = await playBlobAsync(cached, rate);
    return ok ? { ok: true, source: "server" } : { ok: false, reason: "autoplay-blocked" };
  }

  // 3. 服务端粤语 TTS（晓佳音色）
  let serverTried = false;
  if (getToken()) {
    serverTried = true;
    try {
      const blob = await ttsCantonese(text);
      const url = URL.createObjectURL(blob);
      cacheTtsBlobUrl(text, url);
      const ok = await playBlobAsync(url, rate);
      if (ok) return { ok: true, source: "server" };
      // 音频已就绪但 play() 被拦截：保留缓存，用户再点一次即可在手势内播放
      return { ok: false, reason: "autoplay-blocked" };
    } catch {
      /* 服务端不可用时回退浏览器 TTS，原因在最后统一返回 */
    }
  }

  // 4. 浏览器 TTS 兜底
  const tts = browserTtsState();
  if (tts === "ok") {
    speakTTS(text, rate);
    return { ok: true, source: "browser" };
  }
  if (tts === "no-voice") {
    // 有 speechSynthesis 但没有粤语语音：手机上强行 speak 通常无声，直接告知用户
    return { ok: false, reason: serverTried ? "server-tts-failed" : "no-cantonese-voice" };
  }
  return { ok: false, reason: serverTried ? "server-tts-failed" : "tts-unsupported" };
}

/** 在用户手势（如按住说话）内调用，预热移动端音频通道，提升后续自动播放成功率 */
let audioWarmed = false;
export function warmUpAudio() {
  if (audioWarmed || typeof window === "undefined") return;
  try {
    const silent =
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
    const a = new Audio(silent);
    a.play().then(
      () => {
        audioWarmed = true;
      },
      () => {
        /* 拦截也无妨，真正播放仍有二次点按兜底 */
      }
    );
  } catch {
    /* ignore */
  }
}

/** 停止当前播放 */
export function stopSpeak() {
  stopAudio();
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}
