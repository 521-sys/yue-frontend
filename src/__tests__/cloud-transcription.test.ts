import { afterEach, expect, it, vi } from "vitest";
import { transcribeCloudVideo } from "../lib/cloud-transcription";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); localStorage.clear(); });
const video = new File(["video"], "clip.mp4");
it("requires login before sending a video", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  await expect(transcribeCloudVideo(video)).rejects.toThrow("登录");
  expect(fetcher).not.toHaveBeenCalled();
});
it("submits once then polls and returns validated cues", async () => {
  localStorage.setItem("yueToken", "test-token"); vi.useFakeTimers();
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ id: "abc", status: "preparing" }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "abc", status: "succeeded", cues: [{ startMs: 10, endMs: 900, text: "你好" }] }) });
  vi.stubGlobal("fetch", fetcher);
  const promise = transcribeCloudVideo(video);
  await vi.runAllTimersAsync();
  expect(await promise).toEqual([{ startMs: 10, endMs: 900, text: "你好" }]);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBe("Bearer test-token");
  expect(fetcher.mock.calls[1][1].method).toBe("GET");
});
it("does not retry uncertain submissions", async () => {
  localStorage.setItem("yueToken", "test-token");
  const fetcher = vi.fn().mockRejectedValue(new TypeError("offline")); vi.stubGlobal("fetch", fetcher);
  await expect(transcribeCloudVideo(video)).rejects.toThrow("重复提交");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("rejects malformed cues", async () => {
  localStorage.setItem("yueToken", "test-token");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "abc", status: "succeeded", cues: [{ startMs: 90, endMs: 2, text: "错" }] }) }));
  await expect(transcribeCloudVideo(video)).rejects.toThrow("格式");
});
it("honors cancellation before upload", async () => {
  localStorage.setItem("yueToken", "test-token");
  const controller = new AbortController(); controller.abort();
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  await expect(transcribeCloudVideo(video, controller.signal)).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
