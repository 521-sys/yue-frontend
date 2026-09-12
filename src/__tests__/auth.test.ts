import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import * as store from "../lib/store";
import { AUTH_CHANGED_EVENT } from "../lib/api";

// fetch mock 工具：返回 200 JSON 响应
function jsonOk(data: unknown) {
  return { ok: true, status: 200, json: async () => data } as Response;
}

const fetchMock = vi.fn();

describe("登录与云端同步（store + api 联动）", () => {
  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    store.resetAll();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("registerAndSync：注册成功后保存 token，并上传本地状态作为初始记录", async () => {
    fetchMock.mockImplementation(async (url: string | URL, init?: RequestInit) => {
      if (String(url).endsWith("/api/auth/register")) {
        return jsonOk({ token: "t1", username: "u1", userId: 1 });
      }
      return jsonOk({ status: "synced", updatedAt: "2026-09-02T00:00:00Z" });
    });

    await store.registerAndSync("u1", "123456");

    expect(localStorage.getItem("yueToken")).toBe("t1");
    const put = fetchMock.mock.calls.find(([, i]) => i?.method === "PUT");
    expect(put).toBeTruthy();
    expect(String((put?.[1] as RequestInit).body)).toContain('"coins":128');
  });

  it("loginAndSync：登录后拉取云端状态覆盖本地", async () => {
    fetchMock.mockImplementation(async (url: string | URL) => {
      if (String(url).endsWith("/api/auth/login")) {
        return jsonOk({ token: "t2", username: "u2", userId: 2 });
      }
      return jsonOk({ hasCloudData: true, state: { coins: 555, learned: ["w9"] } });
    });

    const r = await store.loginAndSync("u2", "123456");

    expect(r.username).toBe("u2");
    expect(localStorage.getItem("yueToken")).toBe("t2");
    expect(store.getState().coins).toBe(555);
    expect(store.getState().learned).toContain("w9");
    // 拉取覆盖本地时不应触发回灌上传
    const putCalls = fetchMock.mock.calls.filter(([, i]) => i?.method === "PUT");
    expect(putCalls.length).toBe(0);
  });

  it("loginAndSync：云端无数据时保留本地默认状态", async () => {
    fetchMock.mockImplementation(async (url: string | URL) => {
      if (String(url).endsWith("/api/auth/login")) {
        return jsonOk({ token: "t3", username: "u3", userId: 3 });
      }
      return jsonOk({ hasCloudData: false });
    });

    await store.loginAndSync("u3", "123456");

    expect(store.getState().coins).toBe(128);
  });

  it("token 失效（401）：自动清除登录态并广播事件", async () => {
    vi.useFakeTimers();
    localStorage.setItem("yueToken", "expired");
    const fired = vi.fn();
    window.addEventListener(AUTH_CHANGED_EVENT, fired);

    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "未登录或登录已过期" }),
    } as Response);

    // 学习动作触发防抖上传（1.5s），401 后应清除 token
    store.markLearned("w1");
    await vi.advanceTimersByTimeAsync(1600);

    expect(localStorage.getItem("yueToken")).toBeNull();
    expect(fired).toHaveBeenCalled();
    window.removeEventListener(AUTH_CHANGED_EVENT, fired);
  });

  it("logout：清除 token 并广播登录状态变化事件", () => {
    localStorage.setItem("yueToken", "t4");
    const fired = vi.fn();
    window.addEventListener(AUTH_CHANGED_EVENT, fired);

    store.logout();

    expect(localStorage.getItem("yueToken")).toBeNull();
    expect(fired).toHaveBeenCalled();
    window.removeEventListener(AUTH_CHANGED_EVENT, fired);
  });
});
