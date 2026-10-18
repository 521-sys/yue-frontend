import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProfileScreen from "../screens/ProfileScreen";
import { AuthFlow } from "../components/auth/AuthFlow";
import { LoginPanel } from "../components/auth/LoginPanel";
import * as store from "../lib/store";
import * as api from "../lib/api";
import { useSyncStatus } from "../lib/sync-status";

vi.mock("../lib/store", async (load) => {
  const actual = await load<typeof import("../lib/store")>();
  return { ...actual, loginAndSync: vi.fn(), phoneLoginAndSync: vi.fn(), smsLoginAndSync: vi.fn(), registerAndSync: vi.fn(), phoneRegisterAndSync: vi.fn() };
});
vi.mock("../lib/api", async (load) => {
  const actual = await load<typeof import("../lib/api")>();
  return { ...actual, sendSmsLoginCode: vi.fn(), getProfile: vi.fn(), updateProfile: vi.fn() };
});
vi.mock("../lib/sync-status", async (load) => {
  const actual = await load<typeof import("../lib/sync-status")>();
  return { ...actual, useSyncStatus: vi.fn(() => "synced") };
});
vi.mock("../components/profile/FavoritesView", () => ({
  default: ({ onBack, onOpenScene }: { onBack: () => void; onOpenScene: (id: number) => void }) => <div><h1>收藏测试页</h1><button onClick={() => onOpenScene(7)}>打开测试场景</button><button onClick={onBack}>返回账号中心</button></div>,
}));

describe("登录界面", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(api.getProfile).mockResolvedValue({ username: "tester", nickname: "阿明", avatar: "😎" });
    vi.mocked(useSyncStatus).mockReturnValue("synced");
  });

  it("未登录的我的页面直接显示认证表单并隐藏设置", () => {
    render(<ProfileScreen />);
    expect(screen.getByRole("heading", { name: "欢迎回来" })).toBeInTheDocument();
    expect(screen.getByText("登录后继续你的粤语练习")).toBeInTheDocument();
    expect(screen.getByLabelText("手机号或用户名")).toBeInTheDocument();
    expect(screen.getByLabelText("密码")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "首次使用？创建账号" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "短信登录" })).not.toBeInTheDocument();
    expect(screen.queryByText("基础设置")).not.toBeInTheDocument();
    expect(screen.queryByText("每日学习目标")).not.toBeInTheDocument();
    expect(screen.queryByText("重置学习进度")).not.toBeInTheDocument();
  });

  it("密码登录按手机号或用户名选择接口，支持回车与密码可见切换", async () => {
    vi.mocked(store.phoneLoginAndSync).mockResolvedValue({ username: "user5678" });
    const done = vi.fn();
    render(<AuthFlow onAuthenticated={done} />);
    await userEvent.type(screen.getByLabelText("手机号或用户名"), "13812345678");
    await userEvent.type(screen.getByLabelText("密码"), "123456{enter}");
    await waitFor(() => expect(store.phoneLoginAndSync).toHaveBeenCalledWith("13812345678", "123456"));
    expect(done).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "显示密码" }));
    expect(screen.getByLabelText("密码")).toHaveAttribute("type", "text");
  });

  it("快速注册进入独立注册页并可返回", async () => {
    render(<AuthFlow />);
    fireEvent.click(screen.getByRole("button", { name: "首次使用？创建账号" }));
    expect(screen.getByRole("heading", { name: "创建账号" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "返回登录" }));
    expect(screen.getByLabelText("手机号或用户名")).toBeInTheDocument();
  });

  it("短信登录本地校验、按后端秒数倒计时并提交六位验证码", async () => {
    vi.mocked(api.sendSmsLoginCode).mockResolvedValue({ accepted: true, retryAfterSeconds: 60 });
    vi.mocked(store.smsLoginAndSync).mockResolvedValue({ username: "user5678" });
    function SmsHarness() {
      const [phone, setPhone] = useState("");
      return <LoginPanel phone={phone} onPhoneChange={setPhone} onRegister={() => {}} smsEnabled />;
    }
    render(<SmsHarness />);
    fireEvent.click(screen.getByRole("tab", { name: "短信登录" }));
    await userEvent.type(screen.getByLabelText("手机号"), "123");
    fireEvent.click(screen.getByRole("button", { name: "获取验证码" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("请输入正确的11位手机号");
    fireEvent.change(screen.getByLabelText("手机号"), { target: { value: "13812345678" } });
    fireEvent.click(screen.getByRole("button", { name: "获取验证码" }));
    expect(await screen.findByRole("button", { name: "60秒后重发" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("验证码"), "123456");
    fireEvent.click(screen.getByRole("button", { name: "登录" }));
    await waitFor(() => expect(store.smsLoginAndSync).toHaveBeenCalledWith("13812345678", "123456"));
  });

  it("登录后显示 C3 账号中心且不再出现旧设置", async () => {
    localStorage.setItem("yueToken", "token");
    render(<ProfileScreen />);
    expect(await screen.findByText("阿明")).toBeInTheDocument();
    expect(screen.getByText("@tester")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑资料" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "我的收藏" })).toBeInTheDocument();
    expect(screen.getByText("已同步")).toBeInTheDocument();
    expect(screen.queryByText("基础设置")).not.toBeInTheDocument();
    expect(screen.queryByText("每日学习目标")).not.toBeInTheDocument();
    expect(screen.queryByText("重置学习进度")).not.toBeInTheDocument();
  });

  it.each([
    ["idle", "尚未同步"],
    ["syncing", "正在同步"],
    ["synced", "已同步"],
    ["error", "同步失败"],
  ] as const)("同步状态 %s 显示为 %s", async (status, label) => {
    localStorage.setItem("yueToken", "token");
    vi.mocked(useSyncStatus).mockReturnValue(status);
    render(<ProfileScreen />);
    expect(await screen.findByText(label)).toBeInTheDocument();
  });

  it("可以编辑资料、进入收藏、返回并把收藏场景交给上层打开", async () => {
    localStorage.setItem("yueToken", "token");
    const onOpenScene = vi.fn();
    render(<ProfileScreen onOpenScene={onOpenScene} />);
    await screen.findByText("阿明");
    fireEvent.click(screen.getByRole("button", { name: "编辑资料" }));
    const editTitle = screen.getByText("编辑资料");
    expect(editTitle).toBeInTheDocument();
    fireEvent.click(editTitle.parentElement!.querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: "我的收藏" }));
    expect(screen.getByRole("heading", { name: "收藏测试页" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "打开测试场景" }));
    expect(onOpenScene).toHaveBeenCalledWith(7);
    fireEvent.click(screen.getByRole("button", { name: "返回账号中心" }));
    expect(screen.getByRole("button", { name: "我的收藏" })).toBeInTheDocument();
  });

  it("退出登录回到极简登录，迟到的资料响应不会恢复旧用户", async () => {
    let resolve!: (profile: api.Profile) => void;
    vi.mocked(api.getProfile).mockReturnValue(new Promise((done) => { resolve = done; }));
    localStorage.setItem("yueToken", "token");
    render(<ProfileScreen />);
    fireEvent.click(screen.getByRole("button", { name: "退出登录" }));
    expect(screen.getByRole("heading", { name: "欢迎回来" })).toBeInTheDocument();
    await act(async () => resolve({ username: "old-user", nickname: "旧用户" }));
    expect(screen.queryByText("旧用户")).not.toBeInTheDocument();
  });
});
