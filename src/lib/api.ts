// 后端 API 客户端：用户认证 + 学习状态同步
// BASE 默认指向本地后端，部署时用 VITE_API_BASE 覆盖（.env.production 中留空 = 同源相对路径，由 nginx 反代）
const BASE =
(import.meta as unknown as { env?: { VITE_API_BASE?: string } }).env
?.VITE_API_BASE ?? "http://localhost:8080";

const TOKEN_KEY = "yueToken";
const USER_KEY = "yueUser";
// 登录状态变化事件：登录/登出/过期时广播，UI 监听后刷新显示
export const AUTH_CHANGED_EVENT = "yue-auth-changed";

function notifyAuthChanged(): void {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  notifyAuthChanged();
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  notifyAuthChanged();
}

export function setUser(username: string): void {
  localStorage.setItem(USER_KEY, username);
}

export function currentUser(): string | null {
  return localStorage.getItem(USER_KEY);
}

export function isLoggedin(): boolean {
  return !!getToken();
}

export interface AuthResponse {
  token: string;
  username: string;
  userId: number;
}

async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    // 401：token 缺失或过期，自动清除本地登录态（下次操作回到未登录模式）
    if (res.status === 401) {
      clearToken();
    }
    const err = (await res.json().catch(() => ({ error: res.statusText }))) as {
      error?: string;
    };
    throw new Error(err.error || "请求失败");
  }
  return res;
}

/** 注册 */
export async function register(
  username: string,
  password: string
): Promise<AuthResponse> {
  const res = await authFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  return res.json();
}

/** 登录 */
export async function login(
  username: string,
  password: string
): Promise<AuthResponse> {
  const res = await authFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  return res.json();
}

/** 拉取云端学习状态 */
export async function fetchState(): Promise<{
  hasCloudData: boolean;
  state?: unknown;
}> {
  const res = await authFetch("/api/learn/state");
  return res.json();
}

/** 上传学习状态（整体覆盖） */
export async function pushState(state: unknown): Promise<{
  status: string;
  updatedAt: string;
}> {
  const res = await authFetch("/api/learn/state", {
    method: "PUT",
    body: JSON.stringify(state),
  });
  return res.json();
}

/** AI 聊天代理：走后端服务（大模型 Key 配在服务端），需登录，用户无需自备 Key */
export async function aiChat(
  messages: { role: string; content: string }[],
  temperature = 0.7
): Promise<{ choices?: { message?: { content?: string } }[] }> {
  const res = await authFetch("/api/ai/chat", {
    method: "POST",
    body: JSON.stringify({ messages, temperature }),
  });
  return res.json();
}
