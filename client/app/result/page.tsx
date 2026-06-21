"use client";
/** 情绪画像页 (/result) — 情绪卡片 + 匹配模式选择 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sessionStore } from "@/lib/session-store";
import { EMOTION_COLORS, DEFAULT_EMOTION_COLOR } from "@/constants/emotion-colors";
import { EmptyState } from "@/components/shared/EmptyState";
import type { EmotionAnalysis } from "@shared/types";

type MatchMode = "auto" | "guided" | "free";

const MODE_META: Record<MatchMode, { icon: string; label: string; desc: string }> = {
  auto: { icon: "🎯", label: "智能推荐", desc: "AI 帮你一键匹配最合适的人" },
  guided: { icon: "🧭", label: "引导选择", desc: "从推荐方向中选择一个" },
  free: { icon: "🎨", label: "自由选择", desc: "自行指定想匹配的情绪类型" },
};

export default function ResultPage() {
  const [analysis, setAnalysis] = useState<EmotionAnalysis | null>(null);
  const [mode, setMode] = useState<MatchMode>("auto");
  const [targetEmotion, setTargetEmotion] = useState("");
  const router = useRouter();

  useEffect(() => {
    const a = sessionStore.getAnalysis();
    if (!a) { router.replace("/"); return; }
    setAnalysis(a);
  }, [router]);

  if (!analysis) {
    return (
      <main style={st.bg}>
        <EmptyState icon="🔍" title="没有分析结果" description="请先输入你的感受" action={{ label: "返回首页", onClick: () => router.push("/") }} />
      </main>
    );
  }

  const ec = EMOTION_COLORS[analysis.primary_emotion] ?? DEFAULT_EMOTION_COLOR;
  const recommendations = analysis.match_preferences.recommended ?? [];
  const isMedium = analysis.safety.risk_level === "MEDIUM";

  const canMatch =
    (mode === "auto") ||
    (mode === "guided" && targetEmotion !== "") ||
    (mode === "free" && targetEmotion.trim() !== "");

  const handleMatch = () => {
    let finalTarget: string | undefined;
    if (mode === "auto") {
      finalTarget = recommendations[0]?.target_emotion;
    } else if (mode === "guided" || mode === "free") {
      finalTarget = targetEmotion;
    }
    sessionStore.setMatchMode(mode);
    if (finalTarget) sessionStore.setTargetEmotion(finalTarget);
    router.push("/waiting");
  };

  return (
    <main style={st.bg}>
      <div style={st.card}>
        {/* 情绪画像头部 */}
        <div style={st.emotionHeader}>
          <span style={st.emoji}>{ec.emoji}</span>
          <h1 style={{ ...st.emotionName, color: ec.text }}>
            {analysis.primary_emotion}
            {analysis.secondary_emotion && (
              <span style={st.secondary}> · {analysis.secondary_emotion}</span>
            )}
          </h1>
        </div>

        {/* 强度条 */}
        <div style={st.intensityRow}>
          <span style={st.label}>情绪强度</span>
          <div style={st.barBg}>
            <div
              style={{
                ...st.barFill,
                width: `${Math.round(analysis.intensity * 100)}%`,
                backgroundColor: ec.text,
              }}
            />
          </div>
          <span style={st.label}>{Math.round(analysis.intensity * 100)}%</span>
        </div>

        {/* 共情解读 */}
        <p style={st.interpretation}>{analysis.interpretation}</p>

        {/* 关键词 */}
        <div style={st.tags}>
          {analysis.keywords.map((kw) => (
            <span key={kw} style={st.tag}>{kw}</span>
          ))}
        </div>

        {/* 风险提示 */}
        {isMedium && (
          <div style={st.caution}>
            {analysis.safety.caution_message || "请注意：当前情绪状态可能影响交流体验"}
          </div>
        )}

        {/* 匹配模式选择 */}
        <div>
          <h2 style={st.sectionTitle}>选择匹配方式</h2>
          <div className="mode-grid" style={st.modeGrid}>
            {(Object.keys(MODE_META) as MatchMode[]).map((m) => (
              <button
                key={m}
                style={{
                  ...st.modeCard,
                  borderColor: mode === m ? "#7c6ff7" : "#eee",
                  background: mode === m ? "#f8f6ff" : "#fff",
                }}
                onClick={() => {
                  setMode(m);
                  setTargetEmotion("");
                }}
              >
                <span style={st.modeIcon}>{MODE_META[m].icon}</span>
                <span style={st.modeLabel}>{MODE_META[m].label}</span>
                <span style={st.modeDesc}>{MODE_META[m].desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 引导模式：推荐列表 */}
        {mode === "guided" && recommendations.length > 0 && (
          <div style={st.recList}>
            {recommendations.map((rec, i) => (
              <button
                key={i}
                style={{
                  ...st.recItem,
                  borderColor:
                    targetEmotion === rec.target_emotion ? "#7c6ff7" : "#eee",
                }}
                onClick={() => setTargetEmotion(rec.target_emotion)}
              >
                <span style={st.recEmotion}>{rec.target_emotion}</span>
                <span style={st.recReason}>{rec.reason}</span>
              </button>
            ))}
          </div>
        )}

        {/* 自由模式：自定义输入 */}
        {mode === "free" && (
          <input
            style={st.input}
            value={targetEmotion}
            onChange={(e) => setTargetEmotion(e.target.value)}
            placeholder="输入你想匹配的情绪类型，如：平静"
          />
        )}

        <button
          style={{ ...st.matchBtn, opacity: canMatch ? 1 : 0.5 }}
          disabled={!canMatch}
          onClick={handleMatch}
        >
          开始匹配
        </button>
      </div>
    </main>
  );
}

const st: Record<string, React.CSSProperties> = {
  bg: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    background: "linear-gradient(180deg, #f8f7fc, #fefefe)",
    padding: "40px 20px",
  },
  card: {
    width: "100%",
    maxWidth: "560px",
    background: "#fff",
    borderRadius: "20px",
    padding: "36px 28px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  emotionHeader: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
  },
  emoji: { fontSize: "56px" },
  emotionName: { fontSize: "24px", fontWeight: 700 },
  secondary: { fontSize: "16px", fontWeight: 400, opacity: 0.5 },
  intensityRow: { display: "flex", alignItems: "center", gap: "12px" },
  label: { fontSize: "13px", color: "#999", whiteSpace: "nowrap" as const },
  barBg: {
    flex: 1,
    height: "8px",
    borderRadius: "4px",
    background: "#f0f0f0",
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: "4px", transition: "width 0.5s ease" },
  interpretation: {
    fontSize: "15px",
    lineHeight: 1.8,
    color: "#555",
    textAlign: "center",
    padding: "16px",
    background: "#f8f7fc",
    borderRadius: "12px",
  },
  tags: { display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" },
  tag: {
    padding: "4px 12px",
    borderRadius: "20px",
    background: "#f0eeff",
    color: "#7c6ff7",
    fontSize: "13px",
  },
  caution: {
    padding: "12px 16px",
    borderRadius: "10px",
    background: "#fff8e6",
    color: "#b8960c",
    fontSize: "14px",
    textAlign: "center",
  },
  sectionTitle: { fontSize: "16px", fontWeight: 600, color: "#333", marginBottom: "10px" },
  modeGrid: {},
  modeCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    padding: "16px 8px",
    borderRadius: "12px",
    border: "2px solid #eee",
    background: "#fff",
    textAlign: "center",
    transition: "border-color 0.2s, background 0.2s",
  },
  modeIcon: { fontSize: "24px" },
  modeLabel: { fontSize: "14px", fontWeight: 600, color: "#333" },
  modeDesc: { fontSize: "11px", color: "#999", lineHeight: 1.4 },
  recList: { display: "flex", flexDirection: "column", gap: "8px" },
  recItem: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "12px 16px",
    borderRadius: "10px",
    border: "2px solid #eee",
    background: "#fff",
    textAlign: "left",
    transition: "border-color 0.2s",
  },
  recEmotion: { fontSize: "14px", fontWeight: 600, color: "#333" },
  recReason: { fontSize: "12px", color: "#888" },
  input: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: "10px",
    border: "1.5px solid #e0e0e0",
    fontSize: "15px",
    outline: "none",
  },
  matchBtn: {
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
