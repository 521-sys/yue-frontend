import { useState } from "react";
import HomeScreen from "./screens/HomeScreen";
import StudyScreen from "./screens/StudyScreen";
import TogetherScreen from "./screens/TogetherScreen";
import ShopScreen from "./screens/ShopScreen";
import ProfileScreen from "./screens/ProfileScreen";
import {
  BookOpen,
  GraduationCap,
  Users,
  ShoppingBag,
  User,
} from "lucide-react";

const tabs = [
  { id: "home", label: "记粤语", icon: BookOpen },
  { id: "study", label: "背粤语", icon: GraduationCap },
  { id: "together", label: "一起学", icon: Users },
  { id: "shop", label: "商城", icon: ShoppingBag },
  { id: "profile", label: "我", icon: User },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("home");

  const renderScreen = () => {
    switch (activeTab) {
      case "home": return <HomeScreen onNavigate={setActiveTab} />;
      case "study": return <StudyScreen />;
      case "together": return <TogetherScreen />;
      case "shop": return <ShopScreen />;
      case "profile": return <ProfileScreen />;
      default: return <HomeScreen />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f0f4ff] max-w-[430px] mx-auto relative overflow-hidden">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {renderScreen()}
      </div>

      {/* Bottom tab bar */}
      <div className="flex-shrink-0 bg-white border-t border-gray-100 flex items-center shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-all"
            >
              <div
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
                  active ? "bg-[#2B5CE6]" : ""
                }`}
              >
                <Icon
                  size={active ? 18 : 22}
                  className={active ? "text-white" : "text-gray-400"}
                  strokeWidth={active ? 2.5 : 1.8}
                />
              </div>
              <span
                className={`text-[11px] font-medium transition-colors ${
                  active ? "text-[#2B5CE6]" : "text-gray-400"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
