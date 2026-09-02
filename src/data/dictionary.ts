/* ==================== 普通话 ↔ 粤语转换词典 ====================
 * 数据来源：与小程序 / H5 版同一套 WORDMAP。
 * 每条为 [普通话, 粤语, 粤拼]，按普通话长度降序做贪心最长匹配。
 * ================================================================ */

export type WordMapEntry = [string, string, string];

const rawMap: WordMapEntry[] = [
  ["早上好", "早晨", "zou6 san4"],
  ["不用客气", "唔使客气", "m4 sai2 haak3 hei3"],
  ["没关系", "冇所謂", "mou5 so2 wai6"],
  ["谢谢你", "多謝你", "doi6 zaa6 nei5"],
  ["现在几点", "而家幾點", "ji4 gaa1 gei2 dim2"],
  ["多少钱", "幾多錢", "gei2 do1 cin2"],
  ["几点了", "幾點鐘", "gei2 dim2 zung1"],
  ["出租车", "的士", "dik1 si2"],
  ["公交车", "巴士", "baa1 si2"],
  ["坐地铁", "搭地鐵", "daap3 dei6 tit3"],
  ["不知道", "唔知道", "m4 zi1 dou3"],
  ["为什么", "點解", "dim2 gaai2"],
  ["说什么", "講咩嘢", "gong2 me1 je5"],
  ["怎么样", "點樣", "dim2 joeng2"],
  ["怎么办", "點算", "dim2 syun3"],
  ["对不对", "啱唔啱", "aam1 m4 aam1"],
  ["是不是", "係咪", "hai6 mai6"],
  ["我走了", "我走喇", "ngo5 zau2 laa1"],
  ["等一下", "等陣", "dang2 zan6"],
  ["一会儿", "一陣間", "jat1 zan6 gaan1"],
  ["吃东西", "食嘢", "sik6 je5"],
  ["喝东西", "飲嘢", "jam2 je5"],
  ["好不好", "好唔好", "hou2 m4 hou2"],
  ["上班", "返工", "faan1 gung1"],
  ["下班", "放工", "fong3 gung1"],
  ["开会", "開會", "hoi1 wui2"],
  ["老板", "老細", "lou5 sai3"],
  ["同事", "同事", "tung4 si6"],
  ["结账", "埋單", "mai6 daan2"],
  ["便宜", "平", "peng4"],
  ["太贵", "太貴", "taai3 gwai3"],
  ["买东西", "買嘢", "maai5 je5"],
  ["打折", "打折", "daam6 zin3"],
  ["好看", "好睇", "hou2 tai2"],
  ["回家", "返屋企", "faan1 uk1 kei2"],
  ["睡觉", "瞓覺", "fan3 gaau3"],
  ["喜欢", "鍾意", "zung1 ji3"],
  ["厉害", "犀利", "sai1 lei6"],
  ["帅哥", "靚仔", "leng3 zai2"],
  ["美女", "靚女", "leng3 neoi5"],
  ["年轻人", "後生仔", "hau6 sang1 zai2"],
  ["现在", "而家", "ji4 gaa1"],
  ["今天", "今日", "gam1 jat6"],
  ["昨天", "琴日", "kam4 jat6"],
  ["明天", "聽日", "ting1 jat6"],
  ["什么", "咩嘢", "me1 je5"],
  ["哪里", "邊度", "bin1 dou6"],
  ["这个", "呢個", "ni1 go3"],
  ["那个", "嗰個", "go2 go3"],
  ["没有", "冇", "mou5"],
  ["不是", "唔係", "m4 hai6"],
  ["谢谢", "唔該", "m4 goi1"],
  ["再见", "再見", "zoi3 gin3"],
  ["晚安", "晚安", "fong3 jau3"],
  ["说话", "講嘢", "gong2 je5"],
  ["吃饭", "食飯", "sik6 faan6"],
  ["好吃", "好食", "ho2 sik6"],
  ["很累", "好攰", "hou2 gui6"],
  ["知道", "知", "zi1"],
  ["下车", "落車", "lok6 ce1"],
  ["左转", "轉左", "waan1 zo2"],
  ["右转", "轉右", "waan1 jau6"],
  ["直走", "直去", "zik6 heoi3"],
  ["出口", "出口", "ceot1 hau2"],
  ["几岁", "幾大", "gei2 daai6"],
  ["看", "睇", "tai2"],
  ["想", "諗", "nam2"],
  ["说", "講", "gong2"],
  ["吃", "食", "sik6"],
  ["喝", "飲", "jam2"],
  ["的", "嘅", "ge3"],
  ["了", "咗", "zo2"],
  ["吗", "咩", "me1"],
  ["不", "唔", "m4"],
  ["是", "係", "hai6"],
  ["他", "佢", "keoi5"],
  ["她", "佢", "keoi5"],
  ["和", "同", "tung4"],
  ["很", "好", "hou2"],
  ["谁", "邊個", "bin1 go3"],
  ["累", "攰", "gui6"],
  ["钱", "蚊", "man1"],
];

export const WORDMAP: WordMapEntry[] = rawMap.sort((a, b) => b[0].length - a[0].length);

export interface Seg {
  man: string;
  yue: string;
  jyut: string;
  known: boolean; // 是否命中词典
}

/** 普通话文本 → 粤语分段（贪心最长匹配，未命中的字原样保留） */
export function translate(text: string): Seg[] {
  const segs: Seg[] = [];
  let i = 0;
  while (i < text.length) {
    let hit: WordMapEntry | null = null;
    for (let k = 0; k < WORDMAP.length; k++) {
      if (text.startsWith(WORDMAP[k][0], i)) {
        hit = WORDMAP[k];
        break;
      }
    }
    if (hit) {
      segs.push({ man: hit[0], yue: hit[1], jyut: hit[2], known: true });
      i += hit[0].length;
    } else {
      segs.push({ man: text[i], yue: text[i], jyut: "", known: false });
      i++;
    }
  }
  return segs;
}

export interface ReverseHit {
  yue: string;
  man: string;
  jyut: string;
}

/** 粤语字/词 → 普通话释义（反向查询），精确匹配优先 */
export function reverseLookup(yueText: string): ReverseHit[] {
  const exact: ReverseHit[] = [];
  const fuzzy: ReverseHit[] = [];
  for (const [man, yue, jyut] of WORDMAP) {
    if (yue === yueText) {
      exact.push({ yue, man, jyut });
    } else if (yue.includes(yueText) && yueText.length >= 1) {
      fuzzy.push({ yue, man, jyut });
    }
  }
  return [...exact, ...fuzzy];
}

/** 转换结果里是否至少命中一个词典词 */
export function hasKnown(segs: Seg[]): boolean {
  return segs.some((s) => s.known);
}
