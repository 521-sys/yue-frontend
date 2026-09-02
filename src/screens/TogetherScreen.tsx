import { useState } from "react";
import { Users, Zap, Trophy, MessageCircle, Heart, ChevronRight } from "lucide-react";
import { useLearning } from "../lib/store";

const leaderboard = [
  { rank: 1, name: "阿明", avatar: "🐉", words: 312, streak: 30, badge: "🥇" },
  { rank: 2, name: "小嫻", avatar: "🌸", words: 287, streak: 25, badge: "🥈" },
  { rank: 3, name: "大偉", avatar: "🦁", words: 261, streak: 22, badge: "🥉" },
  { rank: 4, name: "靜儀", avatar: "🦋", words: 234, streak: 18, badge: "" },
  { rank: 5, name: "志豪", avatar: "🐼", words: 198, streak: 15, badge: "" },
  { rank: 6, name: "我", avatar: "😊", words: 65, streak: 7, badge: "", isMe: true },
];

const posts = [
  {
    user: "阿明",
    avatar: "🐉",
    time: "2分钟前",
    content: "今日学识咗「靚仔」同「靚女」，原来粤语咁多形容词！",
    likes: 24,
    comments: 5,
    word: "靚仔 (leng3 zai2)",
    commentList: [
      { user: "小嫻", avatar: "🌸", text: "我都学识咗！仲有「索」都係赞人靓 😆" },
      { user: "志豪", avatar: "🐼", text: "多谢师兄，笔记收下了 🙏" },
    ],
  },
  {
    user: "小嫻",
    avatar: "🌸",
    time: "15分钟前",
    content: "终于搞清楚「係」同「喺」嘅分别啦！係 = 是，喺 = 在。",
    likes: 41,
    comments: 12,
    word: "喺 (hai2)",
    commentList: [
      { user: "阿明", avatar: "🐉", text: "呢个好多人都搞错，讲得好清楚 👍" },
      { user: "静仪", avatar: "🦋", text: "我一直以为係同一个字…" },
    ],
  },
];

