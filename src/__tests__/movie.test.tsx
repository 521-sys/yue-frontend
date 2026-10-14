import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Movie from "../screens/MovieImitationScreen";
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("starts with local import and prevents recording without a video", () => {
  render(<Movie />);
  expect(screen.getByText("请先导入一个视频")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "开始配音" })).toBeDisabled();
});
it("imports video, seeks, and releases its URL on exit", () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:movie");
  const revoke = vi.spyOn(URL, "revokeObjectURL");
  const { container, unmount } = render(<Movie />);
  fireEvent.change(screen.getByLabelText("选择视频"), { target: { files: [new File(["video"], "clip.mp4", { type: "video/mp4" })] } });
  const video = container.querySelector("video")!;
  expect(video.getAttribute("src")).toBe("blob:movie");
  Object.defineProperty(video, "duration", { value: 30 });
  fireEvent.loadedMetadata(video);
  fireEvent.change(screen.getByRole("slider", { name: "视频进度" }), { target: { value: "12" } });
  expect(video.currentTime).toBe(12);
  unmount();
  expect(revoke).toHaveBeenCalledWith("blob:movie");
});

it("imports editable timed subtitles and seeks to a selected line", async () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:movie");
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const { container } = render(<Movie />);
  fireEvent.change(screen.getByLabelText("选择视频"), { target: { files: [new File(["video"], "clip.mp4", { type: "video/mp4" })] } });
  const subtitle = new File(["1\n00:00:01,000 --> 00:00:03,000\n你好\n"], "lines.srt", { type: "text/plain" });
  Object.defineProperty(subtitle, "text", { value: async () => "1\n00:00:01,000 --> 00:00:03,000\n你好\n" });
  fireEvent.change(screen.getByLabelText("导入字幕"), { target: { files: [subtitle] } });
  const editor = await screen.findByLabelText("第 1 句台词");
  fireEvent.change(editor, { target: { value: "你好呀" } });
  expect(editor).toHaveValue("你好呀");
  fireEvent.click(screen.getByRole("button", { name: "定位到第 1 句" }));
  expect(container.querySelector("video")?.currentTime).toBe(1);
  const video = container.querySelector("video")!;
  video.currentTime = 0;
  fireEvent.click(screen.getByText("1.0–3.0 秒"));
  expect(video.currentTime).toBe(1);
  expect(screen.queryByLabelText("第 1 句开始秒")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("第 1 句结束秒")).not.toBeInTheDocument();
});

it("optionally advances to the next cue after a take is saved", async () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValueOnce("blob:movie").mockReturnValueOnce("blob:take");
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) } });
  class Recorder {
    state = "inactive";
    mimeType = "audio/webm";
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: (() => void) | null = null;
    start() { this.state = "recording"; }
    stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["voice"]) }); this.onstop?.(); }
  }
  vi.stubGlobal("MediaRecorder", Recorder);
  const { container } = render(<Movie />);
  fireEvent.change(screen.getByLabelText("选择视频"), { target: { files: [new File(["video"], "clip.mp4", { type: "video/mp4" })] } });
  const subtitle = new File(["1\n00:00:01,000 --> 00:00:03,000\n你好\n\n2\n00:00:05,000 --> 00:00:07,000\n再见\n"], "lines.srt");
  Object.defineProperty(subtitle, "text", { value: async () => "1\n00:00:01,000 --> 00:00:03,000\n你好\n\n2\n00:00:05,000 --> 00:00:07,000\n再见\n" });
  fireEvent.change(screen.getByLabelText("导入字幕"), { target: { files: [subtitle] } });
  await screen.findByLabelText("第 2 句台词");
  const video = container.querySelector("video")!;
  Object.defineProperty(video, "duration", { value: 10 });
  fireEvent.loadedMetadata(video);
  fireEvent.click(screen.getByRole("checkbox", { name: "录完自动跳到下一句" }));
  fireEvent.click(screen.getByRole("button", { name: "录制第 1 句" }));
  fireEvent.click(await screen.findByRole("button", { name: "停止配音" }, { timeout: 3000 }));
  expect(await screen.findByRole("button", { name: "录制第 2 句" })).toBeInTheDocument();
  expect(video.currentTime).toBe(5);
  expect(screen.getByRole("checkbox", { name: "录完自动跳到下一句" })).toBeChecked();
});

