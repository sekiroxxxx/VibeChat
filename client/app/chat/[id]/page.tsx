"use client";
/** 匿名聊天页 (/chat/:id) — 消息列表 + 输入 + SSE */
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useChat } from "@/hooks/useChat";
import { useSSE } from "@/hooks/useSSE";
import { useNotification } from "@/hooks/useNotification";
import { sessionStore } from "@/lib/session-store";
import { api } from "@/api/client";
import { EmptyState } from "@/components/shared/EmptyState";
import { ChatBubble, DateSeparator, fmtTime } from "@/components/chat/ChatBubble";
import { EMOTION_COLORS, DEFAULT_EMOTION_COLOR } from "@/constants/emotion-colors";
import type { ChatSession, Message } from "@shared/types";

export default function ChatPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
  const router = useRouter();

  const [session, setSession] = useState<ChatSession | null>(null);
  const [myId, setMyId] = useState("");
  const [otherName, setOtherName] = useState("");
  const [headerEmoji, setHeaderEmoji] = useState("💭");
  const [inputText, setInputText] = useState("");
  const [sseError, setSseError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [reportDone, setReportDone] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [connBanner, setConnBanner] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const typingSendRef = useRef(0);
  const typingClearRef = useRef<ReturnType<typeof setTimeout>>();

  const chat = useChat([]);
  const sse = useSSE();
  const notif = useNotification();
  const bottomRef = useRef<HTMLDivElement>(null);
  const connectedRef = useRef(false);

  // 初始化：加载 session 数据
  useEffect(() => {
    const sess = sessionStore.getSession();
    if (!sess || sess.session_id !== sessionId) return;
    setSession(sess);

    const storedUserId = sessionStore.getUserId();
    const isA = sess.user_a.id === storedUserId;
    const me = isA ? sess.user_a : sess.user_b;
    const other = isA ? sess.user_b : sess.user_a;

    setMyId(me.id);
    setOtherName(other.anonymous_name);

    const ec =
      EMOTION_COLORS[other.emotion.primary_emotion] ?? DEFAULT_EMOTION_COLOR;
    setHeaderEmoji(ec.emoji);

    // 初始化消息列表（含开场白）
    const initial: Message[] = [];
    const openingText =
      typeof sess.opening_message === "string"
        ? sess.opening_message
        : (sess.opening_message as Record<string, unknown>)?.opening_message as string || "";
    if (openingText) {
      initial.push({
        id: "opening",
        session_id: sessionId,
        type: "system",
        sender_anonymous_id: "system",
        content: openingText,
        timestamp: sess.created_at,
      });
    }
    initial.push(...sess.messages);
    chat.setMessages(initial);
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // SSE 连接
  useEffect(() => {
    if (!sessionId || connectedRef.current) return;
    connectedRef.current = true;

    // 预请求通知权限
    notif.requestPermission();

    sse.connect(sessionId, {
      onMessage: (msg) => {
        chat.addMessage(msg);
        if (msg.sender_anonymous_id !== myId && msg.type === "user") {
          notif.notify(otherName || "聊天伙伴", msg.content.slice(0, 80));
        }
      },
      onStatus: (data) => {
        // F5 — 按 reason 区分 3 种断开
        if (data.reason === "partner_disconnected") {
          setConnBanner("对方网络不稳定，连接已断开");
        } else if (data.status === "closing") {
          setStatusNote("对方已离开，当前会话即将关闭");
        } else if (data.status === "closed") {
          router.replace(`/summary/${sessionId}`);
        }
      },
      onError: (msg, retryable) => {
        setSseError(retryable ? `${msg}（自动重连中…）` : msg);
      },
      /* F4 — 对方正在输入 */
      onTyping: (data) => {
        if (data.sender_anonymous_id === myId) return;
        setTypingUser(data.sender_anonymous_id);
        clearTimeout(typingClearRef.current);
        typingClearRef.current = setTimeout(() => setTypingUser(null), 3000);
      },
    });

    return () => {
      sse.disconnect();
      connectedRef.current = false;
    };
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 自动滚到底部 — 新消息时触发
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || text.length > 1000 || submittingRef.current) return;
    submittingRef.current = true;
    chat.sendMessage(sessionId, text).finally(() => {
      submittingRef.current = false;
    });
    setInputText("");
  }, [inputText, chat, sessionId]);

  // F5 — 连接状态 → 断网/重连 banner
  useEffect(() => {
    if (sse.connectionState === "reconnecting") {
      setConnBanner("连接已断开，正在重连…");
    } else if (sse.connectionState === "connected") {
      setConnBanner(null);
      setSseError(null);
    } else if (sse.connectionState === "disconnected" && !statusNote) {
      setConnBanner("连接已断开，请检查网络");
    }
  }, [sse.connectionState, statusNote]);

  // F4 — 输入时节流发送 typing 事件（2s 间隔）
  const handleTyping = useCallback(() => {
    const now = Date.now();
    if (now - typingSendRef.current < 2000) return;
    typingSendRef.current = now;
    api.sendTyping(sessionId).catch(() => { /* 忽略 */ });
  }, [sessionId]);

  const handleLeave = useCallback(async () => {
    try {
      await api.leaveSession(sessionId);
    } catch { /* 忽略 */ }
    sse.disconnect();
    router.replace(`/summary/${sessionId}`);
  }, [sessionId, sse, router]);

  const handleReport = useCallback(async () => {
    if (reportDone) return;
    if (!window.confirm("确定要举报此对话吗？")) return;
    try {
      await api.report(sessionId);
      setReportDone(true);
    } catch {
      /* 忽略 */
    }
  }, [sessionId, reportDone]);

  // 消息元数据 — 时间格式化 + 日期分隔 + 类型判断（一次性预计算）
  const msgMeta = useMemo(() => {
    const result: Array<{
      msg: Message;
      time: string;
      dateLabel: string | null; // 非空时在此消息前插入日期分隔
      isMine: boolean;
      isSystem: boolean;
    }> = [];
    let prevTs = 0;
    let prevDay = "";

    for (const msg of chat.messages) {
      const ts = new Date(msg.timestamp).getTime();
      const day = new Date(msg.timestamp).toLocaleDateString();
      const time = fmtTime(msg.timestamp);
      const dateLabel = day !== prevDay ? day : null;

      result.push({
        msg,
        time,
        dateLabel,
        isMine: msg.sender_anonymous_id === myId,
        isSystem: msg.type === "system",
      });

      prevTs = ts;
      prevDay = day;
    }

    return result;
  }, [chat.messages, myId]);

  if (!session) {
    return (
      <main style={st.centerBg}>
        <EmptyState
          icon="💬"
          title="无法加载会话"
          description="会话可能已过期"
          action={{ label: "返回首页", onClick: () => router.push("/") }}
        />
      </main>
    );
  }

  return (
    <main style={st.bg}>
      {/* 头部 */}
      <div style={st.header}>
        <button style={st.backBtn} onClick={handleLeave}>
          ← 离开
        </button>
        <div style={st.headerCenter}>
          <span style={st.headerEmoji}>{headerEmoji}</span>
          <div>
            <p style={st.otherName}>{otherName}</p>
            <p style={st.sharedContext}>{session.shared_emotion_context}</p>
          </div>
        </div>
        <span style={st.sseDot}>
          {sse.isConnected ? "🟢" : "🔴"}
        </span>
      </div>

      {/* 状态提示 — F5 按类型分颜色 */}
      {(statusNote || sseError || connBanner) && (
        <div
          style={
            connBanner
              ? st.connBanner
              : statusNote
              ? st.statusBanner
              : st.errorBanner
          }
        >
          {connBanner || statusNote || sseError}
        </div>
      )}

      {/* 消息列表 — 每条气泡 memo 化 + 时间戳 + 日期分隔 */}
      <div style={st.msgList}>
        {msgMeta.map((m) => (
          <React.Fragment key={m.msg.id}>
            {m.dateLabel && <DateSeparator label={m.dateLabel} />}
            <ChatBubble
              msg={m.msg}
              time={m.time}
              isMine={m.isMine}
              isSystem={m.isSystem}
            />
          </React.Fragment>
        ))}
        {/* F4 — 对方正在输入指示 */}
        {typingUser && (
          <div style={st.typingRow}>
            <span style={st.typingDots}>
              <span style={{ ...st.typingDot, animationDelay: "0s" }} />
              <span style={{ ...st.typingDot, animationDelay: "0.2s" }} />
              <span style={{ ...st.typingDot, animationDelay: "0.4s" }} />
            </span>
            <span style={st.typingText}>对方正在输入…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 输入区 */}
      <div style={st.inputBar}>
        <textarea
          style={st.textInput}
          value={inputText}
          onChange={(e) => { setInputText(e.target.value); handleTyping(); }}
          placeholder="输入消息…"
          rows={1}
          maxLength={1000}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <button
          style={st.sendBtn}
          onClick={handleSend}
          disabled={chat.isLoading || !inputText.trim()}
        >
          {chat.isLoading ? "…" : "发送"}
        </button>
      </div>

      {/* 举报入口 — F1 */}
      <div style={st.reportBar}>
        <button style={st.reportBtn} onClick={handleReport} disabled={reportDone}>
          {reportDone ? "✓ 已举报" : "⚠️ 举报"}
        </button>
      </div>
    </main>
  );
}

const st: Record<string, React.CSSProperties> = {
  bg: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    background: "var(--bg)",
  },
  centerBg: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    padding: "20px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    background: "var(--surface)",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  backBtn: { fontSize: "14px", color: "var(--accent)", background: "none", padding: "4px 0" },
  headerCenter: { display: "flex", alignItems: "center", gap: "10px" },
  headerEmoji: { fontSize: "28px" },
  otherName: { fontSize: "15px", fontWeight: 600, color: "var(--text)" },
  sharedContext: { fontSize: "12px", color: "var(--text3)" },
  sseDot: { fontSize: "10px" },
  statusBanner: {
    padding: "8px 16px",
    background: "var(--caution-bg)",
    color: "var(--caution-color)",
    fontSize: "13px",
    textAlign: "center",
  },
  errorBanner: {
    padding: "8px 16px",
    background: "#fdf0ef",
    color: "#e74c3c",
    fontSize: "13px",
    textAlign: "center",
  },
  msgList: {
    flex: 1,
    overflowY: "auto",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  inputBar: {
    display: "flex",
    gap: "10px",
    padding: "12px 16px",
    background: "var(--surface)",
    borderTop: "1px solid var(--border)",
    alignItems: "flex-end",
    flexShrink: 0,
  },
  textInput: {
    flex: 1,
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1.5px solid var(--border)",
    fontSize: "15px",
    maxHeight: "100px",
    outline: "none",
    resize: "none",
    fontFamily: "inherit",
  },
  sendBtn: {
    padding: "10px 20px",
    borderRadius: "10px",
    background: "var(--accent)",
    color: "var(--btn-text)",
    fontSize: "14px",
    fontWeight: 600,
    flexShrink: 0,
  },
  reportBar: {
    padding: "8px 16px 12px",
    textAlign: "center",
    flexShrink: 0,
  },
  reportBtn: {
    fontSize: "12px",
    color: "var(--text3)",
    background: "none",
    textDecoration: "underline",
    padding: "4px",
  },
  /* F5 — 连接断开 banner（蓝色，区别于警告/错误） */
  connBanner: {
    padding: "8px 16px",
    background: "#e8f4fd",
    color: "#4a6fa5",
    fontSize: "13px",
    textAlign: "center",
  },
  /* F4 — 输入指示 */
  typingRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "4px 0",
  },
  typingDots: {
    display: "flex",
    gap: "4px",
  },
  typingDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "var(--text3)",
    animation: "pulse 1.2s ease-in-out infinite",
  },
  typingText: {
    fontSize: "12px",
    color: "var(--text3)",
    fontStyle: "italic",
  },
};
