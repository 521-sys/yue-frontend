import { afterEach, expect, it, vi } from "vitest";
import { transcribeLocalVideo } from "../lib/local-transcription";

afterEach(() => vi.unstubAllGlobals());
const file = new File(["video"], "clip.mp4", { type: "video/mp4" });

it("uploads the selected file with cancellation and returns validated cues", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ cues: [{ startMs: 1250, endMs: 2500, text: "你好" }] })));
  vi.stubGlobal("fetch", fetch);
  const signal = new AbortController().signal;
  expect(await transcribeLocalVideo(file, signal)).toEqual([{ startMs: 1250, endMs: 2500, text: "你好" }]);
  const [url, options] = fetch.mock.calls[0];
  expect(url).toBe("http://127.0.0.1:8765/transcribe");
  expect(options.method).toBe("POST");
  expect(options.body.get("file")).toBe(file);
  expect(options.signal).toBe(signal);
});

it("accepts zero cues", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"cues":[]}')));
  expect(await transcribeLocalVideo(file)).toEqual([]);
});

it.each([422, 503])("shows server error %s", async (status) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"error":"模型或视频不可用"}', { status })));
  await expect(transcribeLocalVideo(file)).rejects.toThrow("模型或视频不可用");
});

it("explains a connection failure", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
  await expect(transcribeLocalVideo(file)).rejects.toThrow("本地识别服务未启动");
});

it.each([{}, { cues: [{ startMs: -1, endMs: 20, text: "错" }] }, { cues: [{ startMs: 0.5, endMs: 20, text: "错" }] }, { cues: [{ startMs: 20, endMs: 20, text: "错" }] }, { cues: [{ startMs: 0, endMs: 20, text: " " }] }, { cues: [null] }])("rejects malformed results %j", async (body) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body))));
  await expect(transcribeLocalVideo(file)).rejects.toThrow("格式");
});

it("preserves cancellation", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError")));
  await expect(transcribeLocalVideo(file)).rejects.toMatchObject({ name: "AbortError" });
});
