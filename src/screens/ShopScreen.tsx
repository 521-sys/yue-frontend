import { useState } from "react";
import { Star, Coins, Check } from "lucide-react";
import { useLearning, buyItem } from "../lib/store";

const items = [
  { name: "九声六调速记卡", desc: "正宗香港腔，30天攻克声调", price: 99, coins: 500, emoji: "🀄", tag: "热销" },
  { name: "粤语会话强化课", desc: "100个日常对话场景", price: 199, coins: 1200, emoji: "🎙", tag: "NEW" },
  { name: "港剧粤语词汇包", desc: "500个港剧高频词汇", price: 49, coins: 300, emoji: "📺", tag: "" },
  { name: "粤语歌词精讲", desc: "跟着经典粤语歌学发音", price: 129, coins: 800, emoji: "🎵", tag: "限时" },
  { name: "声调训练强化包", desc: "AI 发音评分 + 纠正", price: 79, coins: 450, emoji: "🎯", tag: "" },
  { name: "粤语俚语大全", desc: "300个地道俚语和惯用语", price: 39, coins: 200, emoji: "💬", tag: "" },
];

export default function ShopScreen() {
  const s = useLearning();
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1900);
  }

  function handleBuy(item: (typeof items)[number]) {
    if (s.owned.includes(item.name)) {
      showToast("已经买过了，去学习吧");
      return;
    }
    if (s.coins < item.coins) {
      showToast(`铜板不足，还差 ${item.coins - s.coins} 个`);
      return;
    }
    if (buyItem(item.name, item.coins)) showToast(`购买成功：${item.name}`);
  }

  return (
    <div className="flex flex-col h-full bg-[#f0f4ff]">
      {/* Header */}
      <div
        className="px-4 pt-10 pb-6"
        style={{ background: "linear-gradient(160deg, #1a3fbf 0%, #2B5CE6 50%, #4a7cf7 100%)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/70 text-xs">商城</p>
            <p className="text-white font-bold text-lg">粤语学习资源</p>
          </div>
          <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5">
            <Coins size={15} className="text-[#F5A623]" />
            <span className="text-white font-bold text-sm">{s.coins}</span>
          </div>
        </div>

        {/* Banner */}
        <div className="bg-gradient-to-r from-[#F5A623] to-[#e8950f] rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-white font-black text-lg">打卡赚铜板</p>
            <p className="text-white/80 text-xs mt-0.5">每日学习可获得铜板奖励</p>
          </div>
          <div className="flex items-center gap-1">
            <Coins size={32} className="text-white" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => {
            const owned = s.owned.includes(item.name);
            const affordable = s.coins >= item.coins;
            return (
              <div key={item.name} className="bg-white rounded-2xl overflow-hidden shadow-sm shadow-blue-50">
                <div className="bg-gradient-to-br from-[#EEF3FF] to-[#dce8ff] h-28 flex items-center justify-center relative">
                  <span className="text-5xl">{item.emoji}</span>
                  {item.tag && (
                    <span className={`absolute top-2 right-2 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      item.tag === "NEW" ? "bg-red-500" : item.tag === "热销" ? "bg-[#F5A623]" : item.tag === "限时" ? "bg-purple-500" : "bg-[#2B5CE6]"
                    }`}>
                      {item.tag}
                    </span>
                  )}
                  {owned && (
                    <span className="absolute top-2 left-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                      <Check size={9} strokeWidth={3} /> 已拥有
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-bold text-sm text-[#1a1a2e] leading-snug">{item.name}</p>
                  <p className="text-gray-400 text-[11px] mt-0.5 line-clamp-1">{item.desc}</p>
                  <div className="flex items-center justify-between mt-2.5">
                    <div>
                      <span className="text-[#2B5CE6] font-black text-base">¥{item.price}</span>
                      <div className="flex items-center gap-0.5 mt-0.5">
                        <Coins size={10} className="text-[#F5A623]" />
                        <span className="text-[10px] text-gray-400">{item.coins}铜板</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleBuy(item)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-transform ${
                        owned
                          ? "bg-green-100 text-green-600"
                          : affordable
                          ? "bg-[#2B5CE6] text-white"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {owned ? "已拥有" : affordable ? "购买" : "铜板不足"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-center text-[10px] text-gray-400 mt-4 flex items-center justify-center gap-1">
          <Star size={10} /> 铜板可通过每日学习打卡获取
        </p>
      </div>

      {/* 提示 */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a2e]/92 text-white text-sm px-4 py-2.5 rounded-full animate-fade-in shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
