"use client";
/** 匹配等待页 (/waiting) — 等待动画 + 动态文案 */
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMatch } from "@/hooks/useMatch";
import type { MatchStatus } from "@/hooks/useMatch";

const WAITING_MESSAGES = [
  "正在寻找和你情绪相近的人…",
  "每个人都有自己的故事…",
  "很快就会有答案了…",
  "正在匹配最合适的对话伙伴…",
];

const STATUS_TEXT: Record<MatchStatus, string> = {
  idle: "准备中…",
  queuing: "正在为你寻找匹配…",
  matched: "匹配成功！",
  timeout: "等待超时，没有找到合适的伙伴",
  no_match: "当前没有可匹配的用户",
  error: "匹配服务暂时不可用",
};

export default function WaitingPage() {
  const router = useRouter();
  const { status, session, queuePosition, error, startMatch, cancelMatch } =
    useMatch();
  const [msgIdx, setMsgIdx] = useState(0);
  const startedRef = useRef(false);

  // 轮换等待文案
  useEffect(() => {
    const timer = setInterval(() => {
      setMsgIdx((i) => (i + 1) % WAITING_MESSAGES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // 发起匹配
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const mode = (sessionStorage.getItem("vb_match_mode") || "auto") as
      | "auto"
      | "guided"
      | "free";
    const target = sessionStorage.getItem("vb_target_emotion") || undefined;
    startMatch(mode, target);
  }, [startMatch]);

  // 匹配成功 → 跳转聊天
  useEffect(() => {
    if (status === "matched" && session) {
      sessionStorage.setItem("vb_session", JSON.stringify(session));
      router.replace(`/chat/${session.session_id}`);
    }
  }, [status, session, router]);

  const handleCancel = useCallback(async () => {
    await cancelMatch();
    router.push("/result");
  }, [cancelMatch, router]);

  const handleRetry = useCallback(() => {
    startedRef.current = false;
  }, []);

  const showRetry = status === "timeout" || status === "no_match" || status === "error";

  return (
    <main style={st.bg}>
      <div style={st.card}>
        {status === "queuing" || status === "idle" ? (
          <>
            <div style={st.animation}>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    ...st.dot,
                    animationDelay: `${i * 0.3}s`,
                  }}
                />
              ))}
            </div>
            <p style={st.message}>{WAITING_MESSAGES[msgIdx]}</p>
            {queuePosition !== null && (
              <p style={st.queuePos}>队列位置：第 {queuePosition + 1} 位</p>
            )}
            <button style={st.cancelBtn} onClick={handleCancel}>
              取消匹配
            </button>
          </>
        ) : showRetry ? (
          <>
            <span style={st.statusEmoji}>
              {status === "timeout" ? "⏳" : status === "error" ? "⚠️" : "🔍"}
            </span>
            <p style={st.statusText}>{STATUS_TEXT[status]}</p>
            {error && <p style={st.errorText}>{error}</p>}
            <div style={st.actionRow}>
              <button style={st.retryBtn} onClick={handleRetry}>
                重试匹配
              </button>
              <button style={st.backBtn} onClick={() => router.push("/result")}>
                返回修改
              </button>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}

const st: Record<string, React.CSSProperties> = {
  bg: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)",
    padding: "20px",
  },
  card: {
    width: "100%",
    maxWidth: "440px",
    background: "rgba(255,255,255,0.06)",
    backdropFilter: "blur(16px)",
    borderRadius: "24px",
    padding: "48px 32px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "24px",
    textAlign: "center",
  },
  animation: {
    display: "flex",
    gap: "10px",
    justifyContent: "center",
  },
  dot: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    background: "#7c6ff7",
    animation: "pulse 1.4s ease-in-out infinite",
  },
  message: {
    fontSize: "16px",
    color: "#ccd",
    lineHeight: 1.6,
  },
  queuePos: {
    fontSize: "14px",
    color: "rgba(255,255,255,0.4)",
  },
  cancelBtn: {
    padding: "10px 28px",
    borderRadius: "10px",
    background: "rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.7)",
    fontSize: "14px",
  },
  statusEmoji: { fontSize: "48px" },
  statusText: { fontSize: "16px", color: "#ccd", lineHeight: 1.6 },
  errorText: {
    fontSize: "13px",
    color: "rgba(255,140,140,0.8)",
    background: "rgba(255,0,0,0.1)",
    padding: "8px 14px",
    borderRadius: "8px",
  },
  actionRow: { display: "flex", gap: "12px" },
  retryBtn: {
    padding: "12px 28px",
    borderRadius: "10px",
    background: "#7c6ff7",
    color: "#fff",
    fontSize: "15px",
    fontWeight: 600,
  },
  backBtn: {
    padding: "12px 28px",
    borderRadius: "10px",
    background: "rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.7)",
    fontSize: "15px",
  },
};
