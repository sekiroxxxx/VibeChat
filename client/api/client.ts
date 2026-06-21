/** HTTP 客户端 — mock 模式下不调后端，直接从 mock-api 返回 */
import { isMockMode } from "@/lib/mock-mode";
import { mockRoute } from "@/lib/mock-api";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  // ── Mock 模式：拦截所有 HTTP 请求 ──
  if (isMockMode()) {
    let body: Record<string, unknown> | undefined;
    if (options?.body) {
      try { body = JSON.parse(options.body as string); } catch { /* ignore */ }
    }
    const result = await mockRoute(path, options?.method || "GET", body);
    if (result) {
      const [data, ok] = result;
      if (!ok) throw new Error((data.error as string) || "Mock error");
      return data as T;
    }
    // 未匹配的 mock 路由 → 返回空成功（如 typing 事件等不重要的调用）
    console.warn(`[mock] 未匹配: ${options?.method || "GET"} ${path}`);
    return {} as T;
  }

  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
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
  /** 通用 GET 请求 */
  get: <T>(path: string) => request<T>(path),

  createGuest: () =>
    request<{ user_id: string; auth_type: string }>("/api/auth/guest", { method: "POST" }),

  getMe: () =>
    request<{
      authenticated: boolean;
      user?: Record<string, unknown>;
      emotion_history?: Record<string, unknown>[];
      past_sessions?: Record<string, unknown>[];
    }>("/api/me"),

  /** 返回 analysis + identity；HIGH 风险时返回 redirect + safety */
  analyze: (text: string) =>
    request<{
      analysis?: Record<string, unknown>;
      anonymous_identity?: string;
      redirect?: string;
      safety?: Record<string, unknown>;
      is_fallback?: boolean;
    }>("/api/analyze", {
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

  report: (sessionId: string) =>
    request<{ reported: boolean }>(`/api/sessions/${sessionId}/report`, { method: "POST" }),

  sendTyping: (sessionId: string) =>
    request<void>(`/api/sessions/${sessionId}/typing`, { method: "POST" }),

  summary: (sessionId: string, feeling: string) =>
    request<{ summary: string; emotion_shift: { before: string; after_hint: string } }>(
      `/api/sessions/${sessionId}/summary`,
      { method: "POST", body: JSON.stringify({ feeling }) },
    ),

  getStreamUrl: (sessionId: string) =>
    `${BASE}/api/sessions/${sessionId}/stream`,
};
