import { expect, it } from "vitest";
import { activeCueAt, cueIsValid, parseSrt, serializeSrt } from "../lib/dubbing-timeline";

it("imports multiline SRT cues with millisecond positions", () => {
  const cues = parseSrt("\uFEFF1\r\n00:00:01,250 --> 00:00:03,500\r\n你食咗飯未？\r\n好耐冇見。\r\n\r\n2\r\n00:00:04,000 --> 00:00:05,200\r\n係呀。\r\n");
  expect(cues).toEqual([
    { id: "cue-1", startMs: 1250, endMs: 3500, text: "你食咗飯未？\n好耐冇見。" },
    { id: "cue-2", startMs: 4000, endMs: 5200, text: "係呀。" },
  ]);
});

it("rejects a subtitle file with no valid timed cues", () => {
  expect(() => parseSrt("hello world")).toThrow("没有找到有效字幕");
});

it("round-trips edited cue text and timestamps", () => {
  const text = serializeSrt([{ id: "custom", startMs: 60123, endMs: 62500, text: "我嚟配音" }]);
  expect(text).toBe("1\n00:01:00,123 --> 00:01:02,500\n我嚟配音\n");
  expect(parseSrt(text)[0]).toMatchObject({ startMs: 60123, endMs: 62500, text: "我嚟配音" });
});

it("highlights a cue only inside its time window", () => {
  const cues = [{ id: "one", startMs: 1000, endMs: 2000, text: "你好" }];
  expect(activeCueAt(cues, 999)).toBeNull();
  expect(activeCueAt(cues, 1500)?.id).toBe("one");
  expect(activeCueAt(cues, 2000)).toBeNull();
});

it("does not allow recording an empty or out-of-range subtitle interval", () => {
  const cue = { id: "one", startMs: 1000, endMs: 2000, text: "你好" };
  expect(cueIsValid(cue, 3000)).toBe(true);
  expect(cueIsValid({ ...cue, endMs: 1000 }, 3000)).toBe(false);
  expect(cueIsValid({ ...cue, endMs: 4000 }, 3000)).toBe(false);
  expect(cueIsValid({ ...cue, text: "  " }, 3000)).toBe(false);
});
