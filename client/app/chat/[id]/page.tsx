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
import { EMOTION_COLORS, DEFAULT_EMOTION_COLOR } from "@/constants/emotion-colors";
import type { ChatSession, Message } from "@shared/types";

/** 格式化 HH:mm */
function fmtTime(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

/** 日期分隔线组件 */
const DateSeparator = React.memo(function DateSeparator({ label }: { label: string }) {
  return (
    <div style={st.dateSep}>
      <span style={st.dateSepLine} />
      <span style={st.dateSepText}>{label}</span>
      <span style={st.dateSepLine} />
    </div>
  );
});

/** 单条消息气泡 — memo 避免全列表重渲染 */
const ChatBubble = React.memo(function ChatBubble({
  msg,
  time,
  isMine,
  isSystem,
}: {
  msg: Message;
  time: string;
  isMine: boolean;
  isSystem: boolean;
}) {
  return (
    <div
      style={{
        ...st.msgRow,
        justifyContent: isSystem ? "center" : isMine ? "flex-end" : "flex-start",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : isSystem ? "center" : "flex-start", maxWidth: "80%" }}>
        <div
          style={{
            ...st.msgBubble,
            ...(isSystem ? st.systemBubble : isMine ? st.myBubble : st.otherBubble),
          }}
        >
          {msg.content}
        </div>
        <span style={{
          ...st.msgTime,
          textAlign: isSystem ? "center" : isMine ? "right" : "left",
        }}>
          {time}
        </span>
      </div>
    </div>
  );
});

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
  const submittingRef = useRef(false);

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
        // 对方消息 + 页面不可见 → 浏览器通知
        if (msg.sender_anonymous_id !== myId && msg.type === "user") {
          notif.notify(otherName || "聊天伙伴", msg.content.slice(0, 80));
        }
      },
      onStatus: (data) => {
        if (data.status === "closing") {
          setStatusNote("对方已离开，当前会话即将关闭");
        } else if (data.status === "closed") {
          router.replace("/closed");
        }
      },
      onError: (msg, retryable) => {
        setSseError(retryable ? `${msg}（自动重连中…）` : msg);
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

  const handleLeave = useCallback(async () => {
    try {
      await api.leaveSession(sessionId);
    } catch { /* 忽略 */ }
    sse.disconnect();
    router.replace("/closed");
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

      {/* 状态提示 */}
      {(statusNote || sseError) && (
        <div style={statusNote ? st.statusBanner : st.errorBanner}>
          {statusNote || sseError}
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
        <div ref={bottomRef} />
      </div>

      {/* 输入区 */}
      <div style={st.inputBar}>
        <textarea
          style={st.textInput}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
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
    background: "#f5f5f7",
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
    background: "#fff",
    borderBottom: "1px solid #eee",
    flexShrink: 0,
  },
  backBtn: { fontSize: "14px", color: "#7c6ff7", background: "none", padding: "4px 0" },
  headerCenter: { display: "flex", alignItems: "center", gap: "10px" },
  headerEmoji: { fontSize: "28px" },
  otherName: { fontSize: "15px", fontWeight: 600, color: "#333" },
  sharedContext: { fontSize: "12px", color: "#999" },
  sseDot: { fontSize: "10px" },
  statusBanner: {
    padding: "8px 16px",
    background: "#fff8e6",
    color: "#b8960c",
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
  msgRow: {
    display: "flex",
    animation: "fadeInUp 0.3s ease",
  },
  msgBubble: {
    maxWidth: "75%",
    padding: "10px 14px",
    borderRadius: "14px",
    fontSize: "15px",
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  systemBubble: {
    background: "#f0eeff",
    color: "#7c6ff7",
    fontSize: "13px",
    maxWidth: "85%",
    textAlign: "center",
  },
  myBubble: {
    background: "#7c6ff7",
    color: "#fff",
    borderBottomRightRadius: "4px",
  },
  otherBubble: {
    background: "#fff",
    color: "#333",
    borderBottomLeftRadius: "4px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  },
  inputBar: {
    display: "flex",
    gap: "10px",
    padding: "12px 16px",
    background: "#fff",
    borderTop: "1px solid #eee",
    alignItems: "flex-end",
    flexShrink: 0,
  },
  textInput: {
    flex: 1,
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1.5px solid #e0e0e0",
    fontSize: "15px",
    maxHeight: "100px",
    outline: "none",
    resize: "none",
    fontFamily: "inherit",
  },
  sendBtn: {
    padding: "10px 20px",
    borderRadius: "10px",
    background: "#7c6ff7",
    color: "#fff",
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
    color: "#bbb",
    background: "none",
    textDecoration: "underline",
    padding: "4px",
  },
  /* F2 — 时间戳 */
  msgTime: {
    fontSize: "11px",
    color: "#bbb",
    marginTop: "3px",
    padding: "0 4px",
  },
  /* F2 — 日期分隔线 */
  dateSep: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 0",
  },
  dateSepLine: {
    flex: 1,
    height: "1px",
    background: "#e8e8e8",
  },
  dateSepText: {
    fontSize: "12px",
    color: "#bbb",
    whiteSpace: "nowrap",
  },
};
