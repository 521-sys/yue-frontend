import { describe, expect, it } from "vitest";
import { WORDS, CATS, catOf, shortMan, shuffle, type Word } from "../data/words";

describe("words.ts 词表数据", () => {
  describe("CATS 分类", () => {
    it("CATS 包含 9 个分类且每条字段完整", () => {
      expect(CATS.length).toBe(9);
      for (const c of CATS) {
        expect(typeof c.id).toBe("string");
        expect(c.id.length).toBeGreaterThan(0);
        expect(typeof c.name).toBe("string");
        expect(typeof c.icon).toBe("string");
      }
    });

    it("CATS 的 id 唯一", () => {
      const ids = CATS.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("WORDS 词表", () => {
    it("WORDS 非空", () => {
      expect(WORDS.length).toBeGreaterThan(0);
    });

    it("每条 Word 字段完整：id/yue/jyut/man/cat/example/exampleMan", () => {
      for (const w of WORDS) {
        expect(typeof w.id).toBe("string");
        expect(w.id).toMatch(/^w\d+$/);
        expect(typeof w.yue).toBe("string");
        expect(w.yue.length).toBeGreaterThan(0);
        expect(typeof w.jyut).toBe("string");
        expect(typeof w.man).toBe("string");
        expect(typeof w.cat).toBe("string");
        expect(typeof w.example).toBe("string");
        expect(typeof w.exampleMan).toBe("string");
      }
    });

    it("每条 Word 的 cat 都能在 CATS 中找到", () => {
      const catIds = new Set(CATS.map((c) => c.id));
      for (const w of WORDS) {
        expect(catIds.has(w.cat)).toBe(true);
      }
    });

    it("每条 Word 的 id 唯一", () => {
      const ids = WORDS.map((w) => w.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("catOf", () => {
    it("传入有效 cat id 返回对应分类", () => {
      const first = CATS[0];
      const result = catOf(first.id);
      expect(result.id).toBe(first.id);
      expect(result.name).toBe(first.name);
    });

    it("传入未知 id 返回默认分类（CATS[0]）", () => {
      const result = catOf("not-exist-id");
      expect(result.id).toBe(CATS[0].id);
    });

    it("传入空字符串返回默认分类", () => {
      expect(catOf("").id).toBe(CATS[0].id);
    });
  });

  describe("shortMan", () => {
    it("去除中文括号说明", () => {
      expect(shortMan("便宜（口语单字）")).toBe("便宜");
      expect(shortMan("谢谢（别人帮了你之后用）")).toBe("谢谢");
    });

    it("去除英文括号说明", () => {
      expect(shortMan("test(English note)")).toBe("test");
    });

    it("无括号时原样返回", () => {
      expect(shortMan("你好")).toBe("你好");
    });

    it("空字符串返回空串", () => {
      expect(shortMan("")).toBe("");
    });
  });

  describe("shuffle", () => {
    it("返回新数组（不修改原数组）", () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = shuffle(original);
      expect(shuffled).not.toBe(original);
      expect(original).toEqual([1, 2, 3, 4, 5]);
    });

    it("打乱后元素集合与原数组相同", () => {
      const original = [1, 2, 3, 4, 5, 6, 7];
      const shuffled = shuffle(original);
      expect(shuffled.sort()).toEqual(original);
    });

    it("空数组返回空数组", () => {
      expect(shuffle([])).toEqual([]);
    });

    it("单元素数组返回长度为1的新数组", () => {
      const shuffled = shuffle([42]);
      expect(shuffled).toEqual([42]);
      expect(shuffled).not.toBe([42]);
    });

    it("对字符串数组同样有效", () => {
      const words = WORDS.slice(0, 5);
      const shuffled = shuffle(words);
      expect(shuffled.length).toBe(words.length);
      expect(shuffled.sort((a, b) => a.id.localeCompare(b.id))).toEqual(
        words.sort((a, b) => a.id.localeCompare(b.id)),
      );
    });
  });
});
