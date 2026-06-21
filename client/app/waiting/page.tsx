"use client";
/** 匹配等待页 (/waiting) — 浮动气泡 + 中心 orb + flash 消息 + 状态文案 */
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMatch } from "@/hooks/useMatch";
import { useTheme } from "@/hooks/useTheme";
import { sessionStore } from "@/lib/session-store";
import { EMOTION_COLORS } from "@/constants/emotion-colors";
import type { MatchStatus } from "@/hooks/useMatch";

/* ═══════ 常量 ═══════ */
const STATUS_MESSAGES_DAY = [
  "正在寻找和你情绪相近的人…",
  "还有人也在午后写下类似的感受",
  "快了——正在匹配最合适的对话",
  "每个人都有想被理解的时刻",
];
const STATUS_MESSAGES_NIGHT = [
  "正在寻找和你情绪相近的人…",
  "还有人也在深夜写下类似的感受",
  "快了——正在匹配最合适的对话",
  "每个人都有想被理解的时刻",
];

const STATUS_TEXT: Record<MatchStatus, string> = {
  idle: "准备中…",
  queuing: "正在为你寻找匹配…",
  matched: "匹配成功！",
  timeout: "等待超时，没有找到合适的伙伴",
  no_match: "当前没有可匹配的用户",
  error: "匹配服务暂时不可用",
};

const FLASHES = [
  "有人刚刚找到了能懂自己的人 ✨",
  "又有两个人因为相似的感受相遇了",
  "一个气泡消失了——他们匹配成功了",
];

/* bubble 池 — 从情绪常量提取 */
const BUBBLE_POOL = Object.entries(EMOTION_COLORS).map(([emotion, c]) => ({
  emoji: c.emoji,
  label: emotion,
}));

interface BubbleData {
  id: number;
  emoji: string;
  label: string;
  left: string;
  top: string;
  life: number;
  dx: string;
  dy: string;
}

