// 场景对话数据：粤语原句与 audio-manifest 的离线音频 key 保持一致（逐句可发音）
export interface DialogueLine {
  speaker: "A" | "B";
  yue: string; // 粤语原句
  man: string; // 普通话意思
}

export interface Dialogue {
  id: string;
  emoji: string;
  title: string;
  place: string;
  roles: [string, string]; // A / B 角色名
  lines: DialogueLine[];
}

export const DIALOGUES: Dialogue[] = [
  {
    id: "canteen",
    emoji: "🍜",
    title: "茶餐厅点餐",
    place: "茶餐厅",
    roles: ["店员", "顾客"],
    lines: [
      { speaker: "A", yue: "你好！幾多位？", man: "你好！几位？" },
      { speaker: "B", yue: "兩位，唔該。", man: "两位，麻烦你。" },
      { speaker: "A", yue: "飲咩嘢？", man: "喝点什么？" },
      { speaker: "B", yue: "一杯凍檸茶，唔該。", man: "一杯冻柠茶，麻烦你。" },
      { speaker: "A", yue: "食唔食嘢？", man: "吃点东西吗？" },
      { speaker: "B", yue: "一個菠蘿包，多謝。", man: "一个菠萝包，谢谢。" },
      { speaker: "A", yue: "好，等陣。", man: "好，稍等一下。" },
    ],
  },
  {
    id: "direction",
    emoji: "🚇",
    title: "街头问路",
    place: "街上",
    roles: ["游客", "路人"],
    lines: [
      { speaker: "A", yue: "唔該，尖沙咀點去？", man: "请问，尖沙咀怎么去？" },
      { speaker: "B", yue: "搭地鐵，三個站就到。", man: "坐地铁，三个站就到。" },
      { speaker: "A", yue: "邊個出口？", man: "哪个出口？" },
      { speaker: "B", yue: "A出口，轉左直去。", man: "A出口，左转直走。" },
      { speaker: "A", yue: "遠唔遠？", man: "远不远？" },
      { speaker: "B", yue: "唔遠，行五分鐘就到。", man: "不远，走五分钟就到。" },
    ],
  },
  {
    id: "greeting",
    emoji: "☀️",
    title: "日常寒暄",
    place: "办公室",
    roles: ["同事甲", "同事乙"],
    lines: [
      { speaker: "A", yue: "早晨！", man: "早上好！" },
      { speaker: "B", yue: "早晨！琴晚瞓得好嗎？", man: "早上好！昨晚睡得好吗？" },
      { speaker: "A", yue: "唔錯。你今日好忙嗎？", man: "不错。你今天很忙吗？" },
      { speaker: "B", yue: "幾忙，日日都要開會。", man: "挺忙的，天天都要开会。" },
      { speaker: "A", yue: "咁唔好咁攰喇。", man: "那就别那么累啦。" },
    ],
  },
  {
    id: "shopping",
    emoji: "🛍️",
    title: "商场购物",
    place: "商店",
    roles: ["顾客", "店员"],
    lines: [
      { speaker: "A", yue: "唔該，呢個幾多錢？", man: "请问，这个多少钱？" },
      { speaker: "B", yue: "一百五十蚊。", man: "一百五十块。" },
      { speaker: "A", yue: "平啲得唔得？", man: "便宜一点行吗？" },
      { speaker: "B", yue: "唔好意思，呢個係最平嘅喇。", man: "不好意思，这已经是最便宜的了。" },
      { speaker: "A", yue: "咁要呢個，唔該包好佢。", man: "那要这个，麻烦帮我包好。" },
    ],
  },
  {
    id: "invite",
    emoji: "🎬",
    title: "周末邀约",
    place: "朋友之间",
    roles: ["朋友甲", "朋友乙"],
    lines: [
      { speaker: "A", yue: "你今晚得唔得閒？", man: "你今晚有空吗？" },
      { speaker: "B", yue: "咩事呀？", man: "什么事呀？" },
      { speaker: "A", yue: "去睇戲，嚟唔嚟呀？", man: "去看电影，来不来？" },
      { speaker: "B", yue: "好呀！幾點去？", man: "好呀！几点去？" },
      { speaker: "A", yue: "七點，戲院門口見。", man: "七点，戏院门口见。" },
    ],
  },
];
