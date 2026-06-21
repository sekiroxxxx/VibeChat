/**
 * Mock API 路由器 — 模拟后端返回
 * 所有 mock 数据存在 mock-data.ts，此处只做路由分发
 *
 * 维护方式：新增端点时在这里加一条 case，数据定义在 mock-data.ts
 */

import { MOCK_ANALYSIS, MOCK_SESSION, MOCK_ME } from "./mock-data";
import { EMOTION_COLORS, DEFAULT_EMOTION_COLOR } from "@/constants/emotion-colors";

const EMOTION_COLORS_MAP: Record<string, string> = {};
for (const [k, v] of Object.entries(EMOTION_COLORS)) {
  EMOTION_COLORS_MAP[k] = v.emoji;
}
const _ = DEFAULT_EMOTION_COLOR;

/** 路由 mock 请求，返回 [data, ok] 或 null（未匹配） */
export async function mockRoute(
  path: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<[Record<string, unknown>, boolean] | null> {
  const p = path.replace(/\/$/, ""); // 去尾斜杠

  /* ── 认证 ── */
  if (p === "/api/auth/guest" && method === "POST") {
    return [{ user_id: "mock-user-id", auth_type: "guest" }, true];
  }
  if (p === "/api/me" && method === "GET") {
    return [MOCK_ME as unknown as Record<string, unknown>, true];
  }

  /* ── 情绪分析 ── */
  if (p === "/api/analyze" && method === "POST") {
    const text = (body?.text as string) || "";
    // 模拟 HIGH 风险检测
    if (text.includes("不想活了") || text.includes("自杀")) {
      return [{
        redirect: "care",
        safety: { risk_level: "HIGH", risk_type: "self_harm", suitable_for_chat: false, action: "show_resources", resources: ["全国心理援助热线: 400-161-9995"] },
      }, true];
    }
    return [{
      analysis: MOCK_ANALYSIS,
      anonymous_identity: "安静的房间",
      is_fallback: false,
    }, true];
  }

  /* ── 匹配 ── */
  if (p === "/api/match" && method === "POST") {
    // 模拟匹配成功（延迟 1.5s 模拟等待）
    await new Promise((r) => setTimeout(r, 1500));
    return [{
      matched: true,
      session: MOCK_SESSION,
    }, true];
  }
  if (p === "/api/match" && method === "DELETE") {
    return [{ cancelled: true }, true];
  }

  /* ── 会话 ── */
  const sessionMatch = p.match(/^\/api\/sessions\/([^/]+)$/);
  if (sessionMatch && method === "GET") {
    return [{ session: MOCK_SESSION }, true];
  }
  if (sessionMatch && method === "POST") {
    const action = p.split("/").pop();
    if (action === "leave") return [{ left: true }, true];
    if (action === "report") return [{ reported: true }, true];
    if (action === "typing") return [{ ok: true }, true];
  }

  /* ── 消息 ── */
  const msgMatch = p.match(/^\/api\/sessions\/([^/]+)\/messages$/);
  if (msgMatch && method === "POST") {
    const content = (body?.content as string) || "";
    if (content.includes("wx") || content.includes("138")) {
      return [{ sent: false, blocked: true, content, flags: ["contact"] }, true];
    }
    const msg = {
      id: "mock-msg-" + Date.now(),
      session_id: MOCK_SESSION.session_id,
      type: "user",
      sender_anonymous_id: "mock-user-id",
      content,
      timestamp: new Date().toISOString(),
    };
    return [{ sent: true, message: msg }, true];
  }

  /* ── 总结 ── */
  const summaryMatch = p.match(/^\/api\/sessions\/([^/]+)\/summary$/);
  if (summaryMatch && method === "POST") {
    const session = MOCK_SESSION;
    return [{
      summary: "这次对话让你从孤独中找到了温暖的陪伴。深夜的聊天里，你们交换了安静的理解——不是要解决什么，而是有人愿意在那个时候陪着你。",
      emotion_shift: {
        before: session.user_a.emotion.primary_emotion,
        after_hint: "释然中带着平静，心里好像卸下了点什么",
      },
      recap: {
        entering_emotion: session.user_a.emotion.primary_emotion,
        entering_emoji: EMOTION_COLORS_MAP[session.user_a.emotion.primary_emotion] || "💭",
        partner_name: session.user_b.anonymous_name,
        partner_emotion: session.user_b.emotion.primary_emotion,
        partner_emoji: EMOTION_COLORS_MAP[session.user_b.emotion.primary_emotion] || "💭",
        message_count: session.messages.filter((m) => m.type === "user").length,
        duration: "8 分钟",
      },
      blocks: {
        emotion_start: `你进入对话时感到「${session.user_a.emotion.primary_emotion}」——${session.user_a.emotion.interpretation}`,
        conversation: `与「${session.user_b.anonymous_name}」交换了 ${session.messages.filter((m) => m.type === "user").length} 条消息，持续约 8 分钟。你们在相似的深夜里寻找一种安静的陪伴。`,
        emotion_change: `从「${session.user_a.emotion.primary_emotion}」到「释然」——对话帮助你释放了一些压在心里的重量。`,
      },
    }, true];
  }

  return null; // 未匹配
}
