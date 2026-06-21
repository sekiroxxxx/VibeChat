/**
 * Mock 数据 — 前端独立预览用
 *
 * 使用方式:
 *   1. URL 加 ?mock=1 → 页面自动使用 mock 数据，不调后端
 *   2. 后端不可用时页面自动降级到 mock
 *
 * 维护: 新增/修改 mock 数据只改此文件
 */

import type { EmotionAnalysis, ChatSession, Message } from "@shared/types";

/* ── 情绪分析结果 ── */
export const MOCK_ANALYSIS: EmotionAnalysis = {
  primary_emotion: "疲惫",
  secondary_emotion: "期待",
  intensity: 0.65,
  valence: -0.2,
  emotion_vector: {
    "喜悦": 0.1, "悲伤": 0.2, "焦虑": 0.3, "愤怒": 0.0,
    "孤独": 0.4, "期待": 0.6, "平静": 0.1, "疲惫": 0.8,
    "恐惧": 0.0, "感激": 0.1, "困惑": 0.1, "释然": 0.2,
  },
  interpretation: "工作了一整天后，你感到身心俱疲，但内心深处仍然对明天抱有一丝期待。现在需要的不是激烈对话，而是一份安静的陪伴。",
  keywords: ["工作累", "期待", "需要陪伴"],
  match_preferences: {
    recommended: [
      { target_emotion: "平静", reason: "温和的氛围能让你放松", priority: 1 },
      { target_emotion: "释然", reason: "对方经历过类似的心境", priority: 2 },
    ],
    avoid: ["愤怒"],
  },
  safety: {
    risk_level: "NONE",
    risk_type: "none",
    suitable_for_chat: true,
    action: "allow_match",
  },
  authenticity: {
    is_genuine_emotion: true,
    flags: [],
    confidence: 0.92,
  },
};

/* ── 聊天消息 ── */
const MOCK_MESSAGES: Message[] = [
  {
    id: "msg-1",
    session_id: "mock-session-1",
    type: "system",
    sender_anonymous_id: "system",
    content: "你们都带着各自的情绪来到了这里。一位感到疲惫却心怀期待，另一位正享受平静的时光。希望这段对话能为彼此带来温暖。",
    timestamp: "2026-06-20T14:30:00Z",
  },
  {
    id: "msg-2",
    session_id: "mock-session-1",
    type: "user",
    sender_anonymous_id: "other-user-1",
    content: "嗨，听说你今天挺累的？",
    timestamp: "2026-06-20T14:31:30Z",
  },
  {
    id: "msg-3",
    session_id: "mock-session-1",
    type: "user",
    sender_anonymous_id: "my-user-id",
    content: "是啊，从早忙到晚，不过总算是把项目搞定了",
    timestamp: "2026-06-20T14:32:10Z",
  },
  {
    id: "msg-4",
    session_id: "mock-session-1",
    type: "user",
    sender_anonymous_id: "other-user-1",
    content: "恭喜！那种完成后的轻松感很特别吧",
    timestamp: "2026-06-20T14:32:45Z",
  },
  {
    id: "msg-5",
    session_id: "mock-session-1",
    type: "user",
    sender_anonymous_id: "my-user-id",
    content: "确实，虽然累但很有成就感。明天打算给自己放个假",
    timestamp: "2026-06-20T14:33:20Z",
  },
  {
    id: "msg-6",
    session_id: "mock-session-1",
    type: "user",
    sender_anonymous_id: "other-user-1",
    content: "好好休息！你值得的 😊 打算怎么放松？",
    timestamp: "2026-06-20T14:34:00Z",
  },
  {
    id: "msg-7",
    session_id: "mock-session-1",
    type: "user",
    sender_anonymous_id: "my-user-id",
    content: "可能去公园走走，好久没呼吸新鲜空气了",
    timestamp: "2026-06-20T14:34:40Z",
  },
  {
    id: "msg-8",
    session_id: "mock-session-1",
    type: "user",
    sender_anonymous_id: "other-user-1",
    content: "听起来很棒！大自然确实是最好的充电器",
    timestamp: "2026-06-20T14:35:15Z",
  },
  {
    id: "msg-9",
    session_id: "mock-session-1",
    type: "user",
    sender_anonymous_id: "my-user-id",
    content: "谢谢你陪我聊这些，感觉好多了",
    timestamp: "2026-06-20T14:36:00Z",
  },
  {
    id: "msg-10",
    session_id: "mock-session-1",
    type: "user",
    sender_anonymous_id: "other-user-1",
    content: "我也很开心能和你聊天！祝你明天有个愉快的一天 🌿",
    timestamp: "2026-06-21T09:15:00Z",
  },
];

