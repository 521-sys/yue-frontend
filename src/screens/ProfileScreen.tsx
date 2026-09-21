import { useEffect, useState } from "react";
import { LogIn, LogOut, Pencil, RotateCcw, Settings, UserRound } from "lucide-react";
import { AuthSheet } from "../components/AuthSheet";
import { Sheet } from "../components/Sheet";
import { currentUser, isLoggedin, logout, resetAll, setDailyGoal, useLearning } from "../lib/store";
import { AUTH_CHANGED_EVENT, getProfile, updateProfile, type Profile } from "../lib/api";

export const PRESET_AVATARS = ["😊", "😎", "🤠", "🦊", "🐼", "🐯", "🦄", "🐨"];

export default function ProfileScreen() {
  const s = useLearning();
  const [authOpen, setAuthOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [authState, setAuthState] = useState(() => isLoggedin());
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const sync = () => setAuthState(isLoggedin());
    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, sync);
  }, []);
  useEffect(() => { if (authState) getProfile().then(setProfile).catch(() => setProfile(null)); else setProfile(null); }, [authState]);

  return <div className="min-h-full bg-[#f7f8fc] px-5 pt-12 pb-8 text-[#192b59]">
    <p className="text-[#617bd1] text-sm font-semibold">账号与偏好</p>
    <h1 className="text-[30px] font-black mt-1">我的</h1>
    <div className="mt-7 bg-white rounded-[24px] p-5 shadow-[0_12px_32px_rgba(31,57,120,.07)]">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-[#edf2ff] flex items-center justify-center text-3xl">{profile?.avatar || "😊"}</div>
        <div className="flex-1"><p className="font-bold text-lg">{profile?.nickname || (authState ? currentUser() : "粤语学习者")}</p><p className="text-xs text-[#8b96ac] mt-1">{authState ? "已登录 · 进度云端同步" : "登录后同步学习进度"}</p></div>
        {authState ? <><button title="编辑资料" onClick={() => setEditOpen(true)} className="w-9 h-9 rounded-xl bg-[#edf2ff] flex items-center justify-center"><Pencil size={16} className="text-[#335eea]" /></button><button title="退出登录" onClick={() => logout()} className="w-9 h-9 rounded-xl bg-[#fff0f1] flex items-center justify-center"><LogOut size={16} className="text-[#d45862]" /></button></> : <button onClick={() => setAuthOpen(true)} className="rounded-xl bg-[#335eea] text-white px-4 py-2 text-sm font-bold"><LogIn size={15} className="inline mr-1" />登录</button>}
      </div>
    </div>

    <div className="mt-4 bg-white rounded-[24px] p-5 shadow-[0_12px_32px_rgba(31,57,120,.07)]">
      <div className="flex items-center gap-2"><Settings size={18} className="text-[#335eea]" /><span className="font-bold">基础设置</span></div>
      <div className="mt-5"><div className="flex items-center justify-between"><span className="text-sm">每日学习目标</span><strong className="text-[#335eea]">{s.dailyGoal} 词</strong></div><input aria-label="每日学习目标" type="range" min={5} max={50} step={5} value={s.dailyGoal} onChange={(e) => setDailyGoal(Number(e.target.value))} className="w-full mt-3 accent-[#335eea]" /><div className="flex justify-between text-[10px] text-[#9aa4b8]"><span>5</span><span>25</span><span>50</span></div></div>
      <button onClick={() => { if (confirm("确定清空全部学习进度吗？")) resetAll(); }} className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl border border-[#f1d7d9] text-[#d45862] py-3 text-sm font-semibold"><RotateCcw size={15} />重置学习进度</button>
    </div>
    <div className="mt-4 rounded-2xl bg-white/70 border border-[#e7ebf4] p-4 text-center text-xs text-[#8b96ac]"><UserRound size={15} className="inline mr-1" />粤语开口练 · AI 语音 / 场景对话 / 电影模仿</div>
    {authOpen && <AuthSheet onClose={() => setAuthOpen(false)} />}
    {editOpen && profile && <EditProfileSheet profile={profile} onClose={() => setEditOpen(false)} onSaved={setProfile} />}
  </div>;
}

function EditProfileSheet({ profile, onClose, onSaved }: { profile: Profile; onClose: () => void; onSaved: (p: Profile) => void }) {
  const [nickname, setNickname] = useState(profile.nickname || "");
  const [avatar, setAvatar] = useState(profile.avatar || PRESET_AVATARS[0]);
  const [saving, setSaving] = useState(false);
  async function save() { setSaving(true); try { onSaved(await updateProfile({ nickname: nickname.trim(), avatar })); onClose(); } finally { setSaving(false); } }
  return <Sheet title="编辑资料" onClose={onClose}><div className="flex flex-col gap-4"><div className="grid grid-cols-4 gap-2">{PRESET_AVATARS.map((a) => <button key={a} onClick={() => setAvatar(a)} className={`aspect-square rounded-xl text-3xl ${avatar === a ? "bg-[#edf2ff] ring-2 ring-[#335eea]" : "bg-gray-50"}`}>{a}</button>)}</div><input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={16} placeholder="输入昵称" className="w-full px-4 py-3 rounded-xl bg-[#edf2ff] text-sm outline-none" /><button onClick={save} disabled={saving} className="w-full py-3 rounded-xl bg-[#335eea] text-white font-bold">{saving ? "保存中..." : "保存"}</button></div></Sheet>;
}
