import { beforeEach, describe, expect, it, vi } from "vitest";
import * as speech from "../lib/speech";
import { ttsCantonese } from "../lib/api";

vi.mock("../data/audio-manifest", () => ({ AUDIO_MANIFEST: {} }));
vi.mock("../lib/api", () => ({
  getToken: () => "test-token",
  ttsCantonese: vi.fn(async () => new Blob(["audio"], { type: "audio/mpeg" })),
}));

class SuccessfulAudio {
  src: string;
  playbackRate = 1;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(src: string) {
    this.src = src;
  }

  play = vi.fn(async () => {});
  pause = vi.fn();
}

describe("AI 语音对象 URL 缓存", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("Audio", SuccessfulAudio);
    vi.mocked(ttsCantonese).mockClear();
    let nextUrl = 0;
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:tts-${nextUrl++}`);
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    speech.clearSpeechCache();
    vi.mocked(URL.revokeObjectURL).mockClear();
  });

  it("提供生命周期清理并释放所有已缓存的音频 URL", async () => {
    const create = vi.spyOn(URL, "createObjectURL")
      .mockReturnValueOnce("blob:tts-one")
      .mockReturnValueOnce("blob:tts-two");
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    await speech.speakAiReply("第一段未收录粤语");
    await speech.speakAiReply("第二段未收录粤语");

    const clearSpeechCache = (speech as typeof speech & { clearSpeechCache?: () => void }).clearSpeechCache;
    expect(clearSpeechCache).toBeTypeOf("function");
    clearSpeechCache?.();

    expect(create).toHaveBeenCalledTimes(2);
    expect(revoke).toHaveBeenCalledWith("blob:tts-one");
    expect(revoke).toHaveBeenCalledWith("blob:tts-two");
  });

  it("超过八条时淘汰并释放最早的音频 URL", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const create = vi.spyOn(URL, "createObjectURL");

    for (let i = 0; i < 9; i += 1) {
      await speech.speakAiReply(`第${i}段全新粤语回复`);
    }

    expect(create).toHaveBeenCalledTimes(9);
    expect(revoke).toHaveBeenCalledWith("blob:tts-0");
  });
});
