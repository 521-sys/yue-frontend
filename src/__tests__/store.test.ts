import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  buyItem,
  getState,
  markLearned,
  markReviewed,
  markStuck,
  removeStuck,
  resetAll,
  setDailyGoal,
  subscribe,
  type LearningState,
} from "../lib/store";

const STORAGE_KEY = "yueLearnReactV1";

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayUTC(): string {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
}

describe("store.ts 状态层", () => {
  beforeEach(() => {
    localStorage.clear();
    resetAll();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("markLearned / markStuck / markReviewed", () => {
    it("markLearned 将 id 加入 learned 并自增 todayLearned", () => {
      const before = getState();
      expect(before.learned).toEqual([]);
      expect(before.todayLearned).toBe(0);

      markLearned("w1");
      const s1 = getState();
      expect(s1.learned).toEqual(["w1"]);
      expect(s1.todayLearned).toBe(1);
      expect(s1.todayLearnedDate).toBe(todayUTC());

      markLearned("w2");
      const s2 = getState();
      expect(s2.learned).toEqual(["w1", "w2"]);
      expect(s2.todayLearned).toBe(2);
    });

    it("markLearned 重复 id 不重复写入 learned", () => {
      markLearned("w1");
      markLearned("w1");
      const s = getState();
      expect(s.learned).toEqual(["w1"]);
      // todayLearned 仍然计数（业务上算作一次「斩」动作）
      expect(s.todayLearned).toBe(2);
    });

    it("markStuck 将 id 加入 stuck", () => {
      markStuck("w9");
      expect(getState().stuck).toEqual(["w9"]);
      markStuck("w8");
      expect(getState().stuck).toEqual(["w9", "w8"]);
      // 重复 id 不重复加入
      markStuck("w9");
      expect(getState().stuck).toEqual(["w9", "w8"]);
    });

    it("markReviewed 将 id 加入 reviewed 并自增 todayReviewed", () => {
      markReviewed("r1");
      const s = getState();
      expect(s.reviewed).toEqual(["r1"]);
      expect(s.todayReviewed).toBe(1);
      expect(s.todayReviewedDate).toBe(todayUTC());

      markReviewed("r2");
      expect(getState().reviewed).toEqual(["r1", "r2"]);
      expect(getState().todayReviewed).toBe(2);
    });
  });

  describe("buyItem", () => {
    it("余额不足返回 false 且不修改 owned / coins", () => {
      const before = getState();
      expect(before.coins).toBe(128);
      expect(before.owned).toEqual([]);

      const ok = buyItem("宝箱", 200);
      expect(ok).toBe(false);

      const after = getState();
      expect(after.coins).toBe(128);
      expect(after.owned).toEqual([]);
    });

    it("重复购买已拥有商品返回 false", () => {
      expect(buyItem("皮肤A", 50)).toBe(true);
      expect(getState().owned).toEqual(["皮肤A"]);
      // 再次购买同名商品
      const ok = buyItem("皮肤A", 50);
      expect(ok).toBe(false);
      // owned 不变，coins 也不再扣
      expect(getState().owned).toEqual(["皮肤A"]);
      expect(getState().coins).toBe(78);
    });

    it("购买成功扣减 coins 并加入 owned", () => {
      const ok = buyItem("道具X", 30);
      expect(ok).toBe(true);
      const s = getState();
      expect(s.coins).toBe(98);
      expect(s.owned).toEqual(["道具X"]);

      // 再买一件不同商品
      expect(buyItem("道具Y", 20)).toBe(true);
      const s2 = getState();
      expect(s2.coins).toBe(78);
      expect(s2.owned).toEqual(["道具X", "道具Y"]);
    });
  });

  describe("removeStuck", () => {
    it("从生词本中移除指定 id", () => {
      markStuck("w5");
      markStuck("w6");
      markStuck("w7");
      expect(getState().stuck).toEqual(["w5", "w6", "w7"]);

      removeStuck("w6");
      expect(getState().stuck).toEqual(["w5", "w7"]);
    });

    it("移除不存在的 id 不报错也不修改状态", () => {
      markStuck("w5");
      const before = getState();
      removeStuck("not-exist");
      expect(getState().stuck).toEqual(before.stuck);
    });
  });

  describe("setDailyGoal", () => {
    it("更新 dailyGoal", () => {
      expect(getState().dailyGoal).toBe(10);
      setDailyGoal(20);
      expect(getState().dailyGoal).toBe(20);
      setDailyGoal(5);
      expect(getState().dailyGoal).toBe(5);
    });
  });

  describe("resetAll", () => {
    it("将状态重置为默认值", () => {
      markLearned("w1");
      markStuck("w2");
      markReviewed("w3");
      buyItem("物品", 50);
      setDailyGoal(99);
      // 状态被污染
      expect(getState().learned.length).toBeGreaterThan(0);
      expect(getState().stuck.length).toBeGreaterThan(0);

      resetAll();
      const s = getState();
      expect(s.learned).toEqual([]);
      expect(s.stuck).toEqual([]);
      expect(s.reviewed).toEqual([]);
      expect(s.coins).toBe(128);
      expect(s.owned).toEqual([]);
      expect(s.dailyGoal).toBe(10);
      expect(s.todayLearned).toBe(0);
      expect(s.todayReviewed).toBe(0);
      expect(s.streak).toBe(0);
      expect(s.lastDay).toBe("");
    });
  });

  describe("streak 连续天数逻辑", () => {
    it("首次学习 streak=1 并写入 lastDay", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-01T10:00:00Z"));

      resetAll();
      markLearned("w1");
      const s = getState();
      expect(s.streak).toBe(1);
      expect(s.lastDay).toBe("2026-09-01");
    });

    it("同日多次学习 streak 不变", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-01T10:00:00Z"));

      resetAll();
      markLearned("w1");
      markStuck("w2");
      markReviewed("w3");
      const s = getState();
      expect(s.streak).toBe(1);
      expect(s.lastDay).toBe("2026-09-01");
    });

    it("连续第二天学习 streak 自增", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-01T10:00:00Z"));
      resetAll();
      markLearned("w1");
      expect(getState().streak).toBe(1);

      // 推进到第二天同一时刻
      vi.setSystemTime(new Date("2026-09-02T10:00:00Z"));
      markLearned("w2");
      const s = getState();
      expect(s.streak).toBe(2);
      expect(s.lastDay).toBe("2026-09-02");
    });

    it("中断后再学习 streak 重置为 1", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-01T10:00:00Z"));
      resetAll();
      markLearned("w1");
      expect(getState().streak).toBe(1);

      // 跳到第三天（跳过第二天，不连续）
      vi.setSystemTime(new Date("2026-09-03T10:00:00Z"));
      markLearned("w2");
      const s = getState();
      expect(s.streak).toBe(1);
      expect(s.lastDay).toBe("2026-09-03");
    });
  });

  describe("todayLearned / todayReviewed 跨日重置", () => {
    it("todayLearned 跨日重置为 1", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-01T10:00:00Z"));
      resetAll();

      markLearned("w1");
      markLearned("w2");
      expect(getState().todayLearned).toBe(2);
      expect(getState().todayLearnedDate).toBe("2026-09-01");

      // 推进到第二天
      vi.setSystemTime(new Date("2026-09-02T10:00:00Z"));
      markLearned("w3");
      const s = getState();
      // 跨日时应重置为 1
      expect(s.todayLearned).toBe(1);
      expect(s.todayLearnedDate).toBe("2026-09-02");
    });

    it("todayReviewed 跨日重置为 1", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-01T10:00:00Z"));
      resetAll();

      markReviewed("r1");
      markReviewed("r2");
      markReviewed("r3");
      expect(getState().todayReviewed).toBe(3);

      vi.setSystemTime(new Date("2026-09-02T10:00:00Z"));
      markReviewed("r4");
      expect(getState().todayReviewed).toBe(1);
      expect(getState().todayReviewedDate).toBe("2026-09-02");
    });
  });

  describe("subscribe / getState", () => {
    it("subscribe 在状态变更时被调用，返回取消订阅函数", () => {
      let calls = 0;
      const unsub = subscribe(() => {
        calls++;
      });

      markLearned("w1");
      expect(calls).toBe(1);
      markStuck("w2");
      expect(calls).toBe(2);

      unsub();
      markLearned("w3");
      // 取消订阅后不再触发
      expect(calls).toBe(2);
    });

    it("getState 返回当前状态对象", () => {
      const s = getState();
      const expected: LearningState = {
        learned: [],
        stuck: [],
        reviewed: [],
        streak: 0,
        lastDay: "",
        todayLearned: 0,
        todayLearnedDate: "",
        todayReviewed: 0,
        todayReviewedDate: "",
        dailyGoal: 10,
        activity: {},
        coins: 128,
        owned: [],
      };
      expect(s).toEqual(expected);
    });
  });

  describe("localStorage 持久化", () => {
    it("save 后状态写入 localStorage 的 yueLearnReactV1 key", () => {
      markLearned("w1");
      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.learned).toEqual(["w1"]);
    });
  });
});