export default function TogetherScreen() {
  const [tab, setTab] = useState<"rank" | "feed">("rank");
  const [liked, setLiked] = useState<Set<number>>(new Set());
  const [openCmt, setOpenCmt] = useState<Set<number>>(new Set());
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [myCmts, setMyCmts] = useState<Record<number, string[]>>({});
  const s = useLearning();

  function toggleComments(i: number) {
    setOpenCmt((prev) => {
      const n = new Set(prev);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  }

  function sendComment(i: number) {
    const text = (drafts[i] || "").trim();
    if (!text) return;
    setMyCmts((prev) => ({ ...prev, [i]: [...(prev[i] || []), text] }));
    setDrafts((prev) => ({ ...prev, [i]: "" }));
  }
  const board = leaderboard.map((u) =>
    u.isMe ? { ...u, words: s.learned.length, streak: s.streak } : u
  );

  return (
    <div className="flex flex-col h-full bg-[#f0f4ff]">
      {/* Header */}
      <div
        className="px-4 pt-10 pb-6"
        style={{ background: "linear-gradient(160deg, #1a3fbf 0%, #2B5CE6 50%, #4a7cf7 100%)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/70 text-xs">一起学</p>
            <p className="text-white font-bold text-lg">粤语学习社区</p>
          </div>
          <Users size={24} className="text-white/80" />
        </div>
        {/* My stats */}
        <div className="bg-white/15 rounded-2xl p-3 grid grid-cols-3 gap-2">
          {[
            { label: "今日词汇", value: String(s.todayLearned), icon: "📖" },
            { label: "连续天数", value: String(s.streak), icon: "🔥" },
            { label: "已记词", value: String(s.learned.length), icon: "🏆" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-lg">{stat.icon}</p>
              <p className="text-white font-black text-base">{stat.value}</p>
              <p className="text-white/60 text-[10px]">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 flex px-4">
        {(["rank", "feed"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${
              tab === t ? "text-[#2B5CE6] border-[#2B5CE6]" : "text-gray-400 border-transparent"
            }`}
          >
            {t === "rank" ? "排行榜" : "学习动态"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {tab === "rank" ? (
          <>
            {/* Top 3 podium */}
            <div className="bg-white rounded-2xl p-4 shadow-sm shadow-blue-50">
              <div className="flex items-end justify-center gap-4 mb-2">
                {[board[1], board[0], board[2]].map((user, i) => {
                  const heights = ["h-16", "h-24", "h-12"];
                  const sizes = ["w-12 h-12", "w-16 h-16", "w-10 h-10"];
                  return (
                    <div key={user.name} className="flex flex-col items-center gap-1">
                      <span className="text-2xl">{user.badge}</span>
                      <div className={`${sizes[i]} rounded-full bg-gradient-to-br from-[#EEF3FF] to-[#dce8ff] flex items-center justify-center text-xl border-2 border-[#2B5CE6]/20`}>
                        {user.avatar}
                      </div>
                      <span className="text-xs font-bold text-[#1a1a2e]">{user.name}</span>
                      <span className="text-[10px] text-gray-400">{user.words}词</span>
                      <div
                        className={`w-16 ${heights[i]} rounded-t-xl flex items-center justify-center`}
                        style={{
                          background: i === 1
                            ? "linear-gradient(180deg, #F5A623, #e8950f)"
                            : i === 0
                            ? "linear-gradient(180deg, #94a3b8, #64748b)"
                            : "linear-gradient(180deg, #cd7c3e, #a05a2c)",
                        }}
                      >
                        <span className="text-white font-black text-lg">{[2, 1, 3][i]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Full list */}
            <div className="bg-white rounded-2xl shadow-sm shadow-blue-50 overflow-hidden">
              {board.map((user, i) => (
                <div
                  key={user.name}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 ${
                    user.isMe ? "bg-[#EEF3FF]" : ""
                  }`}
                >
                  <span className={`w-6 text-center text-sm font-black ${
                    user.rank <= 3 ? "text-[#F5A623]" : "text-gray-400"
                  }`}>
                    {user.badge || user.rank}
                  </span>
                  <div className="w-10 h-10 rounded-full bg-[#EEF3FF] flex items-center justify-center text-xl flex-shrink-0">
                    {user.avatar}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${user.isMe ? "text-[#2B5CE6]" : "text-[#1a1a2e]"}`}>
                        {user.name}
                        {user.isMe && <span className="text-[10px] ml-1 bg-[#2B5CE6] text-white px-1.5 py-0.5 rounded-full">我</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Zap size={11} className="text-[#F5A623]" fill="#F5A623" />
                      <span className="text-[11px] text-gray-400">连续{user.streak}天</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-[#2B5CE6] text-base">{user.words}</span>
                    <p className="text-[10px] text-gray-400">个词汇</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          posts.map((post, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 shadow-sm shadow-blue-50">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-full bg-[#EEF3FF] flex items-center justify-center text-lg">
                  {post.avatar}
                </div>
                <div>
                  <p className="font-bold text-sm text-[#1a1a2e]">{post.user}</p>
                  <p className="text-[10px] text-gray-400">{post.time}</p>
                </div>
              </div>
              <p className="text-sm text-[#1a1a2e] leading-relaxed mb-3">{post.content}</p>
              <div className="bg-[#EEF3FF] rounded-xl px-3 py-2 mb-3 inline-flex items-center gap-2">
                <span className="text-[#2B5CE6] font-mono text-sm font-bold">{post.word}</span>
              </div>
              <div className="flex items-center gap-4 pt-2 border-t border-gray-50">
                <button
                  onClick={() => setLiked(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                  className="flex items-center gap-1.5 text-sm transition-colors"
                >
                  <Heart
                    size={16}
                    className={liked.has(i) ? "text-red-500" : "text-gray-400"}
                    fill={liked.has(i) ? "#ef4444" : "none"}
                  />
                  <span className={liked.has(i) ? "text-red-500" : "text-gray-400"}>
                    {post.likes + (liked.has(i) ? 1 : 0)}
                  </span>
                </button>
                <button
                  onClick={() => toggleComments(i)}
                  className={`flex items-center gap-1.5 text-sm transition-colors ${
                    openCmt.has(i) ? "text-[#2B5CE6]" : "text-gray-400"
                  }`}
                >
                  <MessageCircle size={16} />
                  <span>{post.comments + (myCmts[i]?.length || 0)}</span>
                </button>
              </div>

              {openCmt.has(i) && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-2.5">
                  {[
                    ...post.commentList,
                    ...(myCmts[i] || []).map((t) => ({ user: "我", avatar: "😊", text: t })),
                  ].map((c, ci) => (
                    <div key={ci} className="flex items-start gap-2">
                      <span className="text-base flex-shrink-0 leading-none mt-0.5">{c.avatar}</span>
                      <div className="flex-1 bg-[#f8faff] rounded-xl px-3 py-1.5">
                        <span className="text-[11px] font-bold text-[#2B5CE6]">{c.user}</span>
                        <p className="text-xs text-[#1a1a2e] leading-relaxed">{c.text}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <input
                      value={drafts[i] || ""}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [i]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && sendComment(i)}
                      placeholder="写个评论…"
                      className="flex-1 bg-[#f8faff] rounded-full px-3 py-2 text-xs outline-none border border-[#e8edff] focus:border-[#2B5CE6] text-[#1a1a2e]"
                    />
                    <button
                      onClick={() => sendComment(i)}
                      className="bg-[#2B5CE6] text-white text-xs font-bold px-3.5 py-2 rounded-full active:scale-95 transition-transform flex-shrink-0"
                    >
                      发送
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
