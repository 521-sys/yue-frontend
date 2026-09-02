import { AUDIO_MANIFEST } from "../data/audio-manifest";

/* ==================== 语音服务：离线粤语语音包 ====================
 * 优先播放预生成的离线粤语真人发音（微软晓佳 zh-HK-HiuGaaiNeural），
 * 未收录的文本再回退到浏览器 Web Speech API（zh-HK）。
 * ==================================================================== */

let curAudio: HTMLAudioElement | null = null;
let hkVoice: SpeechSynthesisVoice | null = null;

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
  return (
    voices.find((v) => /yue|Cantonese|粤/i.test(v.name + v.lang)) ||
    voices.find((v) => v.lang === "zh-HK") ||
    voices.find((v) => v.lang.startsWith("zh")) ||
    null
  );
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  hkVoice = pickVoice();
  speechSynthesis.onvoiceschanged = () => {
    hkVoice = pickVoice();
  };
}

/** 播放离线音频文件 */
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

/** 是否有离线粤语音频 */
export function hasAudio(text: string): boolean {
  return !!AUDIO_MANIFEST[text];
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
