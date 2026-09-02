import { useSyncExternalStore } from "react";
import {
  login as apiLogin,
  register as apiRegister,
  fetchState,
  pushState,
  setToken,
  clearToken,
  getToken,
} from "./api";

export interface LearningState {
  learned: string[]; // 已「记」（斩）的词 id
  stuck: string[]; // 生词本（选错 / 再背一次）
  reviewed: string[]; // 已「背」过的词 id
  streak: number; // 连续学习天数
  lastDay: string; // 最后学习日期
  todayLearned: number; // 今日已记数量
  todayLearnedDate: string;
  todayReviewed: number; // 今日已背数量
  todayReviewedDate: string;
  dailyGoal: number; // 每日目标（词）
  activity: Record<string, number>; // date -> 当天学习动作数
  coins: number; // 铜板余额
  owned: string[]; // 已购商品名
}

const KEY = "yueLearnReactV1";

const DEFAULT: LearningState = {
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

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function load(): LearningState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT };
  }
}

let state: LearningState = load();
const listeners = new Set<() => void>();

function save(next: LearningState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
  // 已登录则防抖上传到云端（接入后端，不改动上方状态机逻辑）
  if (getToken() && !skipUpload) scheduleUpload();
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState(): LearningState {
  return state;
}

export function useLearning(): LearningState {
  // 第三个参数 getServerSnapshot：SSR / 预渲染时兜底，浏览器端不受影响
  return useSyncExternalStore(subscribe, getState, getState);
}

function touchStreak(s: LearningState): LearningState {
  const d = today();
  if (s.lastDay === d) return s;
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  return { ...s, streak: s.lastDay === yest ? s.streak + 1 : 1, lastDay: d };
}

function bumpActivity(s: LearningState): LearningState {
  const d = today();
  return { ...s, activity: { ...s.activity, [d]: (s.activity[d] || 0) + 1 } };
}

/** 记粤语：斩对一个词 */
export function markLearned(id: string) {
  const s = bumpActivity(touchStreak(state));
  const d = today();
  const learned = s.learned.includes(id) ? s.learned : [...s.learned, id];
  save({
    ...s,
    learned,
    todayLearned: s.todayLearnedDate === d ? s.todayLearned + 1 : 1,
    todayLearnedDate: d,
  });
}

/** 记粤语选错 / 背粤语「再背一次」：进生词本 */
export function markStuck(id: string) {
  const s = bumpActivity(touchStreak(state));
  const stuck = s.stuck.includes(id) ? s.stuck : [...s.stuck, id];
  save({ ...s, stuck });
}

/** 消费铜板购买商品，余额不足返回 false */
export function buyItem(name: string, coins: number): boolean {
  if (state.owned.includes(name)) return false;
  if (state.coins < coins) return false;
  save({ ...state, coins: state.coins - coins, owned: [...state.owned, name] });
  return true;
}

/** 从生词本移除（已掌握） */
export function removeStuck(id: string) {
  if (!state.stuck.includes(id)) return;
  save({ ...state, stuck: state.stuck.filter((x) => x !== id) });
}

/** 背粤语：标记「认识」 */
export function markReviewed(id: string) {
  const s = bumpActivity(touchStreak(state));
  const d = today();
  const reviewed = s.reviewed.includes(id) ? s.reviewed : [...s.reviewed, id];
  save({
    ...s,
    reviewed,
    todayReviewed: s.todayReviewedDate === d ? s.todayReviewed + 1 : 1,
    todayReviewedDate: d,
  });
}

export function setDailyGoal(n: number) {
  save({ ...state, dailyGoal: n });
}

export function resetAll() {
  save({ ...DEFAULT });
}

// ====================================================================
// 云端同步接入：以下为后端联动新增函数，不改动上方任何状态机逻辑
// ====================================================================

let uploadTimer: ReturnType<typeof setTimeout> | null = null;
// 拉取云端覆盖本地时设为 true，避免回灌触发上传
let skipUpload = false;

/** 防抖上传：本地状态变更后 1.5s 内无新操作才上传，避免高频请求 */
function scheduleUpload() {
  if (uploadTimer) clearTimeout(uploadTimer);
  uploadTimer = setTimeout(async () => {
    try {
      await pushState(state);
    } catch (e) {
      console.warn("学习状态上传失败：", e);
    }
  }, 1500);
}

/** 登录并拉取云端状态覆盖本地（last-write-wins，整体覆盖） */
export async function loginAndSync(
  username: string,
  password: string
): Promise<{ username: string }> {
  const r = await apiLogin(username, password);
  setToken(r.token);
  const cloud = await fetchState();
  if (cloud.hasCloudData && cloud.state) {
    skipUpload = true;
    save({ ...DEFAULT, ...(cloud.state as LearningState) });
    skipUpload = false;
  }
  return { username: r.username };
}

/** 注册新账号（新用户无云端数据，注册即上传当前本地状态作为初始记录） */
export async function registerAndSync(
  username: string,
  password: string
): Promise<{ username: string }> {
  const r = await apiRegister(username, password);
  setToken(r.token);
  try {
    await pushState(state);
  } catch (e) {
    console.warn("初始状态上传失败：", e);
  }
  return { username: r.username };
}

/** 退出登录：清除 token，本地数据保留 */
export function logout() {
  clearToken();
}

export { isLoggedin, currentUser } from "./api";