/* ── 聊天会话 ── */
export const MOCK_SESSION: ChatSession = {
  session_id: "mock-session-1",
  user_a: {
    id: "my-user-id",
    anonymous_name: "安静的房间",
    emotion: MOCK_ANALYSIS,
  },
  user_b: {
    id: "other-user-1",
    anonymous_name: "一杯温水",
    emotion: {
      ...MOCK_ANALYSIS,
      primary_emotion: "平静",
      secondary_emotion: undefined,
      intensity: 0.4,
      valence: 0.5,
      interpretation: "你正处于一种宁静的状态。",
      keywords: ["平静", "放松"],
    } as EmotionAnalysis,
  },
  shared_emotion_context: "你们都带着'疲惫'和'平静'的情绪来到了这里",
  opening_message: "你们都带着各自的情绪来到了这里。一位感到疲惫却心怀期待，另一位正享受平静的时光。",
  messages: MOCK_MESSAGES,
  status: "active",
  risk_score: 0,
  risk_flags: [],
  created_at: "2026-06-20T14:30:00Z",
};

/* ── GET /api/me 返回的完整数据 ── */
export const MOCK_ME = {
  authenticated: true,
  user: {
    user_id: "my-user-id",
    auth_type: "guest",
    anonymous_identity: "安静的房间",
    created_at: Date.now() / 1000 - 86400 * 7,
    current_emotion: null,
    emotion_history: [] as Record<string, unknown>[],
    match_status: "idle",
    retry_count: 0,
    current_session_id: null,
    account_id: null,
  },
  /* B1 — 情绪历史 */
  emotion_history: [
    {
      primary_emotion: "疲惫",
      summary: "工作后的疲惫中藏着对明天的期待，聊天后情绪从疲惫转向了平静和感激",
      feeling: "聊完之后轻松了很多，感觉被理解了",
      session_id: "mock-session-1",
      timestamp: "2026-06-20T14:40:00Z",
    },
    {
      primary_emotion: "焦虑",
      summary: "面对新环境的焦虑，通过对话逐渐缓解",
      session_id: "mock-session-2",
      timestamp: "2026-06-19T20:15:00Z",
    },
    {
      primary_emotion: "喜悦",
      summary: "分享了一件开心的事，收获了共鸣和祝福",
      session_id: "mock-session-3",
      timestamp: "2026-06-18T12:00:00Z",
    },
  ],
  /* B1 — 聊天记录列表 */
  past_sessions: [
    {
      session_id: "mock-session-1",
      other_name: "一杯温水",
      other_emotion: "平静",
      created_at: "2026-06-20T14:30:00Z",
      closed_at: "2026-06-20T14:40:00Z",
      status: "closed",
    },
    {
      session_id: "mock-session-2",
      other_name: "晨光里的人",
      other_emotion: "期待",
      created_at: "2026-06-19T20:00:00Z",
      closed_at: "2026-06-19T20:15:00Z",
      status: "closed",
    },
    {
      session_id: "mock-session-3",
      other_name: "刚晒过太阳的猫",
      other_emotion: "喜悦",
      created_at: "2026-06-18T11:30:00Z",
      closed_at: "2026-06-18T12:00:00Z",
      status: "closed",
    },
  ],
};

/* ── 判断是否使用 mock ── */
export function shouldMock(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("mock");
}

/** 获取当前页面的 mock 参数值 */
export function mockParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(key);
}
