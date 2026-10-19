import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { sendEmailLoginCode, sendSmsLoginCode } from "../../lib/api";
import { EMAIL_LOGIN_ENABLED, SMS_LOGIN_ENABLED } from "../../lib/feature-flags";
import { emailLoginAndSync, loginAndSync, phoneLoginAndSync, smsLoginAndSync } from "../../lib/store";

const PHONE_RE = /^1[3-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type LoginTab = "password" | "email" | "sms";

export function LoginPanel({
  phone, onPhoneChange, onRegister, onAuthenticated,
  smsEnabled = SMS_LOGIN_ENABLED, emailEnabled = EMAIL_LOGIN_ENABLED,
}: {
  phone: string; onPhoneChange: (phone: string) => void; onRegister: () => void;
  onAuthenticated?: () => void; smsEnabled?: boolean; emailEnabled?: boolean;
}) {
  const [tab, setTab] = useState<LoginTab>("password");
  const [identifier, setIdentifier] = useState(phone);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!countdown) return;
    const timer = window.setInterval(() => setCountdown((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [countdown > 0]);

  function switchTab(next: LoginTab) {
    if (next === "sms" && /^\d*$/.test(identifier)) onPhoneChange(identifier.slice(0, 11));
    if (next === "password" && !identifier) setIdentifier(phone);
    setTab(next); setCountdown(0); setError("");
  }

  const normalizedEmail = () => email.trim().toLowerCase();
  const validEmail = (value: string) => value.length <= 254 && EMAIL_RE.test(value);

  async function sendSmsCode() {
    setError("");
    if (!PHONE_RE.test(phone)) { setError("请输入正确的11位手机号"); return; }
    setSending(true);
    try { const result = await sendSmsLoginCode(phone); setCountdown(result.retryAfterSeconds); }
    catch (e) { setError(e instanceof Error ? e.message : "验证码发送失败"); }
    finally { setSending(false); }
  }

  async function sendEmailCode() {
    setError("");
    const value = normalizedEmail();
    if (!validEmail(value)) { setError("请输入正确的邮箱地址"); return; }
    setSending(true);
    try { const result = await sendEmailLoginCode(value); setCountdown(result.retryAfterSeconds); }
    catch (e) { setError(e instanceof Error ? e.message : "验证码发送失败"); }
    finally { setSending(false); }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (tab === "password") {
      const value = identifier.trim();
      if (value.length < 3) { setError("请输入手机号或用户名"); return; }
      if (password.length < 6) { setError("密码至少6位"); return; }
      setLoading(true);
      try { if (PHONE_RE.test(value)) await phoneLoginAndSync(value, password); else await loginAndSync(value, password); onAuthenticated?.(); }
      catch (e) { setError(e instanceof Error ? e.message : "登录失败"); }
      finally { setLoading(false); }
      return;
    }
    if (tab === "email") {
      const value = normalizedEmail();
      if (!validEmail(value)) { setError("请输入正确的邮箱地址"); return; }
      if (!/^\d{6}$/.test(emailCode)) { setError("请输入6位验证码"); return; }
      setLoading(true);
      try { await emailLoginAndSync(value, emailCode); onAuthenticated?.(); }
      catch (e) { setError(e instanceof Error ? e.message : "登录失败"); }
      finally { setLoading(false); }
      return;
    }
    if (!PHONE_RE.test(phone)) { setError("请输入正确的11位手机号"); return; }
    if (!/^\d{6}$/.test(smsCode)) { setError("请输入6位验证码"); return; }
    setLoading(true);
    try { await smsLoginAndSync(phone, smsCode); onAuthenticated?.(); }
    catch (e) { setError(e instanceof Error ? e.message : "登录失败"); }
    finally { setLoading(false); }
  }

  const row = "w-full border-0 border-b border-[#dfe4ef] bg-transparent px-0 py-4 text-[16px] outline-none focus:border-[#335eea]";
  const tabClass = (selected: boolean) => `pb-2 text-lg ${selected ? "border-b-[3px] border-[#335eea] font-black text-[#17264d]" : "text-[#8b96ac]"}`;
  const sendLabel = sending ? "发送中..." : countdown > 0 ? `${countdown}秒后重发` : "获取验证码";

  return <div className="mx-auto w-full max-w-[380px] rounded-[28px] border border-[#edf0f7] bg-white px-7 py-8 shadow-[0_18px_55px_rgba(31,57,120,.08)]">
    {(emailEnabled || smsEnabled) && <div className="mb-7 flex justify-center gap-8" role="tablist">
      <button type="button" role="tab" aria-selected={tab === "password"} onClick={() => switchTab("password")} className={tabClass(tab === "password")}>密码登录</button>
      {emailEnabled && <button type="button" role="tab" aria-selected={tab === "email"} onClick={() => switchTab("email")} className={tabClass(tab === "email")}>邮箱登录</button>}
      {smsEnabled && <button type="button" role="tab" aria-selected={tab === "sms"} onClick={() => switchTab("sms")} className={tabClass(tab === "sms")}>短信登录</button>}
    </div>}
    <form onSubmit={submit} className="flex flex-col">
      {tab === "password" && <>
        <label className="sr-only" htmlFor="login-id">手机号或用户名</label><input id="login-id" aria-label="手机号或用户名" value={identifier} onChange={(e) => { setIdentifier(e.target.value); if (/^\d*$/.test(e.target.value)) onPhoneChange(e.target.value.slice(0, 11)); }} placeholder="手机号或用户名" autoComplete="username" className={row}/>
        <div className="relative"><label className="sr-only" htmlFor="login-password">密码</label><input id="login-password" aria-label="密码" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码" autoComplete="current-password" className={`${row} pr-10`}/><button type="button" aria-label={showPassword ? "隐藏密码" : "显示密码"} onClick={() => setShowPassword(!showPassword)} className="absolute right-0 top-1/2 -translate-y-1/2 text-[#9aa4b8]">{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div>
      </>}
      {tab === "email" && <>
        <label className="sr-only" htmlFor="email-address">邮箱</label><input id="email-address" aria-label="邮箱" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="邮箱地址" className={row}/>
        <div className="relative"><label className="sr-only" htmlFor="email-code">验证码</label><input id="email-code" aria-label="验证码" inputMode="numeric" autoComplete="one-time-code" value={emailCode} onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6位验证码" className={`${row} pr-28`}/><button type="button" disabled={sending || countdown > 0} onClick={sendEmailCode} className="absolute right-0 top-1/2 -translate-y-1/2 text-sm font-bold text-[#335eea] disabled:text-[#9aa4b8]">{sendLabel}</button></div>
        <p className="mt-4 text-center text-sm text-[#7b879f]">未注册邮箱验证后将自动创建账号</p>
      </>}
      {tab === "sms" && <>
        <label className="sr-only" htmlFor="sms-phone">手机号</label><input id="sms-phone" aria-label="手机号" inputMode="numeric" value={phone} onChange={(e) => onPhoneChange(e.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="手机号" className={row}/>
        <div className="relative"><label className="sr-only" htmlFor="sms-code">验证码</label><input id="sms-code" aria-label="验证码" inputMode="numeric" value={smsCode} onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6位验证码" className={`${row} pr-28`}/><button type="button" disabled={sending || countdown > 0} onClick={sendSmsCode} className="absolute right-0 top-1/2 -translate-y-1/2 text-sm font-bold text-[#335eea] disabled:text-[#9aa4b8]">{sendLabel}</button></div>
      </>}
      {error && <p role="alert" className="mt-3 text-sm text-[#d45862]">{error}</p>}
      <button type="submit" disabled={loading} className="mt-7 w-full rounded-2xl bg-[#335eea] py-3.5 font-black text-white shadow-[0_10px_24px_rgba(51,94,234,.22)] disabled:opacity-60">{loading ? "登录中..." : "登录"}</button>
      {tab === "password" && <button type="button" onClick={onRegister} className="mt-6 text-center text-sm font-semibold text-[#61739c]">首次使用？创建账号</button>}
    </form>
  </div>;
}
