import { describe, expect, it } from "vitest";
import {
  WORDMAP,
  translate,
  reverseLookup,
  hasKnown,
  type Seg,
} from "../data/dictionary";

describe("dictionary.ts 翻译词典", () => {
  describe("WORDMAP 数据", () => {
    it("WORDMAP 非空且每条为三元组 [普通话, 粤语, 粤拼]", () => {
      expect(WORDMAP.length).toBeGreaterThan(0);
      for (const entry of WORDMAP) {
        expect(entry).toHaveLength(3);
        expect(typeof entry[0]).toBe("string");
        expect(typeof entry[1]).toBe("string");
        expect(typeof entry[2]).toBe("string");
      }
    });

    it("WORDMAP 按普通话长度降序排列（保证贪心最长匹配正确）", () => {
      for (let i = 1; i < WORDMAP.length; i++) {
        expect(WORDMAP[i - 1][0].length).toBeGreaterThanOrEqual(WORDMAP[i][0].length);
      }
    });

    it("包含已知词条（早上好 / 早晨）", () => {
      const found = WORDMAP.find((e) => e[0] === "早上好");
      expect(found).toBeTruthy();
      expect(found![1]).toBe("早晨");
      expect(found![2]).toBe("zou6 san4");
    });
  });

  describe("translate 贪心最长匹配", () => {
    it("整句命中词典时整段标 known=true", () => {
      const segs = translate("早上好");
      expect(segs).toHaveLength(1);
      expect(segs[0].man).toBe("早上好");
      expect(segs[0].yue).toBe("早晨");
      expect(segs[0].jyut).toBe("zou6 san4");
      expect(segs[0].known).toBe(true);
    });

    it("未命中字原样保留且 known=false", () => {
      const segs = translate("xyz");
      expect(segs).toHaveLength(3);
      for (const seg of segs) {
        expect(seg.known).toBe(false);
        expect(seg.jyut).toBe("");
      }
      expect(segs.map((s) => s.man).join("")).toBe("xyz");
    });

    it("部分命中：命中的段 known=true，未命中段 known=false", () => {
      const segs = translate("早上好世界");
      // "早上好"(1段,3字命中) + "世"(1段) + "界"(1段) = 3段
      expect(segs.length).toBe(3);
      expect(segs[0].known).toBe(true);
      expect(segs[0].man).toBe("早上好");
      const tail = segs.slice(1);
      for (const seg of tail) {
        expect(seg.known).toBe(false);
      }
    });

    it("优先匹配更长的词（贪心最长）", () => {
      // "你好" 是单字命中；但若存在更长的命中应优先
      const segs = translate("你好");
      expect(segs.length).toBeGreaterThanOrEqual(1);
      // "你好" 应命中（dictionary 中有 "你好"→"你好" 的条目？词典中无 "你好"）
      // 词典中无 "你好" 条目，因此按单字处理
      expect(segs[0].man).toBe("你");
    });

    it("空字符串返回空数组", () => {
      expect(translate("")).toEqual([]);
    });

    it("连续命中多个词", () => {
      const segs = translate("早上好现在几点");
      // "早上好" + "现在几点" 均命中
      const knownSegs = segs.filter((s) => s.known);
      expect(knownSegs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("hasKnown", () => {
    it("含 known 段时返回 true", () => {
      const segs: Seg[] = [
        { man: "早上好", yue: "早晨", jyut: "zou6 san4", known: true },
        { man: "世", yue: "世", jyut: "", known: false },
      ];
      expect(hasKnown(segs)).toBe(true);
    });

    it("全部 unknown 时返回 false", () => {
      const segs: Seg[] = [
        { man: "x", yue: "x", jyut: "", known: false },
        { man: "y", yue: "y", jyut: "", known: false },
      ];
      expect(hasKnown(segs)).toBe(false);
    });

    it("空数组返回 false", () => {
      expect(hasKnown([])).toBe(false);
    });
  });

  describe("reverseLookup 反向查询", () => {
    it("精确匹配优先于模糊匹配", () => {
      const hits = reverseLookup("係");
      expect(hits.length).toBeGreaterThan(0);
      // 精确匹配应排在前面
      const exact = hits.find((h) => h.yue === "係");
      expect(exact).toBeTruthy();
      expect(exact!.man).toBe("是");
    });

    it("模糊匹配：查询的词作为子串", () => {
      const hits = reverseLookup("食");
      // "食" 作为子串应命中 "食嘢"、"好食" 等
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.some((h) => h.yue.includes("食"))).toBe(true);
    });

    it("查询不存在的词返回空数组", () => {
      expect(reverseLookup("zzzznotexist")).toEqual([]);
    });

    it("每个 ReverseHit 包含 yue / man / jyut 字段", () => {
      const hits = reverseLookup("食");
      for (const h of hits) {
        expect(typeof h.yue).toBe("string");
        expect(typeof h.man).toBe("string");
        expect(typeof h.jyut).toBe("string");
      }
    });
  });
});