it("deletes an unrecorded cue and selects its neighbor", async () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:movie");
  render(<Movie />);
  fireEvent.change(screen.getByLabelText("选择视频"), { target: { files: [new File(["video"], "clip.mp4", { type: "video/mp4" })] } });
  const text = "1\n00:00:01,000 --> 00:00:03,000\n你好\n\n2\n00:00:05,000 --> 00:00:07,000\n再见\n";
  const subtitle = new File([text], "lines.srt");
  Object.defineProperty(subtitle, "text", { value: async () => text });
  fireEvent.change(screen.getByLabelText("导入字幕"), { target: { files: [subtitle] } });
  await screen.findByLabelText("第 2 句台词");
  fireEvent.click(screen.getByRole("button", { name: "删除第 1 句" }));
  expect(screen.getByText("1 句")).toBeInTheDocument();
  expect(screen.getByLabelText("第 1 句台词")).toHaveValue("再见");
  expect(screen.getByRole("button", { name: "录制第 1 句" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "删除第 1 句" }));
  expect(screen.getByText("0 句")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "开始配音" })).toBeDisabled();
});

it("asks before deleting a cue with a saved recording", async () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValueOnce("blob:movie").mockReturnValueOnce("blob:take");
  const revoke = vi.spyOn(URL, "revokeObjectURL");
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) } });
  class Recorder {
    state = "inactive";
    mimeType = "audio/webm";
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: (() => void) | null = null;
    start() { this.state = "recording"; }
    stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["voice"]) }); this.onstop?.(); }
  }
  vi.stubGlobal("MediaRecorder", Recorder);
  render(<Movie />);
  fireEvent.change(screen.getByLabelText("选择视频"), { target: { files: [new File(["video"], "clip.mp4", { type: "video/mp4" })] } });
  const text = "1\n00:00:01,000 --> 00:00:03,000\n你好\n";
  const subtitle = new File([text], "lines.srt");
  Object.defineProperty(subtitle, "text", { value: async () => text });
  fireEvent.change(screen.getByLabelText("导入字幕"), { target: { files: [subtitle] } });
  fireEvent.click(await screen.findByRole("button", { name: "录制第 1 句" }));
  expect(screen.getByRole("button", { name: "删除第 1 句" })).toBeDisabled();
  fireEvent.click(await screen.findByRole("button", { name: "停止配音" }, { timeout: 3000 }));
  expect(await screen.findByLabelText("我的配音")).toHaveAttribute("src", "blob:take");
  fireEvent.click(screen.getByRole("button", { name: "删除第 1 句" }));
  expect(screen.getByText("1 句")).toBeInTheDocument();
  expect(revoke).not.toHaveBeenCalledWith("blob:take");
  fireEvent.click(screen.getByRole("button", { name: "删除第 1 句" }));
  expect(screen.getByText("0 句")).toBeInTheDocument();
  expect(revoke).toHaveBeenCalledWith("blob:take");
  expect(confirm).toHaveBeenCalledTimes(2);
});

it("shows the active Cantonese line over the video", async () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:movie");
  const { container } = render(<Movie />);
  fireEvent.change(screen.getByLabelText("选择视频"), { target: { files: [new File(["video"], "clip.mp4", { type: "video/mp4" })] } });
  const subtitle = new File(["1\n00:00:01,000 --> 00:00:03,000\n你好\n"], "lines.srt");
  Object.defineProperty(subtitle, "text", { value: async () => "1\n00:00:01,000 --> 00:00:03,000\n你好\n" });
  fireEvent.change(screen.getByLabelText("导入字幕"), { target: { files: [subtitle] } });
  await screen.findByLabelText("第 1 句台词");
  const video = container.querySelector("video")!;
  video.currentTime = 1.5;
  fireEvent.timeUpdate(video);
  expect(screen.getByLabelText("当前台词")).toHaveTextContent("你好");
});

it("accepts a separate background track for dialogue-free practice", () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValueOnce("blob:movie").mockReturnValueOnce("blob:background");
  render(<Movie />);
  fireEvent.change(screen.getByLabelText("选择视频"), { target: { files: [new File(["video"], "clip.mp4", { type: "video/mp4" })] } });
  fireEvent.change(screen.getByLabelText("选择背景音"), { target: { files: [new File(["audio"], "bg.wav", { type: "audio/wav" })] } });
  expect(screen.getByText("已导入背景音：bg.wav")).toBeInTheDocument();
  expect(document.querySelector("audio[data-background-track]")).toHaveAttribute("src", "blob:background");
});