/* ═══════ 组件 ═══════ */
export default function WaitingPage() {
  const router = useRouter();
  const { theme, toggle: toggleTheme } = useTheme();
  const { status, session, queuePosition, error, startMatch, cancelMatch } = useMatch();
  const [statusIdx, setStatusIdx] = useState(0);
  const [bubbles, setBubbles] = useState<BubbleData[]>([]);
  const [flash, setFlash] = useState<{ text: string; visible: boolean }>({ text: "", visible: false });
  const startedRef = useRef(false);
  const bubbleIdRef = useRef(0);
  const bubbleTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const bubbleIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const flashTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const isQueuing = status === "queuing" || status === "idle";
  const showRetry = status === "timeout" || status === "no_match" || status === "error";

  /* ── 发起匹配 ── */
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const mode = sessionStore.getMatchMode() as "auto" | "guided" | "free";
    const target = sessionStore.getTargetEmotion() || undefined;
    startMatch(mode, target);
  }, [startMatch]);

  /* ── 匹配成功 → 跳转 ── */
  useEffect(() => {
    if (status === "matched" && session) {
      sessionStore.setSession(session);
      router.replace(`/chat/${session.session_id}`);
    }
  }, [status, session, router]);

  /* ── 状态文案轮换 ── */
  useEffect(() => {
    const msgs = theme === "day" ? STATUS_MESSAGES_DAY : STATUS_MESSAGES_NIGHT;
    const timer = setInterval(() => {
      setStatusIdx((i) => (i + 1) % msgs.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [theme]);

  /* ── 气泡系统 ── */
  const spawnBubble = useCallback(() => {
    const b = BUBBLE_POOL[Math.floor(Math.random() * BUBBLE_POOL.length)];
    const id = ++bubbleIdRef.current;
    const life = 12 + Math.random() * 10;
    const bubble: BubbleData = {
      id,
      emoji: b.emoji,
      label: b.label,
      left: `${5 + Math.random() * 78}%`,
      top: `${10 + Math.random() * 70}%`,
      life,
      dx: `${(Math.random() - 0.5) * 20}px`,
      dy: `${(Math.random() - 0.5) * 16}px`,
    };
    setBubbles((prev) => {
      const next = [...prev, bubble];
      return next.length > 28 ? next.slice(-24) : next;
    });
    const removeTimer = setTimeout(() => {
      setBubbles((prev) => prev.filter((x) => x.id !== id));
    }, life * 1000 + 300);
    bubbleTimersRef.current.push(removeTimer);
  }, []);

  useEffect(() => {
    // 初始爆发 12 个
    for (let i = 0; i < 12; i++) {
      setTimeout(spawnBubble, i * 280);
    }
    // 持续生成
    bubbleIntervalRef.current = setInterval(spawnBubble, 2000 + Math.random() * 2000);
    return () => {
      clearInterval(bubbleIntervalRef.current);
      bubbleTimersRef.current.forEach(clearTimeout);
    };
  }, [spawnBubble]);

  /* ── Flash 消息 ── */
  useEffect(() => {
    const schedule = () => {
      flashTimerRef.current = setTimeout(() => {
        const msg = FLASHES[Math.floor(Math.random() * FLASHES.length)];
        setFlash({ text: msg, visible: true });
        setTimeout(() => setFlash((f) => ({ ...f, visible: false })), 2200);
        schedule();
      }, 7000 + Math.random() * 9000);
    };
    flashTimerRef.current = setTimeout(schedule, 5000);
    return () => clearTimeout(flashTimerRef.current);
  }, []);

  /* ── 取消 / 重试 ── */
  const handleCancel = useCallback(async () => {
    await cancelMatch();
    router.push("/result");
  }, [cancelMatch, router]);

  const handleRetry = useCallback(() => {
    const mode = sessionStore.getMatchMode() as "auto" | "guided" | "free";
    const target = sessionStore.getTargetEmotion() || undefined;
    startMatch(mode, target);
  }, [startMatch]);

  const statusMsgs = theme === "day" ? STATUS_MESSAGES_DAY : STATUS_MESSAGES_NIGHT;

  return (
    <>
      {/* 导航 */}
      <nav className="nav">
        <span className="logo">VibeChat</span>
        <div className="nav-r">
          {isQueuing ? (
            <button
              className="back-link"
              onClick={handleCancel}
              style={{ fontSize: "0.84rem", color: "var(--text3)", background: "none" }}
            >
              ← 返回
            </button>
          ) : (
            <a href="/result" style={{ fontSize: "0.84rem", color: "var(--text3)", textDecoration: "none" }}>
              ← 返回
            </a>
          )}
          <button className="tgl" onClick={toggleTheme}>
            <span>{theme === "day" ? "☀️" : "🌙"}</span>
            <span>{theme === "day" ? "白天" : "黑夜"}</span>
          </button>
        </div>
      </nav>

      {/* 全屏等待区 */}
      <div className="waiting">
        {/* 浮动气泡层 */}
        <div className="bubbles">
          {bubbles.map((b) => (
            <div
              key={b.id}
              className="bubble"
              style={{
                left: b.left,
                top: b.top,
                "--life": `${b.life}s`,
                "--dx": b.dx,
                "--dy": b.dy,
                background: "var(--accent-s)",
              } as React.CSSProperties}
            >
              <span className="be">{b.emoji}</span>
              {b.label}
            </div>
          ))}
        </div>

        {/* Flash 消息 */}
        <div
          className="flash"
          style={{
            opacity: flash.visible ? 1 : 0,
            transform: flash.visible ? "translate(-50%, -50%) translateY(0)" : "translate(-50%, -50%) translateY(-12px)",
          }}
        >
          {flash.text}
        </div>

        {/* 中心内容 */}
        <div className="center">
          {isQueuing ? (
            <>
              {/* Orb */}
              <div className="orb">
                <div className="glow" />
                <div className="core">💭</div>
                <div className="ring" />
              </div>

              <p className="status">{statusMsgs[statusIdx]}</p>

              {queuePosition !== null && (
                <p className="queue">队列位置：第 {queuePosition + 1} 位</p>
              )}

              <button className="btn-cancel" onClick={handleCancel}>
                取消等待
              </button>
            </>
          ) : showRetry ? (
            <>
              <span className="status-emoji">
                {status === "timeout" ? "⏳" : status === "error" ? "⚠️" : "🔍"}
              </span>
              <p className="status-text">{STATUS_TEXT[status]}</p>
              {error && <p className="error-text">{error}</p>}
              <div className="action-row">
                <button className="btn-retry" onClick={handleRetry}>
                  重试匹配
                </button>
                <button className="btn-back" onClick={() => router.push("/result")}>
                  返回修改
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
