import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Heart, LoaderCircle } from "lucide-react";
import type { Dialogue } from "../../data/dialogues";
import { listFavoriteScenes, unfavoriteScene } from "../../lib/scene-api";

type FavoritesViewProps = {
  onBack: () => void;
  onOpenScene: (id: number) => void;
};

function officialId(scene: Dialogue): number {
  return Number(scene.id.replace(/^official:/, ""));
}

export default function FavoritesView({ onBack, onOpenScene }: FavoritesViewProps) {
  const [items, setItems] = useState<Dialogue[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    listFavoriteScenes()
      .then((next) => { if (active) setItems(next); })
      .catch((error) => { if (active) setLoadError(error instanceof Error ? error.message : "收藏加载失败"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retryKey]);

  async function remove(scene: Dialogue) {
    const id = officialId(scene);
    setActionError("");
    setRemovingId(id);
    try {
      await unfavoriteScene(id);
      setItems((current) => current.filter((item) => item.id !== scene.id));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "暂时无法取消收藏");
    } finally {
      setRemovingId(null);
    }
  }

  return <section className="min-h-full bg-[#f7f8fc] px-5 pb-10 pt-11 text-[#192b59]">
    <div className="mx-auto max-w-[460px]">
      <div className="mb-7 flex items-center gap-3">
        <button type="button" aria-label="返回个人中心" onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#52617f] shadow-sm"><ChevronLeft size={20} /></button>
        <div><p className="text-xs font-semibold text-[#7183b5]">场景对话</p><h1 className="text-[28px] font-black">我的收藏</h1></div>
      </div>

      {loading && <div role="status" className="flex items-center justify-center gap-2 rounded-[24px] bg-white py-16 text-sm text-[#7b879f]"><LoaderCircle className="animate-spin" size={18} />正在加载收藏...</div>}

      {!loading && loadError && <div className="rounded-[24px] bg-white px-6 py-12 text-center shadow-sm"><p role="alert" className="text-sm text-[#c6515c]">{loadError}</p><button type="button" onClick={() => setRetryKey((key) => key + 1)} className="mt-5 rounded-xl bg-[#335eea] px-5 py-2.5 text-sm font-bold text-white">重新加载</button></div>}

      {!loading && !loadError && items.length === 0 && <div className="rounded-[24px] bg-white px-7 py-14 text-center shadow-sm"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff0f2] text-[#e45d6a]"><Heart size={24} /></div><h2 className="mt-5 text-lg font-black">还没有收藏场景</h2><p className="mt-2 text-sm leading-6 text-[#8b96ac]">在场景对话中点亮爱心，之后会显示在这里</p></div>}

      {!loading && !loadError && items.length > 0 && <ul className="overflow-hidden rounded-[24px] bg-white px-4 shadow-[0_12px_34px_rgba(31,57,120,.06)]">
        {items.map((scene, index) => {
          const id = officialId(scene);
          const removing = removingId === id;
          return <li key={scene.id} className={`relative ${index ? "border-t border-[#edf0f6]" : ""}`}>
            <button type="button" aria-label={`打开场景 ${scene.title}`} onClick={() => onOpenScene(id)} className="flex w-full items-center gap-3 py-4 pr-20 text-left">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f1f4fb] text-xl">{scene.emoji}</span>
              <span className="min-w-0 flex-1"><strong className="block truncate text-[15px]">{scene.title}</strong><span className="mt-1 block truncate text-xs text-[#8b96ac]">{scene.place} · {scene.roles.join(" / ")}</span></span>
              <ChevronRight size={18} className="text-[#c1c8d6]" />
            </button>
            <button type="button" aria-label={`取消收藏 ${scene.title}`} disabled={removing} onClick={() => void remove(scene)} className="absolute right-10 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-[#e45d6a] disabled:opacity-45"><Heart size={19} fill="currentColor" /></button>
          </li>;
        })}
      </ul>}
      {actionError && <p role="alert" className="mt-4 rounded-2xl bg-[#fff1f2] px-4 py-3 text-center text-sm text-[#c6515c]">{actionError}</p>}
    </div>
  </section>;
}
