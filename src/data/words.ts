export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface Word {
  id: string;
  yue: string; // 粤语词
  jyut: string; // 粤拼
  man: string; // 普通话释义
  cat: string; // 分类 id
  example: string; // 粤语例句
  exampleMan: string; // 例句翻译
}

export const CATS: Category[] = [
  { id: "greet", name: "问候礼貌", icon: "👋" },
  { id: "eat", name: "饮食茶记", icon: "🍜" },
  { id: "traffic", name: "交通出行", icon: "🚇" },
  { id: "shop", name: "购物讲价", icon: "🛒" },
  { id: "num", name: "数字金钱", icon: "🔢" },
  { id: "daily", name: "日常用语", icon: "💬" },
  { id: "time", name: "时间日期", icon: "⏰" },
  { id: "work", name: "职场用语", icon: "💼" },
  { id: "slang", name: "俗语称赞", icon: "😎" },
];

const raw: Omit<Word, "id">[] = [
  // 问候礼貌
  { yue: "你好", jyut: "nei5 hou2", man: "你好", cat: "greet", example: "你好，我係廣東人。", exampleMan: "你好，我是广东人。" },
  { yue: "早晨", jyut: "zou6 san4", man: "早上好", cat: "greet", example: "早晨，瞓得好嗎？", exampleMan: "早上好，睡得好吗？" },
  { yue: "晚安", jyut: "fong3 jau3", man: "晚安（睡前说）", cat: "greet", example: "早啲瞓，晚安。", exampleMan: "早点睡，晚安。" },
  { yue: "唔該", jyut: "m4 goi1", man: "谢谢 / 麻烦你（请人帮忙时用）", cat: "greet", example: "唔該你幫我。", exampleMan: "麻烦你帮我。" },
  { yue: "多謝", jyut: "doi6 zaa6", man: "谢谢（别人帮了你之后用）", cat: "greet", example: "多謝你嘅幫助。", exampleMan: "谢谢你的帮助。" },
  { yue: "唔好意思", jyut: "m4 hou2 ji3 si3", man: "不好意思、抱歉", cat: "greet", example: "唔好意思，我遲到。", exampleMan: "不好意思，我迟到了。" },
  { yue: "再見", jyut: "zoi3 gin3", man: "再见", cat: "greet", example: "拜拜，聽日再見。", exampleMan: "拜拜，明天见。" },
  { yue: "唔使", jyut: "m4 sai2", man: "不用、不客气", cat: "greet", example: "唔使客氣。", exampleMan: "不用客气。" },
  { yue: "食咗飯未", jyut: "sik6 zo2 faan6 mei6", man: "吃饭了吗（粤语常用打招呼语）", cat: "greet", example: "食咗飯未呀？", exampleMan: "你吃饭了吗？" },
  // 饮食茶记
  { yue: "食", jyut: "sik6", man: "吃（口语）", cat: "eat", example: "你食咗未？", exampleMan: "你吃了吗？" },
  { yue: "食嘢", jyut: "sik6 je5", man: "吃东西（嘢＝东西）", cat: "eat", example: "一齊去食嘢？", exampleMan: "一起去吃东西？" },
  { yue: "飲嘢", jyut: "jam2 je5", man: "喝东西", cat: "eat", example: "去飲杯嘢？", exampleMan: "去喝点东西？" },
  { yue: "好食", jyut: "ho2 sik6", man: "好吃", cat: "eat", example: "呢間嘢好好食。", exampleMan: "这家店很好吃。" },
  { yue: "茶餐廳", jyut: "caa2 caan1 teng1", man: "港式茶餐厅", cat: "eat", example: "去茶餐廳食早餐。", exampleMan: "去茶餐厅吃早餐。" },
  { yue: "凍奶茶", jyut: "bing1 naai5 caa4", man: "冰奶茶（凍＝冰的）", cat: "eat", example: "我要一杯凍奶茶。", exampleMan: "我要一杯冰奶茶。" },
  { yue: "檸檬茶", jyut: "ning4 mung4 caa4", man: "柠檬茶", cat: "eat", example: "凍檸檬茶，唔該。", exampleMan: "冰柠檬茶，谢谢。" },
  { yue: "菠蘿包", jyut: "bo1 lo1 baau1", man: "菠萝包（港式酥皮面包，里面没菠萝）", cat: "eat", example: "一個菠蘿包，多謝。", exampleMan: "一个菠萝包，谢谢。" },
  { yue: "埋單", jyut: "mai6 daan2", man: "结账（香港买单时说这句）", cat: "eat", example: "唔該埋單。", exampleMan: "麻烦结账。" },
  { yue: "宵夜", jyut: "siu2 je5", man: "夜宵", cat: "eat", example: "去食宵夜？", exampleMan: "去吃夜宵？" },
  // 交通出行
  { yue: "搭地鐵", jyut: "tit3 dei6", man: "坐地铁", cat: "traffic", example: "我搭地鐵返工。", exampleMan: "我坐地铁上班。" },
  { yue: "巴士", jyut: "baa1 si2", man: "公交车（音译自 bus）", cat: "traffic", example: "搭巴士定搭地鐵？", exampleMan: "坐公交还是地铁？" },
  { yue: "的士", jyut: "dik1 si2", man: "出租车（音译自 taxi）", cat: "traffic", example: "打的士去機場。", exampleMan: "打车去机场。" },
  { yue: "站", jyut: "zaam6", man: "车站、地铁站", cat: "traffic", example: "三個站就到。", exampleMan: "三个站就到。" },
  { yue: "落車", jyut: "lok6 ce1", man: "下车", cat: "traffic", example: "下個站落車。", exampleMan: "下个站下车。" },
  { yue: "轉左", jyut: "waan1 zo2", man: "向左转", cat: "traffic", example: "前面轉左。", exampleMan: "前面左转。" },
  { yue: "轉右", jyut: "waan1 jau6", man: "向右转", cat: "traffic", example: "路口轉右。", exampleMan: "路口右转。" },
  { yue: "直去", jyut: "zik6 heoi3", man: "一直往前走", cat: "traffic", example: "一直直去就到。", exampleMan: "一直直走就到。" },
  { yue: "出口", jyut: "ceot1 hau2", man: "出口（地铁口常用 A/B/C 出口）", cat: "traffic", example: "A出口出。", exampleMan: "A出口出。" },
  // 购物讲价
  { yue: "幾多錢", jyut: "gei2 do1 cin2", man: "多少钱", cat: "shop", example: "呢個幾多錢？", exampleMan: "这个多少钱？" },
  { yue: "太貴", jyut: "taai3 gwai3", man: "太贵了", cat: "shop", example: "太貴喇，平啲啦。", exampleMan: "太贵了，便宜点吧。" },
  { yue: "平", jyut: "peng4", man: "便宜（口语单字）", cat: "shop", example: "呢個好平。", exampleMan: "这个很便宜。" },
  { yue: "買", jyut: "maai5", man: "买（口语）", cat: "shop", example: "我想買呢個。", exampleMan: "我想买这个。" },
  { yue: "賣", jyut: "maai6", man: "卖（口语）", cat: "shop", example: "佢哋賣咩嘢？", exampleMan: "他们卖什么？" },
  { yue: "打折", jyut: "daam6 zin3", man: "打折", cat: "shop", example: "有冇打折？", exampleMan: "有折扣吗？" },
  { yue: "冇所謂", jyut: "mou5 so2 wai6", man: "无所谓、不要紧", cat: "shop", example: "冇所謂，你話事。", exampleMan: "无所谓，你决定。" },
  // 数字金钱
  { yue: "一", jyut: "jat1", man: "一", cat: "num", example: "一個，唔該。", exampleMan: "一个，谢谢。" },
  { yue: "二", jyut: "ji6", man: "二", cat: "num", example: "兩個人。", exampleMan: "两个人。" },
  { yue: "三", jyut: "saam1", man: "三", cat: "num", example: "三點見。", exampleMan: "三点见。" },
  { yue: "四", jyut: "sei3", man: "四（与「死」谐音，有人忌讳）", cat: "num", example: "四蚊，唔該。", exampleMan: "四块，谢谢。" },
  { yue: "五", jyut: "ng5", man: "五（注意声母 ng）", cat: "num", example: "五分鐘就到。", exampleMan: "五分钟就到。" },
  { yue: "九", jyut: "gau2", man: "九", cat: "num", example: "九點開門。", exampleMan: "九点开门。" },
  { yue: "十", jyut: "sap6", man: "十（韵尾 -p，急促收音）", cat: "num", example: "十蚊一份。", exampleMan: "十块一份。" },
  { yue: "萬", jyut: "maan6", man: "万", cat: "num", example: "一萬蚊，太貴喇。", exampleMan: "一万块，太贵了。" },
  // 日常用语
  { yue: "鍾意", jyut: "zung1 ji3", man: "喜欢", cat: "daily", example: "我好鍾意聽歌。", exampleMan: "我很喜欢听歌。" },
  { yue: "想要", jyut: "o2", man: "想要（要）", cat: "daily", example: "我想要杯凍飲。", exampleMan: "我想要杯冷饮。" },
  { yue: "唔要", jyut: "m4 o2", man: "不要", cat: "daily", example: "我唔要喇，多謝。", exampleMan: "我不要了，谢谢。" },
  { yue: "咩嘢", jyut: "me1 je5", man: "什么", cat: "daily", example: "你講咩嘢？", exampleMan: "你说什么？" },
  { yue: "點解", jyut: "dim2 gaai2", man: "为什么", cat: "daily", example: "點解你唔嚟？", exampleMan: "你为什么不来？" },
  { yue: "係", jyut: "hai6", man: "是", cat: "daily", example: "我係學生。", exampleMan: "我是学生。" },
  { yue: "唔係", jyut: "m4 hai6", man: "不是", cat: "daily", example: "我唔係廣東人。", exampleMan: "我不是广东人。" },
  { yue: "唔錯", jyut: "m4 co3", man: "不错、还行", cat: "daily", example: "呢個幾唔錯。", exampleMan: "这个挺不错。" },
  { yue: "攰", jyut: "gui6", man: "累（口语）", cat: "daily", example: "我好攰，想瞓。", exampleMan: "我很累，想睡。" },
  // 时间日期
  { yue: "今日", jyut: "gam1 jat6", man: "今天", cat: "time", example: "今日天氣好好。", exampleMan: "今天天气很好。" },
  { yue: "琴日", jyut: "kam4 jat6", man: "昨天（也写作「寻日」）", cat: "time", example: "琴日我放假。", exampleMan: "昨天我放假。" },
  { yue: "聽日", jyut: "ting1 jat6", man: "明天", cat: "time", example: "聽日見！", exampleMan: "明天见！" },
  { yue: "而家", jyut: "ji4 gaa1", man: "现在", cat: "time", example: "而家幾點？", exampleMan: "现在几点？" },
  { yue: "未", jyut: "mei6", man: "还没有", cat: "time", example: "我未食飯。", exampleMan: "我还没吃饭。" },
  { yue: "等陣", jyut: "dang2 zan6", man: "等一下、一会儿", cat: "time", example: "等陣，好快。", exampleMan: "等一下，很快。" },
  // 职场用语
  { yue: "做嘢", jyut: "zou6 je5", man: "干活、做事", cat: "work", example: "我今日好多嘢做。", exampleMan: "我今天很多事做。" },
  { yue: "返工", jyut: "faan1 gung1", man: "上班", cat: "work", example: "我朝早返工。", exampleMan: "我早上上班。" },
  { yue: "放工", jyut: "fong3 gung1", man: "下班", cat: "work", example: "放工去飲嘢？", exampleMan: "下班去喝点东西？" },
  { yue: "開會", jyut: "hoi1 wui2", man: "开会", cat: "work", example: "兩點開會。", exampleMan: "两点开会。" },
  { yue: "老細", jyut: "lou5 sai3", man: "老板（口语）", cat: "work", example: "老細出咗去。", exampleMan: "老板出去了。" },
  { yue: "同事", jyut: "tung4 si6", man: "同事", cat: "work", example: "我同事好好人。", exampleMan: "我同事人很好。" },
  { yue: "好忙", jyut: "hou2 mong4", man: "很忙", cat: "work", example: "我今日好忙。", exampleMan: "我今天很忙。" },
  // 俗语称赞
  { yue: "後生仔", jyut: "hau6 sang1 zai2", man: "年轻人", cat: "slang", example: "佢係後生仔。", exampleMan: "他是年轻人。" },
  { yue: "靚仔", jyut: "leng3 zai2", man: "帅哥", cat: "slang", example: "佢好靚仔。", exampleMan: "他很帅。" },
  { yue: "靚女", jyut: "leng3 neoi5", man: "美女", cat: "slang", example: "你好靚女。", exampleMan: "你很漂亮。" },
  { yue: "犀利", jyut: "sai1 lei6", man: "厉害、了不起", cat: "slang", example: "你好犀利！", exampleMan: "你好厉害！" },
  { yue: "hea", jyut: "hea3", man: "无所事事、躺平（港式英语借词）", cat: "slang", example: "今日喺屋企hea。", exampleMan: "今天在家躺平。" },
  { yue: "好嘢", jyut: "hou2 je5", man: "好东西；喝彩「太棒了」", cat: "slang", example: "好嘢！贏咗！", exampleMan: "太棒了！赢了！" },
];

export const WORDS: Word[] = raw.map((w, i) => ({ ...w, id: `w${i + 1}` }));

export function catOf(id: string): Category {
  return CATS.find((c) => c.id === id) ?? CATS[0];
}

export function shortMan(man: string): string {
  return String(man).split("（")[0].split("(")[0];
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}
