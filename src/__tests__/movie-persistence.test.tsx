import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Movie from "../screens/MovieImitationScreen";
import { loadDubbingProject, saveDubbingProject, type DubbingProject } from "../lib/dubbing-project";

vi.mock("../lib/dubbing-project", () => ({ loadDubbingProject: vi.fn(), saveDubbingProject: vi.fn() }));
const draft = (): DubbingProject => ({ version: 1, video: new Blob(["video"], { type: "video/mp4" }), videoName: "clip.mp4",
  background: new Blob(["music"]), backgroundName: "music.wav", cues: [{ id: "a", startMs: 2000, endMs: 4000, text: "你好" }],
  takes: { a: { blob: new Blob(["voice"]), startMs: 1000 } }, selectedCueId: "a", playVideoAudio: false, autoAdvance: true,
});

beforeEach(() => {
  vi.mocked(loadDubbingProject).mockResolvedValue(undefined);
  vi.mocked(saveDubbingProject).mockResolvedValue();
  let id = 0;
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:restored-${++id}`);
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });

it("restores video, background, subtitles and takes with fresh URLs", async () => {
  vi.mocked(loadDubbingProject).mockResolvedValue(draft());
  const { container } = render(<Movie />);
  expect(await screen.findByLabelText("第 1 句台词")).toHaveValue("你好");
  expect(container.querySelector("video")).toHaveAttribute("src", "blob:restored-1");
  expect(container.querySelector("audio[data-background-track]")).toHaveAttribute("src", "blob:restored-2");
  expect(screen.getByLabelText("我的配音")).toHaveAttribute("src", "blob:restored-3");
  expect(screen.getByRole("checkbox", { name: /播放视频原音/ })).not.toBeChecked();
  expect(screen.getByRole("checkbox", { name: /录完自动/ })).toBeChecked();
  await waitFor(() => expect(saveDubbingProject).toHaveBeenCalled());
  expect(vi.mocked(saveDubbingProject).mock.lastCall?.[0].takes.a.startMs).toBe(1000);
  fireEvent.change(screen.getByLabelText("第 1 句台词"), { target: { value: "你好呀" } });
  await waitFor(() => expect(vi.mocked(saveDubbingProject).mock.lastCall?.[0].cues[0].text).toBe("你好呀"));
});

it("reports failed saves and lets the user retry without discarding the current draft", async () => {
  vi.mocked(loadDubbingProject).mockResolvedValue(draft());
  vi.mocked(saveDubbingProject).mockRejectedValue(new Error("QuotaExceededError"));
  render(<Movie />);
  expect(await screen.findByText(/保存失败，可能/)).toBeInTheDocument();
  expect(screen.getByLabelText("第 1 句台词")).toHaveValue("你好");
  vi.mocked(saveDubbingProject).mockResolvedValue();
  fireEvent.click(screen.getByRole("button", { name: "重试保存" }));
  expect(await screen.findByText("已保存到当前浏览器")).toBeInTheDocument();
});

it("does not replace a newly imported video with a late restored project", async () => {
  let resolve!: (value: DubbingProject) => void;
  vi.mocked(loadDubbingProject).mockReturnValue(new Promise((done) => { resolve = done; }));
  const { container } = render(<Movie />);
  fireEvent.change(screen.getByLabelText("选择视频"), { target: { files: [new File(["new"], "new.mp4", { type: "video/mp4" })] } });
  await act(async () => resolve(draft()));
  expect(container.querySelector("video")).toHaveAttribute("src", "blob:restored-1");
  expect(screen.queryByLabelText("第 1 句台词")).not.toBeInTheDocument();
  expect(vi.mocked(saveDubbingProject).mock.lastCall?.[0].videoName).toBe("new.mp4");
});

it("does not overwrite stored data when recovery fails", async () => {
  vi.mocked(loadDubbingProject).mockRejectedValue(new Error("incompatible draft"));
  render(<Movie />);
  await screen.findByText(/无法读取本机作品/);
  expect(saveDubbingProject).not.toHaveBeenCalled();
});
