"use client";
/** 匿名聊天页 (/chat/:id) — 沉浸式布局：atmo + partner + thread + 非对称气泡 + 胶囊输入 */
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useChat } from "@/hooks/useChat";
import { useSSE } from "@/hooks/useSSE";
import { useNotification } from "@/hooks/useNotification";
import { useTheme } from "@/hooks/useTheme";
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
  const { theme, toggle: toggleTheme } = useTheme();

  const [session, setSession] = useState<ChatSession | null>(null);
  const [myId, setMyId] = useState("");
  const [myName, setMyName] = useState("");
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

  /* ── 初始化 ── */
  useEffect(() => {
    const sess = sessionStore.getSession();
    if (!sess || sess.session_id !== sessionId) return;
    setSession(sess);

    const storedUserId = sessionStore.getUserId();
    const isA = sess.user_a.id === storedUserId;
    const me = isA ? sess.user_a : sess.user_b;
    const other = isA ? sess.user_b : sess.user_a;

    setMyId(me.id);
    setMyName(me.anonymous_name);
    setOtherName(other.anonymous_name);

    const ec = EMOTION_COLORS[other.emotion.primary_emotion] ?? DEFAULT_EMOTION_COLOR;
    setHeaderEmoji(ec.emoji);

    // 消息列表
    const initial: Message[] = [];
    const openingText =
      typeof sess.opening_message === "string"
        ? sess.opening_message
        : (sess.opening_message as Record<string, unknown>)?.opening_message as string || "";
    if (openingText) {
      initial.push({
        id: "opening", session_id: sessionId, type: "system",
        sender_anonymous_id: "system", content: openingText, timestamp: sess.created_at,
      });
    }
    initial.push(...sess.messages);
    chat.setMessages(initial);
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── SSE ── */
  useEffect(() => {
    if (!sessionId || connectedRef.current) return;
    connectedRef.current = true;
    notif.requestPermission();

    sse.connect(sessionId, {
      onMessage: (msg) => {
        chat.addMessage(msg);
        if (msg.sender_anonymous_id !== myId && msg.type === "user") {
          notif.notify(otherName || "聊天伙伴", msg.content.slice(0, 80));
        }
      },
      onStatus: (data) => {
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
      onTyping: (data) => {
        if (data.sender_anonymous_id === myId) return;
        setTypingUser(data.sender_anonymous_id);
        clearTimeout(typingClearRef.current);
        typingClearRef.current = setTimeout(() => setTypingUser(null), 3000);
      },
    });

    return () => { sse.disconnect(); connectedRef.current = false; };
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 自动滚底 ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages, typingUser]);

  /* ── 发送 ── */
  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || text.length > 1000 || submittingRef.current) return;
    submittingRef.current = true;
    chat.sendMessage(sessionId, text).finally(() => { submittingRef.current = false; });
    setInputText("");
  }, [inputText, chat, sessionId]);

  /* ── 连接状态 ── */
  useEffect(() => {
    if (sse.connectionState === "reconnecting") {
      setConnBanner("连接已断开，正在重连…");
    } else if (sse.connectionState === "connected") {
      setConnBanner(null); setSseError(null);
    } else if (sse.connectionState === "disconnected" && !statusNote) {
      setConnBanner("连接已断开，请检查网络");
    }
  }, [sse.connectionState, statusNote]);

  /* ── Typing 节流 ── */
  const handleTyping = useCallback(() => {
    const now = Date.now();
    if (now - typingSendRef.current < 2000) return;
    typingSendRef.current = now;
    api.sendTyping(sessionId).catch(() => {});
  }, [sessionId]);

  /* ── 离开 / 举报 ── */
  const handleLeave = useCallback(async () => {
    try { await api.leaveSession(sessionId); } catch {}
    sse.disconnect();
    router.replace(`/summary/${sessionId}`);
  }, [sessionId, sse, router]);

  const handleReport = useCallback(async () => {
    if (reportDone) return;
    if (!window.confirm("确定要举报此对话吗？")) return;
    try { await api.report(sessionId); setReportDone(true); } catch {}
  }, [sessionId, reportDone]);

  /* ── 消息元数据 ── */
  const msgMeta = useMemo(() => {
    const result: Array<{
      msg: Message;
      time: string;
      dateLabel: string | null;
      isMine: boolean;
      isSystem: boolean;
      senderName: string;
    }> = [];
    let prevDay = "";
    for (const msg of chat.messages) {
      const day = new Date(msg.timestamp).toLocaleDateString();
      result.push({
        msg,
        time: fmtTime(msg.timestamp),
        dateLabel: day !== prevDay ? day : null,
        isMine: msg.sender_anonymous_id === myId,
        isSystem: msg.type === "system",
        senderName: msg.sender_anonymous_id === myId ? myName : otherName,
      });
      prevDay = day;
    }
    return result;
  }, [chat.messages, myId, myName, otherName]);

  /* ── 空态 ── */
  if (!session) {
    return (
      <main style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <EmptyState icon="💬" title="无法加载会话" description="会话可能已过期"
          action={{ label: "返回首页", onClick: () => router.push("/") }} />
      </main>
    );
  }

  const bannerText = connBanner || statusNote || sseError;
  const bannerType = connBanner ? "conn" : statusNote ? "warn" : "err";

  return (
    <>
      {/* 氛围光晕 */}
      <div className="chat-atmo" />

      {/* 应用容器 */}
      <div className="chat-app">
        {/* Top bar */}
        <div className="chat-top">
          <button className="back" onClick={handleLeave}>← 离开</button>
          <button className="tgl" onClick={toggleTheme}>
            <span>{theme === "day" ? "☀️" : "🌙"}</span>
            <span>{theme === "day" ? "白天" : "黑夜"}</span>
          </button>
        </div>

        {/* Partner */}
        <div className="chat-partner">
          <div className="av">{headerEmoji}</div>
          <div className="info">
            <div className="name">{otherName}</div>
            <div className="mood">{session.shared_emotion_context}</div>
          </div>
        </div>

        {/* Shared emotion thread */}
        <div className="chat-thread">
          <div className="th-text">{session.shared_emotion_context}</div>
        </div>

        {/* 状态横幅 */}
        {bannerText && (
          <div className={`chat-banner ${bannerType}`}>{bannerText}</div>
        )}

        {/* 消息列表 */}
        <div className="chat-msgs">
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

          {/* 对方正在输入 */}
          {typingUser && (
            <div className="chat-typing">
              <span className="tdots"><span /><span /><span /></span>
              对方正在输入…
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* 输入区 — 胶囊 */}
        <div className="chat-input-zone">
          <div className="chat-input-row">
            <textarea
              value={inputText}
              onChange={(e) => { setInputText(e.target.value); handleTyping(); }}
              placeholder="说点什么…"
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
              className="snd"
              onClick={handleSend}
              disabled={chat.isLoading || !inputText.trim()}
            >
              ↑
            </button>
          </div>
        </div>

        {/* 底部操作 */}
        <div className="chat-actions">
          <button onClick={handleLeave}>离开对话</button>
          <button className="warn" onClick={handleReport} disabled={reportDone}>
            {reportDone ? "✓ 已举报" : "举报"}
          </button>
        </div>
      </div>
    </>
  );
}
