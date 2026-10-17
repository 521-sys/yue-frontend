import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProfileScreen from "../screens/ProfileScreen";
import { AuthFlow } from "../components/auth/AuthFlow";
import * as store from "../lib/store";
import * as api from "../lib/api";

vi.mock("../lib/store", async (load) => {
  const actual = await load<typeof import("../lib/store")>();
  return { ...actual, loginAndSync: vi.fn(), phoneLoginAndSync: vi.fn(), smsLoginAndSync: vi.fn(), registerAndSync: vi.fn(), phoneRegisterAndSync: vi.fn() };
});
vi.mock("../lib/api", async (load) => {
  const actual = await load<typeof import("../lib/api")>();
  return { ...actual, sendSmsLoginCode: vi.fn() };
});

describe("登录界面", () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });

  it("未登录的我的页面直接显示认证表单并隐藏设置", () => {
    render(<ProfileScreen />);
    expect(screen.getByRole("tab", { name: "密码登录" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "短信登录" })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "快速注册" }));
    expect(screen.getByRole("heading", { name: "创建账号" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "返回登录" }));
    expect(screen.getByRole("tab", { name: "密码登录" })).toBeInTheDocument();
  });

  it("短信登录本地校验、按后端秒数倒计时并提交六位验证码", async () => {
    vi.mocked(api.sendSmsLoginCode).mockResolvedValue({ accepted: true, retryAfterSeconds: 60 });
    vi.mocked(store.smsLoginAndSync).mockResolvedValue({ username: "user5678" });
    render(<AuthFlow />);
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
});
