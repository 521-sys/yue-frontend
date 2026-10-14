import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Blob as NativeBlob } from "node:buffer";
import { IDBFactory } from "fake-indexeddb";
import { loadDubbingProject, saveDubbingProject, type DubbingProject } from "../lib/dubbing-project";

beforeEach(() => { vi.stubGlobal("indexedDB", new IDBFactory()); vi.stubGlobal("Blob", NativeBlob); });
afterEach(() => vi.unstubAllGlobals());

const project = (): DubbingProject => ({
  version: 1, video: new Blob(["video"], { type: "video/mp4" }), videoName: "clip.mp4",
  background: new Blob(["music"]), backgroundName: "music.wav",
  cues: [{ id: "one", startMs: 2000, endMs: 4000, text: "你好" }],
  takes: { one: { blob: new Blob(["voice"]), startMs: 1000 } }, selectedCueId: "one",
  playVideoAudio: false, autoAdvance: true,
});

it("returns no draft for a new browser", async () => {
  expect(await loadDubbingProject()).toBeUndefined();
});

it("restores media and timing rather than temporary blob URLs", async () => {
  const draft = project();
  await saveDubbingProject(draft, { current: undefined });
  const restored = await loadDubbingProject();
  expect(restored?.cues).toEqual(draft.cues);
  expect(restored?.takes.one.startMs).toBe(1000);
  expect(restored?.videoName).toBe("clip.mp4");
  expect(restored?.playVideoAudio).toBe(false);
  expect(await restored?.video.text()).toBe("video");
  expect(await restored?.takes.one.blob.text()).toBe("voice");
});

it("keeps unfinished text edits recoverable", async () => {
  const draft = project(); draft.cues[0].text = "";
  await saveDubbingProject(draft, { current: undefined });
  expect((await loadDubbingProject())?.cues[0].text).toBe("");
});

it("keeps the latest save when updates arrive together", async () => {
  const first = project(), second = project();
  second.cues[0].text = "你好呀";
  const revision = { current: undefined as string | undefined };
  await Promise.all([saveDubbingProject(first, revision), saveDubbingProject(second, revision)]);
  expect((await loadDubbingProject())?.cues[0].text).toBe("你好呀");
});

it("reports unavailable browser storage", async () => {
  vi.stubGlobal("indexedDB", undefined);
  await expect(saveDubbingProject(project(), { current: undefined })).rejects.toThrow();
  await expect(loadDubbingProject()).rejects.toThrow();
});


it("rejects a stale tab without deleting the newer saved recording", async () => {
  const revisionA = { current: undefined as string | undefined };
  await saveDubbingProject(project(), revisionA);
  const revisionB = { current: revisionA.current };
  const newer = project(); newer.cues[0].text = "新录音";
  await saveDubbingProject(newer, revisionA);
  await expect(saveDubbingProject(project(), revisionB)).rejects.toThrow("另一页面");
  expect((await loadDubbingProject())?.cues[0].text).toBe("新录音");
});
