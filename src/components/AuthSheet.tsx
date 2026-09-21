import { useState } from "react";
import { Sheet } from "./Sheet";
import {
  loginAndSync,
  registerAndSync,
  phoneLoginAndSync,
  phoneRegisterAndSync,
} from "../lib/store";

const PHONE_RE = /^1[3-9]\d{9}$/;

/**
 * 登录/注册抽屉：支持「账号（用户名+密码）」与「手机号（手机号+密码）」两种方式，
 * 登录成功后自动拉取云端学习状态。
 * 用法：<AuthSheet onClose={() => setOpen(false)} />
 */
export function AuthSheet({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"account" | "phone">("account");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (tab === "account") {
      if (username.trim().length < 3) {
        setError("用户名至少 3 个字符");
        return;
      }
      if (password.length < 6) {
        setError("密码至少 6 位");
        return;
      }
    } else {
      if (!PHONE_RE.test(phone.trim())) {
        setError("请输入正确的 11 位手机号");
        return;
      }
      if (password.length < 6) {
        setError("密码至少 6 位");
        return;
      }
    }
    setLoading(true);
    try {
      if (tab === "account") {
        if (mode === "login") {
          await loginAndSync(username.trim(), password);
        } else {
          await registerAndSync(username.trim(), password);
        }
      } else {
        if (mode === "login") {
          await phoneLoginAndSync(phone.trim(), password);
        } else {
          await phoneRegisterAndSync(phone.trim(), password);
        }
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <Sheet title={isLogin ? "登录" : "注册"} onClose={onClose}>
      <div className="flex flex-col gap-3">
        {/* 登录方式 Tab：账号 / 手机号 */}
        <div className="flex bg-[#EEF3FF] rounded-xl p-1">
          {(
            [
              ["account", "账号"],
              ["phone", "手机号"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                setTab(key);
                setError("");
              }}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                tab === key ? "bg-white text-[#2B5CE6] shadow-sm" : "text-gray-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 登录/注册切换 */}
        <div className="flex bg-[#EEF3FF] rounded-xl p-1">
          <button
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
              isLogin ? "bg-white text-[#2B5CE6] shadow-sm" : "text-gray-400"
            }`}
          >
            登录
          </button>
          <button
            onClick={() => {
              setMode("register");
              setError("");
            }}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
              !isLogin ? "bg-white text-[#2B5CE6] shadow-sm" : "text-gray-400"
            }`}
          >
            注册
          </button>
        </div>

        {tab === "account" ? (
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="用户名（3~32 字符）"
            maxLength={32}
            className="w-full px-4 py-3 rounded-xl bg-[#EEF3FF] text-sm text-[#1a1a2e] outline-none focus:bg-white focus:ring-2 focus:ring-[#2B5CE6]/30 transition-all"
          />
        ) : (
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
            placeholder="手机号"
            maxLength={11}
            inputMode="numeric"
            className="w-full px-4 py-3 rounded-xl bg-[#EEF3FF] text-sm text-[#1a1a2e] outline-none focus:bg-white focus:ring-2 focus:ring-[#2B5CE6]/30 transition-all"
          />
        )}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="密码（6~64 位）"
          maxLength={64}
          className="w-full px-4 py-3 rounded-xl bg-[#EEF3FF] text-sm text-[#1a1a2e] outline-none focus:bg-white focus:ring-2 focus:ring-[#2B5CE6]/30 transition-all"
        />

        {error && <p className="text-[#ef4444] text-xs px-1">{error}</p>}

        <button
          onClick={submit}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-[#2B5CE6] text-white font-bold text-sm active:scale-95 transition-transform disabled:opacity-60 disabled:active:scale-100"
        >
          {loading ? "处理中..." : isLogin ? "登录" : "注册"}
        </button>

        <p className="text-gray-400 text-xs text-center leading-relaxed">
          {!isLogin && tab === "phone"
            ? "注册后昵称默认为「用户+尾号4位」，可在个人中心修改"
            : isLogin
              ? "登录后学习进度将云端同步，跨设备可用"
              : "注册即创建账号，当前本地进度会作为初始记录上传"}
        </p>
      </div>
    </Sheet>
  );
}
