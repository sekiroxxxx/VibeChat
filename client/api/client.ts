/** HTTP 客户端 — 只调 server HTTP 端点，不 import server */

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",  // cookie 自动带
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "请求失败" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  createGuest: () =>
    request<{ user_id: string; anonymous_identity: string }>("/api/auth/guest", { method: "POST" }),

  getMe: () =>
    request<{ user: any }>("/api/me"),

  analyze: (text: string) =>
    request<{ analysis: any; anonymous_identity: string }>("/api/analyze", {
      method: "POST", body: JSON.stringify({ text }),
    }),

  match: (mode: string, target?: string) =>
    request<any>("/api/match", {
      method: "POST", body: JSON.stringify({ match_mode: mode, target_emotion: target, match_strategy: "similar" }),
    }),

  cancelMatch: () =>
    request<void>("/api/match", { method: "DELETE" }),

  sendMessage: (sessionId: string, content: string) =>
    request<any>(`/api/sessions/${sessionId}/messages`, {
      method: "POST", body: JSON.stringify({ content }),
    }),

  leaveSession: (sessionId: string) =>
    request<void>(`/api/sessions/${sessionId}/leave`, { method: "POST" }),

  getStreamUrl: (sessionId: string) =>
    `${BASE}/api/sessions/${sessionId}/stream`,
};