it("keeps a separate background track aligned when playing and seeking", () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValueOnce("blob:movie").mockReturnValueOnce("blob:background");
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const { container } = render(<Movie />);
  fireEvent.change(screen.getByLabelText("选择视频"), { target: { files: [new File(["video"], "clip.mp4", { type: "video/mp4" })] } });
  fireEvent.change(screen.getByLabelText("选择背景音"), { target: { files: [new File(["audio"], "bg.wav", { type: "audio/wav" })] } });
  fireEvent.click(screen.getByRole("checkbox", { name: /播放视频原音/ }));
  const video = container.querySelector("video")!;
  const background = container.querySelector("audio[data-background-track]")! as HTMLAudioElement;
  Object.defineProperty(video, "paused", { configurable: true, value: false });
  video.currentTime = 3;
  fireEvent.seeked(video);
  expect(background.currentTime).toBe(3);
  fireEvent.play(video);
  expect(play).toHaveBeenCalledWith();
  expect(video.muted).toBe(true);
  fireEvent.pause(video);
  expect(pause).toHaveBeenCalled();
});

it("records a take for the selected subtitle line", async () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValueOnce("blob:movie").mockReturnValueOnce("blob:take");
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const tracks = [{ stop: vi.fn() }];
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => tracks }) } });
  class Recorder {
    state = "inactive";
    mimeType = "audio/webm";
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: (() => void) | null = null;
    start() { this.state = "recording"; }
    stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["voice"]) }); this.onstop?.(); }
  }
  vi.stubGlobal("MediaRecorder", Recorder);
  render(<Movie />);
  fireEvent.change(screen.getByLabelText("选择视频"), { target: { files: [new File(["video"], "clip.mp4", { type: "video/mp4" })] } });
  const subtitle = new File(["1\n00:00:01,000 --> 00:00:03,000\n你好\n"], "lines.srt");
  Object.defineProperty(subtitle, "text", { value: async () => "1\n00:00:01,000 --> 00:00:03,000\n你好\n" });
  fireEvent.change(screen.getByLabelText("导入字幕"), { target: { files: [subtitle] } });
  fireEvent.click(await screen.findByRole("button", { name: "录制第 1 句" }));
  fireEvent.click(await screen.findByRole("button", { name: "停止配音" }, { timeout: 3000 }));
  expect(await screen.findByText("这一句的配音")).toBeInTheDocument();
  expect(screen.getByLabelText("我的配音")).toHaveAttribute("src", "blob:take");
  expect(tracks[0].stop).toHaveBeenCalled();
  expect(pause).toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "录制第 1 句" })).toBeEnabled();
  expect(document.querySelector("video")?.muted).toBe(false);
});

function setupTranscription() {
  vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => blob instanceof File ? `blob:${blob.name}` : "blob:take");
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const view = render(<Movie />);
  const file = new File(["video"], "clip.mp4", { type: "video/mp4" });
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const load = (next = file) => {
    fireEvent.change(screen.getByLabelText("选择视频"), { target: { files: [next] } });
    const video = view.container.querySelector("video")!;
    Object.defineProperty(video, "duration", { configurable: true, value: 30 });
    fireEvent.loadedMetadata(video);
  };
  return { ...view, file, fetch, load };
}

it("only transcribes after clicking with a playable video", async () => {
  const { fetch, load, file, container } = setupTranscription();
  expect(screen.getByRole("button", { name: "自动生成台词" })).toBeDisabled();
  load();
  expect(fetch).not.toHaveBeenCalled();
  fetch.mockResolvedValue(new Response(JSON.stringify({ cues: [
    { startMs: 1000, endMs: 3000, text: "你好呀" },
    { startMs: 5000, endMs: 7000, text: "再见" },
  ] })));
  fireEvent.click(screen.getByRole("button", { name: "自动生成台词" }));
  expect(screen.getByRole("button", { name: "正在识别" })).toBeDisabled();
  expect(await screen.findByLabelText("第 2 句台词")).toHaveValue("再见");
  expect(fetch.mock.calls[0][1].body.get("file")).toBe(file);
  fireEvent.click(screen.getByRole("button", { name: "定位到第 2 句" }));
  expect(container.querySelector("video")?.currentTime).toBe(5);
});

