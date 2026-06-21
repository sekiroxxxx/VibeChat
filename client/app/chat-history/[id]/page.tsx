"use client";
/** 聊天记录回放页 (/chat-history/:id) — F5 只读模式 */
import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/api/client";
import { ChatBubble, DateSeparator, fmtTime } from "@/components/chat/ChatBubble";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EMOTION_COLORS, DEFAULT_EMOTION_COLOR } from "@/constants/emotion-colors";
import type { ChatSession, Message } from "@shared/types";

export default function ChatHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [otherName, setOtherName] = useState("");
  const [headerEmoji, setHeaderEmoji] = useState("💭");
  const [chatTime, setChatTime] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myId, setMyId] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("vb_session");
    let uid = "";
    if (raw) {
      try {
        const sess: ChatSession = JSON.parse(raw);
        if (sess.session_id === id) uid = sess.user_a.id || "";
      } catch { /* ignore */ }
    }
    setMyId(uid);

    api.get<{ session: ChatSession }>(`/api/sessions/${id}`)
      .then((data) => {
        const s = data.session;
        setSession(s);
        const isA = s.user_a.id === uid;
        const other = isA ? s.user_b : s.user_a;
        setOtherName(other.anonymous_name);
        const ec = EMOTION_COLORS[other.emotion.primary_emotion] ?? DEFAULT_EMOTION_COLOR;
        setHeaderEmoji(ec.emoji);
        setChatTime(`${new Date(s.created_at).toLocaleDateString()} ${fmtTime(s.created_at)}`);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setIsLoading(false));
  }, [id]);

  // 消息元数据（与 chat 页一致）
  const msgMeta = useMemo(() => {
    if (!session) return [];
    const result: Array<{
      msg: Message;
      time: string;
      dateLabel: string | null;
      isMine: boolean;
      isSystem: boolean;
      senderName: string;
    }> = [];
    let prevDay = "";

    for (const msg of session.messages) {
      const day = new Date(msg.timestamp).toLocaleDateString();
      result.push({
        msg,
        time: fmtTime(msg.timestamp),
        dateLabel: day !== prevDay ? day : null,
        isMine: msg.sender_anonymous_id === myId,
        isSystem: msg.type === "system",
        senderName: msg.sender_anonymous_id === myId
          ? (session.user_a.id === myId ? session.user_a.anonymous_name : session.user_b.anonymous_name)
          : otherName,
      });
      prevDay = day;
    }
    return result;
  }, [session, myId, otherName]);

  if (isLoading) {
    return (
      <main style={st.center}>
        <LoadingSpinner text="加载聊天记录…" />
      </main>
    );
  }

  if (error || !session) {
    return (
      <main style={st.center}>
        <EmptyState
          icon="💬"
          title="无法加载聊天记录"
          description={error || "会话不存在或已过期"}
          action={{ label: "返回列表", onClick: () => router.push("/chat-history") }}
        />
      </main>
    );
  }

  return (
    <main style={st.bg}>
      {/* 头部 */}
      <div style={st.header}>
        <button style={st.backBtn} onClick={() => router.back()}>
          ← 返回
        </button>
        <div style={st.headerCenter}>
          <span style={st.headerEmoji}>{headerEmoji}</span>
          <div>
            <p style={st.otherName}>{otherName}</p>
            <p style={st.chatTime}>{chatTime}</p>
          </div>
        </div>
      </div>

      {/* 消息列表 — 只读回放 */}
      <div style={st.msgList}>
        {msgMeta.length === 0 && (
          <EmptyState icon="📭" title="暂无消息" description="此会话还没有聊天内容" />
        )}
        {msgMeta.map((m) => (
          <React.Fragment key={m.msg.id}>
            {m.dateLabel && <DateSeparator label={m.dateLabel} />}
            <ChatBubble
              msg={m.msg}
              time={m.time}
              isMine={m.isMine}
              isSystem={m.isSystem}
              senderName={m.senderName}
            />
          </React.Fragment>
        ))}
      </div>

      {/* 底部 */}
      <div style={st.footer}>
        <a style={st.footerLink} href="/chat-history">
          ← 返回聊天记录列表
        </a>
      </div>
    </main>
  );
}

// 需要 React.Fragment
import React from "react";

const st: Record<string, React.CSSProperties> = {
  bg: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    background: "var(--bg)",
  },
  center: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    padding: "20px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "14px 16px",
    background: "var(--surface)",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  backBtn: { fontSize: "14px", color: "var(--accent)", background: "none", padding: "4px 0" },
  headerCenter: { display: "flex", alignItems: "center", gap: "10px" },
  headerEmoji: { fontSize: "28px" },
  otherName: { fontSize: "15px", fontWeight: 600, color: "var(--text)" },
  chatTime: { fontSize: "12px", color: "var(--text3)" },
  msgList: {
    flex: 1,
    overflowY: "auto",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  footer: {
    padding: "12px 16px 14px",
    textAlign: "center",
    flexShrink: 0,
    background: "var(--surface)",
    borderTop: "1px solid var(--border)",
  },
  footerLink: {
    fontSize: "14px",
    color: "var(--accent)",
    textDecoration: "none",
  },
  mockBadge: {
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--btn-text)",
    background: "#f0a030",
    padding: "2px 8px",
    borderRadius: "4px",
    flexShrink: 0,
  },
};
