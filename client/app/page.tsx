"use client";
/** 情绪输入页 (/) — 引导式输入 + 氛围背景 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useEmotionAnalysis } from "@/hooks/useEmotionAnalysis";
import { sessionStore } from "@/lib/session-store";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorBanner } from "@/components/shared/ErrorBanner";

const PLACEHOLDERS = [
  "今天发生了什么让你开心的事？",
  "最近有什么让你感到焦虑的？",
  "现在心里在想什么？想找人说说话吗？",
  "用几句话描述你此刻的感受…",
];

const MAX_LENGTH = 500;

export default function HomePage() {
  const [text, setText] = useState("");
  const [phIdx, setPhIdx] = useState(0);
  const { analyze, isLoading, error } = useEmotionAnalysis();
  const router = useRouter();
  const submittingRef = useRef(false);
  const phTimerRef = useRef<ReturnType<typeof setInterval>>();

  // placeholder 轮换：使用 ref 减少重渲染
  useEffect(() => {
    phTimerRef.current = setInterval(() => {
      setPhIdx((i) => (i + 1) % PLACEHOLDERS.length);
    }, 3000);
    return () => clearInterval(phTimerRef.current);
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > MAX_LENGTH || submittingRef.current) return;
    submittingRef.current = true;
    try {
      const result = await analyze(trimmed);
      if (!result) return;
      if (result.redirect === "care") {
        if (result.analysis) sessionStore.setAnalysis(result.analysis);
        router.push("/care");
        return;
      }
      if (result.analysis) {
        sessionStore.setAnalysis(result.analysis);
        router.push("/result");
      }
    } finally {
      submittingRef.current = false;
    }
  }, [text, analyze, router]);

  const counterColor = useMemo(
    () => text.length > MAX_LENGTH * 0.9 ? "#e74c3c" : "#999",
    [text.length],
  );

  const canSubmit = text.trim().length > 0 && !isLoading && !submittingRef.current;

  return (
    <main style={st.bg}>
      {/* F1 — 顶部导航 */}
      <nav style={st.nav}>
        <a style={st.navLink} href="/history">📋 历史</a>
        <a style={st.navLink} href="/chat-history">💬 聊天记录</a>
      </nav>

      <div style={st.card}>
        <h1 style={st.title}>此刻，你的心情是怎样的？</h1>
        <p style={st.subtitle}>
          写下你的感受，AI 会帮你找到能理解你的人
        </p>
        <textarea
          style={st.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDERS[phIdx]}
          maxLength={MAX_LENGTH}
          rows={5}
          autoFocus
        />
        <div style={st.footer}>
          <span style={{ ...st.counter, color: counterColor }}>
            {text.length}/{MAX_LENGTH}
          </span>
        </div>

        {isLoading && <LoadingSpinner text="正在感受你的情绪…" />}

        {error && <ErrorBanner message={error} onRetry={() => handleSubmit()} />}

        <button
          style={{ ...st.submitBtn, opacity: canSubmit ? 1 : 0.5 }}
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          开始分析
        </button>
      </div>
    </main>
  );
}

const st: Record<string, React.CSSProperties> = {
  nav: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "flex-end",
    gap: "16px",
    padding: "14px 24px",
    zIndex: 10,
  },
  navLink: {
    fontSize: "14px",
    color: "rgba(0,0,0,0.45)",
    textDecoration: "none",
    padding: "4px 12px",
    borderRadius: "8px",
    background: "rgba(255,255,255,0.5)",
    transition: "background 0.2s",
  },
  bg: {
    position: "relative",
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "linear-gradient(135deg, #e8e0f0, #f5e6e0, #e0e8f5, #f0e6f0)",
    backgroundSize: "400% 400%",
    animation: "moodShift 15s ease infinite",
    padding: "20px",
  },
  card: {
    width: "100%",
    maxWidth: "520px",
    background: "rgba(255,255,255,0.88)",
    backdropFilter: "blur(12px)",
    borderRadius: "20px",
    padding: "40px 32px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.07)",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  title: {
    fontSize: "28px",
    fontWeight: 700,
    color: "#2d2d2d",
    textAlign: "center",
    lineHeight: 1.3,
  },
  subtitle: {
    fontSize: "15px",
    color: "#999",
    textAlign: "center",
    marginTop: "-8px",
  },
  textarea: {
    width: "100%",
    padding: "16px",
    borderRadius: "12px",
    border: "1.5px solid #e0e0e0",
    fontSize: "16px",
    lineHeight: 1.7,
    color: "#333",
    background: "#fafafa",
    minHeight: "140px",
    outline: "none",
    resize: "none",
    fontFamily: "inherit",
  },
  footer: { display: "flex", justifyContent: "flex-end" },
  counter: { fontSize: "13px" },
  error: {
    color: "#e74c3c",
    fontSize: "14px",
    textAlign: "center",
    background: "#fdf0ef",
    padding: "10px 12px",
    borderRadius: "10px",
  },
  submitBtn: {
    padding: "14px 32px",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #7c6ff7, #6e5ce6)",
    color: "#fff",
    fontSize: "17px",
    fontWeight: 600,
    width: "100%",
    transition: "opacity 0.2s",
  },
};
