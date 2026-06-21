"use client";
/** 聊天总结页 (/summary/:id) — 原型复刻 */
import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/api/client";
import { EMOTION_COLORS, DEFAULT_EMOTION_COLOR } from "@/constants/emotion-colors";

interface RecapInfo {
  entering_emotion: string;
  entering_emoji: string;
  partner_name: string;
  partner_emotion: string;
  partner_emoji: string;
  message_count: number;
  duration: string;
}

export default function SummaryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [step, setStep] = useState<"input" | "loading" | "done">("input");
  const [feeling, setFeeling] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"day" | "night">("day");
  const [recap, setRecap] = useState<RecapInfo | null>(null);
  const [report, setReport] = useState<{
    summary: string;
    blocks: { emotion_start: string; conversation: string; emotion_change: string };
    emotion_shift: { before: string; after_hint: string };
  } | null>(null);

  /* 加载会话 recap 信息 */
  useEffect(() => {
    const saved = localStorage.getItem("vb_theme") as "day" | "night" | null;
    if (saved) setTheme(saved);

    api.get<{ session: Record<string, unknown> }>(`/api/sessions/${id}`)
      .then((data) => {
        const s = data.session;
        const userA = (s.user_a as Record<string, unknown>) || {};
        const userB = (s.user_b as Record<string, unknown>) || {};
        const emoA = (userA.emotion as Record<string, string>) || {};
        const emoB = (userB.emotion as Record<string, string>) || {};
        const ecA = EMOTION_COLORS[emoA.primary_emotion] ?? DEFAULT_EMOTION_COLOR;
        const ecB = EMOTION_COLORS[emoB.primary_emotion] ?? DEFAULT_EMOTION_COLOR;
        const msgs = ((s.messages as unknown[]) || []).filter(
          (m: unknown) => (m as Record<string, unknown>).type === "user",
        );
        setRecap({
          entering_emotion: emoA.primary_emotion || "",
          entering_emoji: ecA.emoji,
          partner_name: (userB.anonymous_name as string) || "",
          partner_emotion: emoB.primary_emotion || "",
          partner_emoji: ecB.emoji,
          message_count: msgs.length,
          duration: `${Math.max(1, Math.round(msgs.length * 1.2))} 分钟`,
        });
      })
      .catch(() => { /* recap 非关键，静默失败 */ });
  }, [id]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("vb_theme", theme);
  }, [theme]);

  const handleGenerate = useCallback(async () => {
    const text = feeling.trim() || "感觉轻松了一些，谢谢有个人愿意听。";
    setStep("loading");
    setError(null);
    try {
      const data = await api.summary(id, text);
      const b = (data.blocks || {}) as { emotion_start?: string; conversation?: string; emotion_change?: string };
      const es = (data.emotion_shift || {}) as { before?: string; after_hint?: string };
      setReport({
        summary: (data.summary as string) || "",
        blocks: {
          emotion_start: b.emotion_start || `你进入对话时感到「${recap?.entering_emotion || "..."}」。`,
          conversation: b.conversation || `与「${recap?.partner_name || "..."}」进行了对话。`,
          emotion_change: b.emotion_change || `从「${recap?.entering_emotion || "..."}」到「${es.after_hint || "释然"}」。`,
        },
        emotion_shift: es as { before: string; after_hint: string },
      });
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
      setStep("input");
    }
  }, [feeling, id, recap]);

  return (
    <>
      <div className="atmo" />
      <nav className="nav">
        <span className="logo">VibeChat</span>
        <button className="tgl" onClick={() => setTheme((t) => (t === "day" ? "night" : "day"))} style={{ marginLeft: "auto" }}>
          <span>{theme === "day" ? "☀️" : "🌙"}</span>
          <span>{theme === "day" ? "白天" : "黑夜"}</span>
        </button>
      </nav>

      <main className="sum-main">
        {/* Hero */}
        <div className="hero" style={{ marginBottom: "36px" }}>
          <span className="he" style={{ fontSize: "2.8rem", display: "block", marginBottom: "8px" }}>🍃</span>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "6px", color: "var(--text)" }}>
            这段对话结束了
          </h1>
          <p style={{ fontSize: "0.92rem", color: "var(--text2)", lineHeight: 1.7 }}>
            你想记录下这次聊天的感受吗？<br />
            几句话就好——它会和对话一起，生成一份属于你的情绪总结。
          </p>
        </div>

        {/* Recap */}
        {recap && (
          <div className="sum-recap">
            <span className="rl">对话概要</span>
            <div className="sum-recap-row">
              <span className="rre">{recap.entering_emoji}</span>
              <span>进入时感到「{recap.entering_emotion}」</span>
            </div>
            <div className="sum-recap-row">
              <span className="rre">💬</span>
              <span>与「{recap.partner_name}」聊了 {recap.duration} · {recap.message_count} 条消息</span>
            </div>
          </div>
        )}

        {/* Input + Actions (before generate) */}
        {step !== "done" && (
          <>
            <div className="sum-input" style={step === "loading" ? { opacity: 0.4, pointerEvents: "none" } : undefined}>
              <label>这次聊天给你的感受是？</label>
              <textarea
                value={feeling}
                onChange={(e) => setFeeling(e.target.value)}
                placeholder="比如：一开始有点紧张，但聊着聊着就放松了。或者你从对方那里感受到了什么…"
                rows={2}
                maxLength={500}
                autoFocus
              />
            </div>

            {error && (
              <p style={{ color: "var(--error-color)", fontSize: "0.85rem", marginBottom: "12px" }}>{error}</p>
            )}

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                className="btn"
                onClick={handleGenerate}
                disabled={step === "loading"}
                style={step === "loading" ? { opacity: 0.6 } : undefined}
              >
                {step === "loading" ? "生成中…" : "生成总结"}
              </button>
              <button
                className="btn-ghost"
                onClick={() => router.replace("/closed")}
                style={{
                  padding: "9px 22px", borderRadius: "9999px",
                  border: "1px solid var(--border)", background: "transparent",
                  color: "var(--text3)", fontSize: "0.86rem",
                  fontFamily: "inherit", cursor: "pointer",
                }}
              >
                跳过
              </button>
            </div>
          </>
        )}

        {/* Report (after generate) */}
        {step === "done" && report && (
          <div className="sum-report" style={{ display: "block" }}>
            <h3>📋 情绪总结报告</h3>

            <div className="sum-block">
              <h4>情绪起点</h4>
              <p>{report.blocks.emotion_start}</p>
            </div>

            <div className="sum-block">
              <h4>对话过程</h4>
              <p>{report.blocks.conversation}</p>
            </div>

            <div className="sum-block">
              <h4>你的感受</h4>
              <p>"{feeling || '感觉轻松了一些，谢谢有个人愿意听。'}"</p>
            </div>

            <div className="sum-block">
              <h4>情绪变化</h4>
              <p>{report.blocks.emotion_change}</p>
            </div>

            <button className="btn" style={{ marginTop: "12px" }} onClick={() => router.push("/history")}>
              查看历史
            </button>
          </div>
        )}
      </main>
    </>
  );
}
