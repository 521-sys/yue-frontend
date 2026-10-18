import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import App from "../App";
import { speakAiReply } from "../lib/speech";

const mockTranscribe = vi.fn(async () => "你好，我想练习粤语");

vi.mock("../lib/api", () => ({
  isLoggedin: () => true,
  aiChat: vi.fn(async () => ({
    choices: [{ message: { content: "粤语：好呀\n普通话：好呀" } }],
  })),
  transcribeAudio: (...args: unknown[]) => mockTranscribe(...args),
  AUTH_CHANGED_EVENT: "yue-auth-changed",
}));
vi.mock("../lib/speech", () => ({
  clearSpeechCache: vi.fn(),
  speak: vi.fn(),
  speakAiReply: vi.fn(async () => ({ ok: true, source: "server" })),
  stopSpeak: vi.fn(),
  warmUpAudio: vi.fn(),
}));

/** 假 AudioContext：ScriptProcessor 在 connect 时同步灌入足够长的有声样本，
 * 使 finish() 的最短时长（0.1 秒）与响度（peak > 0.001）检查通过 */
function fakeProcessor() {
  const node: {
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    onaudioprocess: ((e: { inputBuffer: { getChannelData: () => Float32Array } }) => void) | null;
  } = {
    connect: vi.fn(() => {
      for (let i = 0; i < 3; i++) {
        node.onaudioprocess?.({
          inputBuffer: { getChannelData: () => new Float32Array(4096).fill(0.1) },
        });
      }
    }),
    disconnect: vi.fn(),
    onaudioprocess: null,
  };
  return node;
}
class FakeContext {
  state = "running";
  sampleRate = 48000;
  destination = {};
  resume = vi.fn(async () => {});
  close = vi.fn(async () => {});
  createMediaStreamSource = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  createScriptProcessor = () => fakeProcessor();
  createGain = () => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() });
}

const stop = vi.fn();
const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop }] }));

/** jsdom 可能没有 PointerEvent，退回 MouseEvent（handler 只依赖 clientY） */
function firePointer(el: Element, type: string, props: Record<string, unknown> = {}) {
  const Ctor =
    (window as unknown as { PointerEvent?: typeof PointerEvent }).PointerEvent ??
    window.MouseEvent;
  const event = new Ctor(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    pointerId: 1,
    ...props,
  });
  fireEvent(el, event);
}

function openAiChat() {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "开始 AI 语音对话" }));
}

beforeEach(() => {
  vi.stubGlobal("AudioContext", FakeContext);
  vi.stubGlobal("navigator", {
    ...window.navigator,
    mediaDevices: { getUserMedia },
  });
  localStorage.clear();
  mockTranscribe.mockClear();
  stop.mockClear();
  vi.mocked(speakAiReply).mockReset();
  vi.mocked(speakAiReply).mockResolvedValue({ ok: true, source: "server" });
});

describe("微信式按住说话", () => {
  it("点语音图标切换为按住说话，按住录音、松开发送", async () => {
    openAiChat();
    fireEvent.click(screen.getByTitle("切换为语音输入"));
    const hold = screen.getByRole("button", { name: "按住 说话" });

    await act(async () => {
      firePointer(hold, "pointerdown", { clientY: 100 });
    });
    expect(await screen.findByText("松开发送 · 上移取消")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "松开 发送" })).toBeInTheDocument();

    await act(async () => {
      firePointer(hold, "pointerup", { clientY: 100 });
    });
    expect(mockTranscribe).toHaveBeenCalledOnce();
    expect(await screen.findByText("你好，我想练习粤语")).toBeInTheDocument();
  });

  it("按住后上移再松开，取消发送且不识别", async () => {
    openAiChat();
    fireEvent.click(screen.getByTitle("切换为语音输入"));
    const hold = screen.getByRole("button", { name: "按住 说话" });

    await act(async () => {
      firePointer(hold, "pointerdown", { clientY: 100 });
    });
    await screen.findByText("松开发送 · 上移取消");
    fireEvent.pointerMove(hold, { clientY: 30, pointerId: 1 });
    // 状态栏与录音浮层两处同时提示取消
    expect(await screen.findAllByText("松开手指，取消发送")).toHaveLength(2);
    expect(hold.textContent).toBe("松开 取消");
    fireEvent.pointerUp(hold, { clientY: 30, pointerId: 1 });

    expect(mockTranscribe).not.toHaveBeenCalled();
  });

  it("点键盘图标切回键盘输入", () => {
    openAiChat();
    fireEvent.click(screen.getByTitle("切换为语音输入"));
    fireEvent.click(screen.getByTitle("切换为键盘输入"));
    expect(screen.getByPlaceholderText("用粤语或普通话打字")).toBeInTheDocument();
  });

  it("播放被自动播放策略拦截时，显示「点按播放语音」按钮", async () => {
    vi.mocked(speakAiReply).mockImplementation(async () => ({ ok: false, reason: "autoplay-blocked" }));
    openAiChat();
    fireEvent.click(await screen.findByRole("button", { name: "再听一次" }));
    expect(await screen.findByRole("button", { name: "点按播放语音" })).toBeInTheDocument();
  });

  it("浏览器无粤语语音时点「再听一次」给出明确提示", async () => {
    vi.mocked(speakAiReply).mockImplementation(async () => ({ ok: false, reason: "no-cantonese-voice" }));
    openAiChat();
    fireEvent.click(await screen.findByRole("button", { name: "再听一次" }));
    expect(await screen.findByText("当前浏览器没有粤语语音引擎，建议用 Chrome 浏览器打开")).toBeInTheDocument();
  });

  it("退出 AI 面板后不再执行尚未开始的自动播放", async () => {
    vi.useFakeTimers();
    try {
      openAiChat();
      fireEvent.change(screen.getByPlaceholderText("用粤语或普通话打字"), {
        target: { value: "你好" },
      });
      fireEvent.click(screen.getByTitle("发送"));
      await act(async () => {});
      fireEvent.click(screen.getByRole("button", { name: "✕ 退出" }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });

      expect(speakAiReply).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
