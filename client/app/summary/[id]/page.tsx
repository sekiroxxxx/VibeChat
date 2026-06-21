"use client";
/** 聊天总结页 (/summary/:id) — F6 依赖 B2 */
import { useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/api/client";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { EMOTION_COLORS, DEFAULT_EMOTION_COLOR } from "@/constants/emotion-colors";

export default function SummaryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [step, setStep] = useState<"choose" | "input" | "loading" | "done">("choose");
  const [feeling, setFeeling] = useState("");
  const [summary, setSummary] = useState("");
  const [emotionShift, setEmotionShift] = useState<{ before: string; after_hint: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    const text = feeling.trim();
    if (!text || text.length > 500) return;
    setStep("loading");
    setError(null);
    try {
      const data = await api.summary(id, text);
      setSummary(data.summary);
      setEmotionShift(data.emotion_shift);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
      setStep("input");
    }
  }, [feeling, id]);

  const beforeEmo = EMOTION_COLORS[emotionShift?.before ?? ""] ?? DEFAULT_EMOTION_COLOR;

  return (
    <main style={st.bg}>
      <div style={st.card}>
        <h1 style={st.title}>📝 聊天总结</h1>

        {step === "choose" && (
          <>
            <p style={st.text}>对话已经结束。想为这次聊天生成一份情绪总结吗？</p>
            <div style={st.actions}>
              <button style={st.primaryBtn} onClick={() => setStep("input")}>
                生成总结
              </button>
              <button style={st.secondaryBtn} onClick={() => router.replace("/closed")}>
                跳过
              </button>
            </div>
          </>
        )}

        {step === "input" && (
          <>
            <p style={st.text}>聊完之后，你现在的感受如何？</p>
            <textarea
              style={st.textarea}
              value={feeling}
              onChange={(e) => setFeeling(e.target.value)}
              placeholder="写下你此刻的感受…"
              rows={4}
              maxLength={500}
              autoFocus
            />
            <span style={st.counter}>{feeling.length}/500</span>
            {error && <ErrorBanner message={error} />}
            <div style={st.actions}>
              <button
                style={{ ...st.primaryBtn, opacity: feeling.trim() ? 1 : 0.5 }}
                disabled={!feeling.trim()}
                onClick={handleGenerate}
              >
                生成总结
              </button>
              <button style={st.secondaryBtn} onClick={() => router.replace("/closed")}>
                跳过
              </button>
            </div>
          </>
        )}

        {step === "loading" && <LoadingSpinner text="正在生成总结…" />}

        {step === "done" && (
          <>
            {emotionShift && (
              <div style={st.shiftCard}>
                <span style={st.shiftEmoji}>{beforeEmo.emoji}</span>
                <div>
                  <p style={st.shiftBefore}>聊前：{emotionShift.before}</p>
                  <p style={st.shiftAfter}>现在：{emotionShift.after_hint}</p>
                </div>
              </div>
            )}
            <div style={st.summaryBox}>
              <p style={st.summaryText}>{summary}</p>
            </div>
            <div style={st.actions}>
              <button style={st.primaryBtn} onClick={() => router.push("/history")}>
                查看历史
              </button>
              <button style={st.secondaryBtn} onClick={() => router.push("/")}>
                返回首页
              </button>
            </div>
          </>
        )}
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
    background: "linear-gradient(180deg, #f8f7fc, #fefefe)",
    padding: "20px",
  },
  card: {
    width: "100%",
    maxWidth: "480px",
    background: "#fff",
    borderRadius: "20px",
    padding: "36px 28px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  title: { fontSize: "22px", fontWeight: 700, color: "#2d2d2d", textAlign: "center" },
  text: { fontSize: "15px", color: "#888", textAlign: "center", lineHeight: 1.6 },
  actions: { display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" },
  primaryBtn: {
    padding: "14px 32px",
    borderRadius: "12px",
    background: "#7c6ff7",
    color: "#fff",
    fontSize: "16px",
    fontWeight: 600,
    width: "100%",
  },
  secondaryBtn: {
    padding: "12px 32px",
    borderRadius: "12px",
    background: "#f5f5f5",
    color: "#666",
    fontSize: "15px",
    width: "100%",
  },
  textarea: {
    width: "100%",
    padding: "14px",
    borderRadius: "12px",
    border: "1.5px solid #e0e0e0",
    fontSize: "15px",
    lineHeight: 1.6,
    minHeight: "100px",
    outline: "none",
    resize: "none",
    fontFamily: "inherit",
  },
  counter: { fontSize: "12px", color: "#bbb", textAlign: "right", marginTop: "-8px" },
  shiftCard: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "14px 16px",
    background: "#f8f6ff",
    borderRadius: "12px",
  },
  shiftEmoji: { fontSize: "32px" },
  shiftBefore: { fontSize: "13px", color: "#999" },
  shiftAfter: { fontSize: "15px", fontWeight: 600, color: "#7c6ff7" },
  summaryBox: {
    padding: "18px",
    background: "#fafafa",
    borderRadius: "12px",
    lineHeight: 1.8,
  },
  summaryText: { fontSize: "15px", color: "#444" },
};
