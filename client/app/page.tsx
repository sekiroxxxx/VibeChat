"use client";
/** 情绪输入页 (/) — 引导式输入 + 氛围背景 */
import { useState, useEffect, useCallback } from "react";
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

  useEffect(() => {
    const timer = setInterval(() => {
      setPhIdx((i) => (i + 1) % PLACEHOLDERS.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > MAX_LENGTH) return;
    const result = await analyze(trimmed);
    if (!result) return;
    if (result.redirect === "care") {
      if (result.analysis) sessionStore.setAnalysis(result.analysis);
      router.push("/care");
      return;
    }
    if (result.analysis) {
      sessionStore.setAnalysis(result.analysis);
      sessionStore.setUserId(sessionStore.getUserId());
      router.push("/result");
    }
  }, [text, analyze, router]);

  const canSubmit = text.trim().length > 0 && !isLoading;

  return (
    <main style={st.bg}>
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
          <span
            style={{
              ...st.counter,
              color: text.length > MAX_LENGTH * 0.9 ? "#e74c3c" : "#999",
            }}
          >
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
  bg: {
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
