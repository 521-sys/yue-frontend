import { useState } from "react";
import { Sheet } from "./Sheet";
import { loginAndSync, registerAndSync } from "../lib/store";

/**
 * 登录/注册抽屉：调用后端账号接口，登录成功后自动拉取云端学习状态。
 * 用法：<AuthSheet onClose={() => setOpen(false)} />
 */
export function AuthSheet({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (username.trim().length < 3) {
      setError("用户名至少 3 个字符");
      return;
    }
    if (password.length < 6) {
      setError("密码至少 6 位");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        await loginAndSync(username.trim(), password);
      } else {
        await registerAndSync(username.trim(), password);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet title={mode === "login" ? "登录账号" : "注册账号"} onClose={onClose}>
      <div className="flex flex-col gap-3">
        {/* 模式切换 */}
        <div className="flex bg-[#EEF3FF] rounded-xl p-1">
          <button
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
              mode === "login" ? "bg-white text-[#2B5CE6] shadow-sm" : "text-gray-400"
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
              mode === "register" ? "bg-white text-[#2B5CE6] shadow-sm" : "text-gray-400"
            }`}
          >
            注册
          </button>
        </div>

        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="用户名（3~32 字符）"
          maxLength={32}
          className="w-full px-4 py-3 rounded-xl bg-[#EEF3FF] text-sm text-[#1a1a2e] outline-none focus:bg-white focus:ring-2 focus:ring-[#2B5CE6]/30 transition-all"
        />
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
          {loading ? "处理中..." : mode === "login" ? "登录" : "注册"}
        </button>

        <p className="text-gray-400 text-xs text-center leading-relaxed">
          {mode === "login"
            ? "登录后学习进度将云端同步，跨设备可用"
            : "注册即创建账号，当前本地进度会作为初始记录上传"}
        </p>
      </div>
    </Sheet>
  );
}
