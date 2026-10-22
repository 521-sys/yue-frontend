import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Movie from "../screens/MovieImitationScreen";
import type { DubbingProject } from "../lib/dubbing-project";

const loadProject = vi.fn<() => Promise<DubbingProject | undefined>>();
const saveProject = vi.fn<(project: DubbingProject, revision: { current: string | undefined }) => Promise<void>>();
const renderMovie = (props: Record<string, unknown> = {}) => render(<Movie loadProject={loadProject} saveProject={saveProject} {...props} />);
const draft = (): DubbingProject => ({ version: 1, video: new Blob(["video"], { type: "video/mp4" }), videoName: "clip.mp4",
  background: new Blob(["music"]), backgroundName: "music.wav", cues: [{ id: "a", startMs: 2000, endMs: 4000, text: "你好" }],
  takes: { a: { blob: new Blob(["voice"]), startMs: 1000 } }, selectedCueId: "a", playVideoAudio: false, autoAdvance: true,
});

beforeEach(() => {
  loadProject.mockResolvedValue(undefined);
  saveProject.mockResolvedValue();
  let id = 0;
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:restored-${++id}`);
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });

it("restores video, background, subtitles and takes with fresh URLs", async () => {
  loadProject.mockResolvedValue(draft());
  const { container } = renderMovie();
  expect(await screen.findByLabelText("第 1 句台词")).toHaveValue("你好");
  expect(container.querySelector("video")).toHaveAttribute("src", "blob:restored-1");
  expect(container.querySelector("audio[data-background-track]")).toHaveAttribute("src", "blob:restored-2");
  expect(screen.getByLabelText("我的配音")).toHaveAttribute("src", "blob:restored-3");
  expect(screen.getByRole("checkbox", { name: /播放视频原音/ })).not.toBeChecked();
  expect(screen.getByRole("checkbox", { name: /录完自动/ })).toBeChecked();
  await waitFor(() => expect(saveProject).toHaveBeenCalled());
  expect(saveProject.mock.lastCall?.[0].takes.a.startMs).toBe(1000);
  fireEvent.change(screen.getByLabelText("第 1 句台词"), { target: { value: "你好呀" } });
  await waitFor(() => expect(saveProject.mock.lastCall?.[0].cues[0].text).toBe("你好呀"));
  fireEvent.click(screen.getByRole("button", { name: "选择内置片段" }));
  expect(screen.getByRole("heading", { name: "内置粤语片段" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "继续当前作品" }));
  expect(screen.getByLabelText("第 1 句台词")).toHaveValue("你好呀");
});

it("restores and saves a built-in material draft", async () => {
  const materials = [{ id: "bus", title: "搭巴士", difficulty: "A1", tags: ["交通"], sourceLabel: "来源", sourceUrl: "https://example.com/source", licenseLabel: "CC BY", licenseUrl: "https://example.com/license",
    parts: [{ id: "one", label: "Part 01", title: "上车", videoSrc: "/media/bus.mp4", cues: [{ id: "a", startMs: 0, endMs: 1200, text: "原文" }] }],
  }];
  loadProject.mockResolvedValue({ version: 2, source: { kind: "built-in", materialId: "bus", partId: "one" }, background: null, backgroundName: "", cues: [{ id: "a", startMs: 0, endMs: 1200, text: "已修改" }], takes: {}, selectedCueId: "a", playVideoAudio: true, autoAdvance: false } as unknown as DubbingProject);
  const { container } = renderMovie({ materials });
  expect(await screen.findByLabelText("第 1 句台词")).toHaveValue("已修改");
  expect(container.querySelector("video")).toHaveAttribute("src", "/media/bus.mp4");
  await waitFor(() => expect(saveProject).toHaveBeenCalled());
  expect(saveProject.mock.lastCall?.[0]).toMatchObject({ version: 2, source: { kind: "built-in", materialId: "bus", partId: "one" } });
});

it("reports failed saves and lets the user retry without discarding the current draft", async () => {
  loadProject.mockResolvedValue(draft());
  saveProject.mockRejectedValue(new Error("QuotaExceededError"));
  renderMovie();
  expect(await screen.findByText(/保存失败，可能/)).toBeInTheDocument();
  expect(screen.getByLabelText("第 1 句台词")).toHaveValue("你好");
  saveProject.mockResolvedValue();
  fireEvent.click(screen.getByRole("button", { name: "重试保存" }));
  expect(await screen.findByText("已保存到当前浏览器")).toBeInTheDocument();
});

it("does not replace a newly imported video with a late restored project", async () => {
  let resolve!: (value: DubbingProject) => void;
  loadProject.mockReturnValue(new Promise((done) => { resolve = done; }));
  const { container } = renderMovie();
  fireEvent.change(screen.getByLabelText("选择视频"), { target: { files: [new File(["new"], "new.mp4", { type: "video/mp4" })] } });
  await act(async () => resolve(draft()));
  expect(container.querySelector("video")).toHaveAttribute("src", "blob:restored-1");
  expect(screen.queryByLabelText("第 1 句台词")).not.toBeInTheDocument();
  expect(saveProject.mock.lastCall?.[0].videoName).toBe("new.mp4");
});

it("does not overwrite stored data when recovery fails", async () => {
  loadProject.mockRejectedValue(new Error("incompatible draft"));
  renderMovie();
  await screen.findByText(/无法读取本机作品/);
  expect(saveProject).not.toHaveBeenCalled();
});
