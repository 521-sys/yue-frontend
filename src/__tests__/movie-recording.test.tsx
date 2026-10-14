import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import Movie from "../screens/MovieImitationScreen";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function setup(start = "00:00:02,000", end = "00:00:04,000", duration = 10) {
  vi.spyOn(URL, "createObjectURL").mockReturnValueOnce("blob:video").mockReturnValue("blob:take");
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    return this.getAttribute("src") ? Promise.resolve() : Promise.reject(new Error("No source"));
  });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) } });
  class Recorder {
    state = "inactive"; mimeType = "audio/webm";
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    start() { this.state = "recording"; }
    stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["voice"]) }); this.onstop?.(); }
  }
  vi.stubGlobal("MediaRecorder", Recorder);
  const { container } = render(<Movie />);
  fireEvent.change(screen.getByLabelText("选择视频"), { target: { files: [new File(["video"], "clip.mp4", { type: "video/mp4" })] } });
  const video = container.querySelector("video")!;
  Object.defineProperty(video, "duration", { value: duration });
  fireEvent.loadedMetadata(video);
  const subtitle = new File(["srt"], "test.srt");
  Object.defineProperty(subtitle, "text", { value: async () => `1\n${start} --> ${end}\n测试台词\n` });
  fireEvent.change(screen.getByLabelText("导入字幕"), { target: { files: [subtitle] } });
  await screen.findByLabelText("第 1 句台词");
  return video;
}

it("records silently without attempting to play an absent background track", async () => {
  const video = await setup();
  fireEvent.click(screen.getByRole("checkbox", { name: /播放视频原音/ }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "录制第 1 句" })));
  expect(screen.getByRole("button", { name: "停止配音" })).toBeEnabled();
  expect(video.muted).toBe(true);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "停止配音" }));
  expect(screen.getByLabelText("我的配音")).toHaveAttribute("src", "blob:take");
});

it("includes one second before and after the cue in playback and the recording timer", async () => {
  const video = await setup();
  vi.useFakeTimers();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "录制第 1 句" })));
  expect(video.currentTime).toBe(1);
  video.currentTime = 4;
  fireEvent.timeUpdate(video);
  expect(screen.getByRole("button", { name: "停止配音" })).toBeEnabled();
  await act(async () => vi.advanceTimersByTime(3999));
  expect(screen.queryByLabelText("我的配音")).not.toBeInTheDocument();
  await act(async () => vi.advanceTimersByTime(1));
  expect(screen.getByLabelText("我的配音")).toBeInTheDocument();
});

it("stops at the padded end when playback reaches it", async () => {
  const video = await setup();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "录制第 1 句" })));
  video.currentTime = 4;
  fireEvent.timeUpdate(video);
  expect(screen.queryByLabelText("我的配音")).not.toBeInTheDocument();
  video.currentTime = 5;
  fireEvent.timeUpdate(video);
  expect(screen.getByLabelText("我的配音")).toBeInTheDocument();
});

it("clamps padding to video boundaries", async () => {
  const video = await setup("00:00:00,500", "00:00:02,500", 3);
  vi.useFakeTimers();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "录制第 1 句" })));
  expect(video.currentTime).toBe(0);
  expect(screen.getByRole("status")).toHaveTextContent("准备");
  await act(async () => vi.advanceTimersByTime(1000));
  await act(async () => vi.advanceTimersByTime(2999));
  expect(screen.queryByLabelText("我的配音")).not.toBeInTheDocument();
  await act(async () => vi.advanceTimersByTime(1));
  expect(screen.getByLabelText("我的配音")).toBeInTheDocument();
});

it("prepares on a paused frame then records only the selected back-to-back cue", async () => {
  const video = await setup();
  const subtitle = new File(["srt"], "adjacent.srt");
  Object.defineProperty(subtitle, "text", { value: async () => "1\n00:00:00,000 --> 00:00:02,000\n上句\n\n2\n00:00:02,000 --> 00:00:04,000\n这句\n\n3\n00:00:04,000 --> 00:00:06,000\n下句" });
  fireEvent.change(screen.getByLabelText("导入字幕"), { target: { files: [subtitle] } });
  await screen.findByLabelText("第 3 句台词");
  fireEvent.click(screen.getByLabelText("定位到第 2 句"));
  vi.useFakeTimers();
  vi.mocked(HTMLMediaElement.prototype.play).mockClear();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "录制第 2 句" })));
  expect(video.currentTime).toBe(2);
  expect(screen.getByRole("status")).toHaveTextContent("准备");
  await act(async () => vi.advanceTimersByTime(999));
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "停止配音" })).not.toBeInTheDocument();
  await act(async () => vi.advanceTimersByTime(1));
  expect(screen.getByRole("button", { name: "停止配音" })).toBeEnabled();
  await act(async () => vi.advanceTimersByTime(2000));
  expect(screen.getByLabelText("我的配音")).toBeInTheDocument();
});

it("does not start playback after leaving during the preparation countdown", async () => {
  await setup("00:00:00,000", "00:00:02,000");
  vi.useFakeTimers();
  vi.mocked(HTMLMediaElement.prototype.play).mockClear();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "录制第 1 句" })));
  expect(screen.getByRole("status")).toHaveTextContent("准备");
  await act(async () => cleanup());
  await act(async () => vi.advanceTimersByTime(1000));
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("enables full preview after recording, mutes original sound and restores it when stopped", async () => {
  const video = await setup();
  expect(screen.getByRole("button", { name: "预览我的配音" })).toBeDisabled();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "录制第 1 句" })));
  fireEvent.click(screen.getByRole("button", { name: "停止配音" }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "预览我的配音" })));
  expect(video.currentTime).toBe(0);
  expect(video.muted).toBe(true);
  expect(screen.getByRole("button", { name: "录制第 1 句" })).toBeDisabled();
  expect(screen.getByRole("checkbox", { name: /播放视频原音/ })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "停止预览" }));
  expect(video.muted).toBe(false);
  expect(screen.getByRole("button", { name: "录制第 1 句" })).toBeEnabled();
});

it("waits for seeking before recording and locks the video to normal-speed playback", async () => {
  const video = await setup();
  video.playbackRate = 0.5;
  let seeking = true;
  Object.defineProperty(video, "seeking", { get: () => seeking });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "录制第 1 句" })));
  expect(screen.queryByRole("button", { name: "停止配音" })).not.toBeInTheDocument();
  expect(video.playbackRate).toBe(1);
  expect(video.controls).toBe(false);
  expect(screen.getByLabelText("视频进度")).toBeDisabled();
  seeking = false;
  await act(async () => fireEvent.seeked(video));
  expect(screen.getByRole("button", { name: "停止配音" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "停止配音" }));
  expect(video.controls).toBe(true);
});

it("discards an interrupted take instead of saving audio that cannot align to the video", async () => {
  const video = await setup();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "录制第 1 句" })));
  fireEvent.waiting(video);
  expect(screen.queryByLabelText("我的配音")).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("本次录音未保存");
  expect(screen.getByRole("button", { name: "录制第 1 句" })).toBeEnabled();
});
