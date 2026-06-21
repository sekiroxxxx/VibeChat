/** 页面间数据桥接 — 类型安全的 sessionStorage 存取 */
import type { EmotionAnalysis, ChatSession } from "@shared/types";

const KEYS = {
  ANALYSIS: "vb_analysis",
  ANON_IDENTITY: "vb_anon_identity",
  MATCH_MODE: "vb_match_mode",
  TARGET_EMOTION: "vb_target_emotion",
  SESSION: "vb_session",
  USER_ID: "vb_user_id",
} as const;

export const sessionStore = {
  /* 情绪分析结果 */
  getAnalysis(): EmotionAnalysis | null {
    try {
      const raw = sessionStorage.getItem(KEYS.ANALYSIS);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  setAnalysis(analysis: EmotionAnalysis): void {
    sessionStorage.setItem(KEYS.ANALYSIS, JSON.stringify(analysis));
  },

  /* 匿名身份 */
  getAnonymousIdentity(): string {
    return sessionStorage.getItem(KEYS.ANON_IDENTITY) || "";
  },
  setAnonymousIdentity(id: string): void {
    sessionStorage.setItem(KEYS.ANON_IDENTITY, id);
  },

  /* 匹配参数 */
  getMatchMode(): string { return sessionStorage.getItem(KEYS.MATCH_MODE) || "auto"; },
  setMatchMode(mode: string): void { sessionStorage.setItem(KEYS.MATCH_MODE, mode); },

  getTargetEmotion(): string { return sessionStorage.getItem(KEYS.TARGET_EMOTION) || ""; },
  setTargetEmotion(t: string): void { sessionStorage.setItem(KEYS.TARGET_EMOTION, t); },

  /* 匹配结果 — 会话 */
  getSession(): ChatSession | null {
    try {
      const raw = sessionStorage.getItem(KEYS.SESSION);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  setSession(session: ChatSession): void {
    sessionStorage.setItem(KEYS.SESSION, JSON.stringify(session));
  },

  /* 用户 ID */
  getUserId(): string { return sessionStorage.getItem(KEYS.USER_ID) || ""; },
  setUserId(id: string): void { sessionStorage.setItem(KEYS.USER_ID, id); },

  /* 清理 */
  clear(): void {
    Object.values(KEYS).forEach((k) => sessionStorage.removeItem(k));
  },
};
