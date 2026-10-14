import { expect, it } from "vitest";
import { recordingWindow, type DubbingCue } from "../lib/dubbing-timeline";

const cue = (id: string, startMs: number, endMs: number): DubbingCue => ({ id, startMs, endMs, text: id });

it("keeps full padding where there is enough space", () => {
  const current = cue("a", 2000, 4000);
  expect(recordingWindow(current, [current], 10000)).toEqual({ startMs: 1000, endMs: 5000, preparationMs: 0 });
});

it("shares short gaps without recording the adjacent cue or overlapping padding", () => {
  const previous = cue("a", 1000, 2000), current = cue("b", 2400, 4000), next = cue("c", 4200, 6000);
  const cues = [next, current, previous];
  const window = recordingWindow(current, cues, 10000);
  expect(window).toEqual({ startMs: 2200, endMs: 4100, preparationMs: 1000 });
  expect(recordingWindow(previous, cues, 10000).endMs).toBe(window.startMs);
  expect(recordingWindow(next, cues, 10000).startMs).toBe(window.endMs);
});

it("uses a paused preparation period for back-to-back cues", () => {
  const current = cue("b", 2000, 4000);
  expect(recordingWindow(current, [cue("a", 0, 2000), current, cue("c", 4000, 6000)], 6000))
    .toEqual({ startMs: 2000, endMs: 4000, preparationMs: 1000 });
});

it("does not shorten actual overlapping dialogue to make room for padding", () => {
  const current = cue("b", 2000, 4000);
  expect(recordingWindow(current, [cue("a", 1000, 2500), current], 10000))
    .toEqual({ startMs: 2000, endMs: 4000, preparationMs: 1000 });
});

it("respects video boundaries and prepares before a cue at the beginning", () => {
  const current = cue("a", 500, 2500);
  expect(recordingWindow(current, [current], 3000)).toEqual({ startMs: 0, endMs: 3000, preparationMs: 1000 });
});
