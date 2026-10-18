import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => {
  let token: string | null = null;
  return {
    login: vi.fn(),
    register: vi.fn(),
    phoneLogin: vi.fn(),
    phoneRegister: vi.fn(),
    smsLogin: vi.fn(),
    fetchState: vi.fn(),
    pushState: vi.fn(),
    setToken: vi.fn((next: string) => { token = next; }),
    clearToken: vi.fn(() => { token = null; }),
    getToken: vi.fn(() => token),
    isLoggedin: vi.fn(() => Boolean(token)),
    currentUser: vi.fn(() => "tester"),
    setTestToken(next: string | null) { token = next; },
  };
});

vi.mock("../lib/api", () => api);

import { clearSyncStatus, getSyncStatus, setSyncStatus, subscribeSyncStatus } from "../lib/sync-status";
import { getState, loginAndSync, logout, markLearned, resetAll } from "../lib/store";

async function drainUpload() {
  await vi.advanceTimersByTimeAsync(1500);
}

describe("云端同步状态", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    api.setTestToken(null);
    logout();
    resetAll();
    clearSyncStatus();
  });

  afterEach(() => {
    logout();
    vi.useRealTimers();
  });

  it("订阅状态变更并忽略重复值", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSyncStatus(listener);
    setSyncStatus("syncing");
    setSyncStatus("syncing");
    setSyncStatus("synced");
    expect(listener).toHaveBeenCalledTimes(2);
    expect(getSyncStatus()).toBe("synced");
    unsubscribe();
    clearSyncStatus();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("已登录的本地保存先进入同步中，上传成功后显示已同步", async () => {
    api.setTestToken("token");
    api.pushState.mockResolvedValue(undefined);
    markLearned("w1");
    expect(getSyncStatus()).toBe("syncing");
    await drainUpload();
    expect(api.pushState).toHaveBeenCalledWith(expect.objectContaining({ learned: ["w1"] }));
    expect(getSyncStatus()).toBe("synced");
  });

  it("上传失败显示错误且保留本地学习状态", async () => {
    api.setTestToken("token");
    api.pushState.mockRejectedValue(new Error("offline"));
    markLearned("local-only");
    await drainUpload();
    expect(getSyncStatus()).toBe("error");
    expect(getState().learned).toContain("local-only");
  });

  it("登录拉取成功显示已同步，失败显示错误但不阻塞登录", async () => {
    api.login.mockResolvedValue({ token: "one", username: "tester" });
    api.fetchState.mockResolvedValueOnce({ hasCloudData: false, state: null });
    await expect(loginAndSync("tester", "secret1")).resolves.toEqual({ username: "tester" });
    expect(getSyncStatus()).toBe("synced");

    api.fetchState.mockRejectedValueOnce(new Error("offline"));
    await expect(loginAndSync("tester", "secret1")).resolves.toEqual({ username: "tester" });
    expect(getSyncStatus()).toBe("error");
  });

  it("退出登录取消待上传任务、清空显示状态并保留本地数据", async () => {
    api.setTestToken("token");
    markLearned("keep-me");
    expect(getSyncStatus()).toBe("syncing");
    logout();
    await drainUpload();
    expect(api.pushState).not.toHaveBeenCalled();
    expect(getSyncStatus()).toBe("idle");
    expect(getState().learned).toContain("keep-me");
  });
});
