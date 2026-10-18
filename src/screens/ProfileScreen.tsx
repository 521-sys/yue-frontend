import { useEffect, useState } from "react";
import { ChevronRight, Cloud, Heart, LogOut, Pencil } from "lucide-react";
import { AuthFlow } from "../components/auth/AuthFlow";
import FavoritesView from "../components/profile/FavoritesView";
import { Sheet } from "../components/Sheet";
import { currentUser, isLoggedin, logout } from "../lib/store";
import { AUTH_CHANGED_EVENT, getProfile, updateProfile, type Profile } from "../lib/api";
import { useSyncStatus, type SyncStatus } from "../lib/sync-status";

export const PRESET_AVATARS = ["😊", "😎", "🤠", "🦊", "🐼", "🐯", "🦄", "🐨"];

export default function ProfileScreen({ onOpenScene }: { onOpenScene?: (id: number) => void }) {
  const [editOpen, setEditOpen] = useState(false);
  const [authState, setAuthState] = useState(() => isLoggedin());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [view, setView] = useState<"account" | "favorites">("account");
  const syncStatus = useSyncStatus();

  useEffect(() => {
    const sync = () => setAuthState(isLoggedin());
    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, sync);
  }, []);
  useEffect(() => {
    let active = true;
    if (authState) {
      getProfile().then((next) => { if (active) setProfile(next); }).catch(() => { if (active) setProfile(null); });
    } else {
      setProfile(null);
      setView("account");
    }
    return () => { active = false; };
  }, [authState]);

  if (!authState) return <div className="min-h-full bg-[linear-gradient(180deg,#f4f7ff_0%,#f8f9fd_48%,#f7f8fc_100%)] px-5 pb-10 pt-14 text-[#192b59]">
    <div className="mx-auto mb-8 max-w-[380px] text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#335eea] text-2xl font-black text-white shadow-[0_12px_30px_rgba(51,94,234,.25)]">粤</div>
      <h1 className="text-[30px] font-black tracking-tight">欢迎回来</h1>
      <p className="mt-2 text-sm text-[#74809a]">登录后继续你的粤语练习</p>
    </div>
    <AuthFlow onAuthenticated={() => setAuthState(true)} />
    <div className="mx-auto mt-7 flex max-w-[380px] justify-center gap-5 text-xs text-[#8b96ac]">
      <span>进度自动同步</span><span aria-hidden="true">·</span><span>收藏跨设备保留</span>
    </div>
  </div>;

  if (view === "favorites") return <FavoritesView onBack={() => setView("account")} onOpenScene={(id) => onOpenScene?.(id)} />;

  const username = profile?.username || currentUser() || "粤语学习者";
  const sync = syncPresentation(syncStatus);

  return <div className="min-h-full bg-[#f7f8fc] px-5 pb-10 pt-12 text-[#192b59]">
    <div className="mx-auto max-w-[460px]">
    <p className="text-sm font-semibold text-[#617bd1]">账号中心</p>
    <h1 className="mt-1 text-[30px] font-black">我的</h1>
    <div className="mt-7 rounded-[26px] bg-white p-5 shadow-[0_12px_32px_rgba(31,57,120,.07)]">
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#edf2ff] text-3xl">{profile?.avatar || "😊"}</div>
        <div className="min-w-0 flex-1"><p className="truncate text-lg font-black">{profile?.nickname || username}</p><p className="mt-1 truncate text-xs text-[#8b96ac]">@{username}</p></div>
        <button type="button" aria-label="编辑资料" disabled={!profile} onClick={() => setEditOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#edf2ff] text-[#335eea] disabled:opacity-40"><Pencil size={17} /></button>
      </div>
    </div>

    <div className="mt-4 overflow-hidden rounded-[24px] bg-white px-4 shadow-[0_12px_32px_rgba(31,57,120,.06)]">
      <div className="flex items-center gap-3 py-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#edf2ff] text-[#335eea]"><Cloud size={19} /></span>
        <span className="flex-1"><strong className="block text-[15px]">云端同步</strong><span className="mt-0.5 block text-xs text-[#8b96ac]">学习进度自动保留</span></span>
        <span className={`text-sm font-bold ${sync.className}`}>{sync.label}</span>
      </div>
      <button type="button" aria-label="我的收藏" onClick={() => setView("favorites")} className="flex w-full items-center gap-3 border-t border-[#edf0f6] py-4 text-left">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff0f2] text-[#e45d6a]"><Heart size={19} fill="currentColor" /></span>
        <span className="flex-1"><strong className="block text-[15px]">我的收藏</strong><span className="mt-0.5 block text-xs text-[#8b96ac]">已收藏的场景对话</span></span>
        <ChevronRight size={19} className="text-[#c1c8d6]" />
      </button>
    </div>
    <button type="button" aria-label="退出登录" onClick={logout} className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#f1d7d9] bg-white py-3.5 text-sm font-bold text-[#d45862]"><LogOut size={17} />退出登录</button>
    {editOpen && profile && <EditProfileSheet profile={profile} onClose={() => setEditOpen(false)} onSaved={setProfile} />}
    </div>
  </div>;
}

function syncPresentation(status: SyncStatus) {
  if (status === "syncing") return { label: "正在同步", className: "text-[#d28a22]" };
  if (status === "synced") return { label: "已同步", className: "text-[#2b9b68]" };
  if (status === "error") return { label: "同步失败", className: "text-[#d45862]" };
  return { label: "尚未同步", className: "text-[#8b96ac]" };
}

function EditProfileSheet({ profile, onClose, onSaved }: { profile: Profile; onClose: () => void; onSaved: (p: Profile) => void }) {
  const [nickname, setNickname] = useState(profile.nickname || "");
  const [avatar, setAvatar] = useState(profile.avatar || PRESET_AVATARS[0]);
  const [saving, setSaving] = useState(false);
  async function save() { setSaving(true); try { onSaved(await updateProfile({ nickname: nickname.trim(), avatar })); onClose(); } finally { setSaving(false); } }
  return <Sheet title="编辑资料" onClose={onClose}><div className="flex flex-col gap-4"><div className="grid grid-cols-4 gap-2">{PRESET_AVATARS.map((a) => <button key={a} onClick={() => setAvatar(a)} className={`aspect-square rounded-xl text-3xl ${avatar === a ? "bg-[#edf2ff] ring-2 ring-[#335eea]" : "bg-gray-50"}`}>{a}</button>)}</div><input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={16} placeholder="输入昵称" className="w-full px-4 py-3 rounded-xl bg-[#edf2ff] text-sm outline-none" /><button onClick={save} disabled={saving} className="w-full py-3 rounded-xl bg-[#335eea] text-white font-bold">{saving ? "保存中..." : "保存"}</button></div></Sheet>;
}
