import { afterEach, expect, it, vi } from "vitest";
import { DubbingPreview } from "../lib/dubbing-preview";

let preview: DubbingPreview | undefined;
afterEach(() => { preview?.dispose(); preview = undefined; vi.restoreAllMocks(); vi.useRealTimers(); });

function setup(secondStartMs = 4500) {
  vi.useFakeTimers();
  const video = document.createElement("video");
  const first = document.createElement("audio");
  const second = document.createElement("audio");
  const background = document.createElement("audio");
  for (const element of [video, first, second, background]) {
    let paused = true;
    Object.defineProperty(element, "paused", { get: () => paused });
    Object.defineProperty(element, "duration", { value: 20 });
    vi.spyOn(element, "play").mockImplementation(async () => { paused = false; element.dispatchEvent(new Event("play")); });
    vi.spyOn(element, "pause").mockImplementation(() => { paused = true; element.dispatchEvent(new Event("pause")); });
  }
  const error = vi.fn();
  const ended = vi.fn();
  preview = new DubbingPreview(video, [
    { cueStartMs: 2000, cueEndMs: 4000, recordedStartMs: 1000, audio: first },
    { cueStartMs: secondStartMs, cueEndMs: 6500, recordedStartMs: secondStartMs - 1000, audio: second },
  ], background, error, ended);
  return { video, first, second, background, error, ended };
}

it("mutes the original and aligns takes using their recorded start, trimming overlapping padding", async () => {
  const { video, first, second, background } = setup();
  await preview!.start();
  expect(video.muted).toBe(true);
  video.currentTime = 2.4;
  video.dispatchEvent(new Event("seeked"));
  await Promise.resolve();
  expect(first.currentTime).toBeCloseTo(1.4);
  expect(first.paused).toBe(false);
  expect(second.paused).toBe(true);
  expect(background.currentTime).toBeCloseTo(2.4);
  video.currentTime = 4.2;
  video.dispatchEvent(new Event("timeupdate"));
  expect(first.paused).toBe(true);
  expect(second.paused).toBe(true);
  video.currentTime = 4.8;
  video.dispatchEvent(new Event("timeupdate"));
  await Promise.resolve();
  expect(second.currentTime).toBeCloseTo(1.3);
  expect(second.paused).toBe(false);
  expect(first.paused).toBe(true);
});

it("plays both voices where actual cue intervals overlap", async () => {
  const { video, first, second } = setup(3000);
  await preview!.start();
  video.currentTime = 3.5;
  video.dispatchEvent(new Event("seeked"));
  await Promise.resolve();
  expect(first.paused).toBe(false);
  expect(second.paused).toBe(false);
  expect(first.currentTime).toBe(2.5);
  expect(second.currentTime).toBe(1.5);
});

it("pauses all audio, resumes and follows seeking and playback rate", async () => {
  const { video, first, second, background } = setup();
  await preview!.start();
  video.currentTime = 2;
  video.dispatchEvent(new Event("seeked"));
  await Promise.resolve();
  video.pause();
  expect(first.paused).toBe(true);
  expect(background.paused).toBe(true);
  video.currentTime = 5;
  video.dispatchEvent(new Event("seeked"));
  expect(second.paused).toBe(true);
  expect(second.currentTime).toBe(1.5);
  video.playbackRate = 1.5;
  video.dispatchEvent(new Event("ratechange"));
  await video.play();
  expect(second.playbackRate).toBe(1.5);
  expect(background.playbackRate).toBe(1.5);
  expect(second.paused).toBe(false);
});

it("pauses during buffering and resumes on playing", async () => {
  const { video, first, background } = setup();
  await preview!.start();
  video.currentTime = 2;
  video.dispatchEvent(new Event("timeupdate"));
  await Promise.resolve();
  video.dispatchEvent(new Event("waiting"));
  vi.advanceTimersByTime(150);
  expect(first.paused).toBe(true);
  expect(background.paused).toBe(true);
  video.dispatchEvent(new Event("playing"));
  await Promise.resolve();
  expect(first.paused).toBe(false);
});

it("stops audio and removes synchronization on disposal", async () => {
  const { video, first, background } = setup();
  await preview!.start();
  video.currentTime = 2;
  video.dispatchEvent(new Event("timeupdate"));
  await Promise.resolve();
  preview!.dispose();
  expect(first.paused).toBe(true);
  expect(background.paused).toBe(true);
  expect(video.muted).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
  await video.play();
  expect(first.paused).toBe(true);
});

it("reports playback failure instead of silently previewing missing audio", async () => {
  const { video, first, error } = setup();
  vi.mocked(first.play).mockRejectedValue(new Error("unsupported"));
  await preview!.start();
  video.currentTime = 2;
  video.dispatchEvent(new Event("timeupdate"));
  await Promise.resolve();
  expect(error).toHaveBeenCalled();
  expect(video.paused).toBe(true);
});

it("notifies when the video ends and keeps original sound muted if controls try to unmute", async () => {
  const { video, ended } = setup();
  await preview!.start();
  video.muted = false;
  video.dispatchEvent(new Event("volumechange"));
  expect(video.muted).toBe(true);
  video.dispatchEvent(new Event("ended"));
  expect(ended).toHaveBeenCalledOnce();
});
