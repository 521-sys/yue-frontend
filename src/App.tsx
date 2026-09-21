import { useState } from "react";
import { Mic, MessagesSquare, Clapperboard, UserRound } from "lucide-react";
import HomeScreen from "./screens/HomeScreen";
import SceneDialogueScreen from "./screens/SceneDialogueScreen";
import MovieImitationScreen from "./screens/MovieImitationScreen";
import ProfileScreen from "./screens/ProfileScreen";

const tabs = [
  { id: "voice", label: "AI语音", icon: Mic },
  { id: "scene", label: "场景对话", icon: MessagesSquare },
  { id: "movie", label: "电影模仿", icon: Clapperboard },
  { id: "profile", label: "我的", icon: UserRound },
] as const;

export default function App() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("voice");
  return (
    <div className="flex flex-col h-full bg-[#f7f8fc] max-w-[430px] mx-auto relative overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === "voice" && <HomeScreen />}
        {activeTab === "scene" && <SceneDialogueScreen />}
        {activeTab === "movie" && <MovieImitationScreen />}
        {activeTab === "profile" && <ProfileScreen />}
      </div>
      <nav aria-label="主要功能" className="flex-shrink-0 bg-white border-t border-[#edf0f7] flex items-center pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_rgba(37,55,100,0.04)]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return <button key={tab.id} onClick={() => setActiveTab(tab.id)} aria-current={active ? "page" : undefined} className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${active ? "text-[#335eea]" : "text-[#98a3b9]"}`}>
            <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
            <span className="text-[11px] font-semibold">{tab.label}</span>
          </button>;
        })}
      </nav>
    </div>
  );
}
