// 后端 API 客户端：用户认证 + 学习状态同步
// BASE 默认指向本地后端，部署时用 VITE_API_BASE 覆盖
const BASE =
  (import.meta as unknown as { env?: { VITE_API_BASE?: string } }).env
    ?.VITE_API_BASE || "http://localhost:8080";

const TOKEN_KEY = "yueToken";
const USER_KEY = "yueUser";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
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