it("does not upload if replacing current cues is cancelled", () => {
  const { fetch, load } = setupTranscription();
  load();
  fireEvent.click(screen.getByRole("button", { name: "新增台词" }));
  vi.spyOn(window, "confirm").mockReturnValue(false);
  fireEvent.click(screen.getByRole("button", { name: "自动生成台词" }));
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.getByLabelText("第 1 句台词")).toHaveValue("新台词");
});

it.each(["empty", "422", "network"])("keeps cues and recordings after %s", async (kind) => {
  const { fetch, load } = setupTranscription();
  const revoke = vi.spyOn(URL, "revokeObjectURL");
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) } });
  class Recorder {
    state = "inactive"; mimeType = "audio/webm";
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    start() { this.state = "recording"; }
    stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["voice"]) }); this.onstop?.(); }
  }
  vi.stubGlobal("MediaRecorder", Recorder);
  load();
  fireEvent.click(screen.getByRole("button", { name: "新增台词" }));
  fireEvent.click(screen.getByRole("button", { name: "录制第 1 句" }));
  fireEvent.click(await screen.findByRole("button", { name: "停止配音" }, { timeout: 3000 }));
  await screen.findByLabelText("我的配音");
  if (kind === "network") fetch.mockRejectedValue(new TypeError("offline"));
  else fetch.mockResolvedValue(new Response(kind === "empty" ? '{"cues":[]}' : '{"error":"视频没有音轨"}', { status: kind === "empty" ? 200 : 422 }));
  fireEvent.click(screen.getByRole("button", { name: "自动生成台词" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("第 1 句台词")).toHaveValue("新台词");
  expect(screen.getByLabelText("我的配音")).toHaveAttribute("src", "blob:take");
  expect(revoke).not.toHaveBeenCalledWith("blob:take");
});

it("aborts and ignores late results after switching videos", async () => {
  const { fetch, load } = setupTranscription();
  let resolve!: (value: Response) => void;
  fetch.mockImplementation(() => new Promise<Response>((done) => { resolve = done; }));
  load();
  fireEvent.click(screen.getByRole("button", { name: "自动生成台词" }));
  const signal = fetch.mock.calls[0][1].signal;
  load(new File(["next"], "next.mp4", { type: "video/mp4" }));
  expect(signal.aborted).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "新增台词" }));
  await act(async () => resolve(new Response('{"cues":[{"startMs":0,"endMs":1000,"text":"旧视频"}]}')));
  expect(screen.getByLabelText("第 1 句台词")).toHaveValue("新台词");
});

it("aborts an outstanding request on unmount", async () => {
  const { fetch, load, unmount } = setupTranscription();
  let resolve!: (value: Response) => void;
  fetch.mockImplementation(() => new Promise<Response>((done) => { resolve = done; }));
  load();
  fireEvent.click(screen.getByRole("button", { name: "自动生成台词" }));
  const signal = fetch.mock.calls[0][1].signal;
  unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => resolve(new Response('{"cues":[]}')));
});

it("waits for a pending SRT import before allowing replacement by transcription", async () => {
  const { fetch, load } = setupTranscription();
  load();
  let resolve!: (text: string) => void;
  const subtitle = new File(["srt"], "slow.srt");
  Object.defineProperty(subtitle, "text", { value: () => new Promise<string>((done) => { resolve = done; }) });
  fireEvent.change(screen.getByLabelText("导入字幕"), { target: { files: [subtitle] } });
  expect(screen.getByRole("button", { name: "自动生成台词" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "自动生成台词" }));
  expect(fetch).not.toHaveBeenCalled();
  await act(async () => resolve("1\n00:00:01,000 --> 00:00:03,000\n导入台词\n"));
  expect(screen.getByLabelText("第 1 句台词")).toHaveValue("导入台词");
  await waitFor(() => expect(screen.getByRole("button", { name: "自动生成台词" })).toBeEnabled());
  vi.spyOn(window, "confirm").mockReturnValue(false);
  fireEvent.click(screen.getByRole("button", { name: "自动生成台词" }));
  expect(fetch).not.toHaveBeenCalled();
});
