"use client";
/** 情绪画像页 (/result) — portrait 卡片 + ghost CTA 匹配 + 历史回顾模式 */
import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { sessionStore } from "@/lib/session-store";
import { api } from "@/api/client";
import { EMOTION_COLORS, DEFAULT_EMOTION_COLOR } from "@/constants/emotion-colors";
import { EmptyState } from "@/components/shared/EmptyState";
import type { EmotionAnalysis } from "@shared/types";

/* ═══════ 情绪→hue 映射 ═══════ */
const EMOTION_HUES: Record<string, number> = {
  "孤独": 280, "焦虑": 50, "平静": 140, "开心": 40, "悲伤": 260,
  "愤怒": 10, "害怕": 240, "期待": 80, "疲惫": 290, "困惑": 200,
};

export default function ResultPage() {
  const [analysis, setAnalysis] = useState<EmotionAnalysis | null>(null);
  const [anonId, setAnonId] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [showFree, setShowFree] = useState(false);
  const [freeText, setFreeText] = useState("");
  /* 历史模式数据 */
  const [histDate, setHistDate] = useState("");
  const [histSessionId, setHistSessionId] = useState("");
  const router = useRouter();

  const historyId = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("history_id")
    : null;
  const isHistory = !!historyId;

  /* ── 加载分析 + 匿名身份 ── */
  useEffect(() => {
    const a = sessionStore.getAnalysis();
    if (!a) { router.replace("/"); return; }
    setAnalysis(a);
    setAnonId(sessionStore.getAnonymousIdentity());
  }, [router, historyId]);

  /* ── 历史模式：加载聊天记录 + 时间 ── */
  useEffect(() => {
    if (!isHistory || !historyId) return;
    let cancelled = false;
    api.getMe().then((data) => {
      if (cancelled) return;
      const history = (data.emotion_history as any[]) || [];
      const match = history.find((h: any) => h.session_id === historyId);
      if (match?.timestamp) {
        const d = new Date(match.timestamp);
        setHistDate(
          d.toLocaleDateString("zh-CN", { month: "long", day: "numeric" })
          + " · " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        );
      }
      const sessions = (data.past_sessions as any[]) || [];
      const sess = sessions.find((s: any) => s.session_id === historyId);
      if (sess) setHistSessionId(sess.session_id);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [isHistory, historyId]);

  /* ── 派生 ── */
  const ec = useMemo(
    () => analysis ? (EMOTION_COLORS[analysis.primary_emotion] ?? DEFAULT_EMOTION_COLOR) : DEFAULT_EMOTION_COLOR,
    [analysis],
  );
  const recs = useMemo(
    () => analysis?.match_preferences?.recommended ?? [],
    [analysis],
  );
  const isMedium = analysis?.safety?.risk_level === "MEDIUM";
  const atmoHue = EMOTION_HUES[analysis?.primary_emotion ?? ""] ?? 30;

  /* ── 匹配 ── */
  const startMatch = useCallback((targetEmotion?: string) => {
    sessionStore.setMatchMode(targetEmotion ? "guided" : "auto");
    if (targetEmotion) sessionStore.setTargetEmotion(targetEmotion);
    router.push("/waiting");
  }, [router]);

  /* ── 空态 ── */
  if (!analysis) {
    return (
      <main className="main" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <EmptyState icon="🔍" title="没有分析结果" description="请先输入你的感受"
          action={{ label: "返回首页", onClick: () => router.push("/") }} />
      </main>
    );
  }

  return (
    <>
      {/* 氛围光晕 — 按情绪类型切换 hue */}
      <div className="atmo" style={{ "--hue": String(atmoHue) } as React.CSSProperties} />

      {/* 导航 */}
      <nav className="nav">
        <span className="logo">VibeChat</span>
        <div className="nav-r">
          <a href={isHistory ? "/history" : "/"}
            style={{ fontSize: "0.84rem", color: "var(--text3)", textDecoration: "none" }}>
            ← 返回
          </a>
        </div>
      </nav>

      <main className="main" style={{ paddingTop: "40px" }}>
        {/* ═══════ Portrait 卡片 ═══════ */}
        <div className="portrait">
          <div className="pglow" />
          <span className="pemoji">{ec.emoji}</span>
          <h2>
            {analysis.primary_emotion}
            {analysis.secondary_emotion && (
              <span className="psub"> · {analysis.secondary_emotion}</span>
            )}
          </h2>
          <p className="pinterp">"{analysis.interpretation}"</p>
          <div className="ptags">
            {analysis.keywords.map((kw) => (
              <span key={kw}>{kw}</span>
            ))}
          </div>

          {/* MEDIUM 温和提示 */}
          {isMedium && (
            <div className="caution-banner">
              {analysis.safety.caution_message || "请注意：当前情绪状态可能影响交流体验"}
            </div>
          )}

          {/* 匿名身份 */}
          {anonId && (
            <div className="pid">
              你的匿名身份 · <strong>{anonId}</strong>
            </div>
          )}
        </div>

        {/* ═══════ 历史模式 ═══════ */}
        {isHistory ? (
          <div className="hist-ctx">
            {histDate && <div className="hdate">{histDate}</div>}
            {histSessionId ? (
              <button className="hist-link" onClick={() => router.push(`/chat-history/${histSessionId}`)}>
                <span className="hl-e">💬</span>
                <span className="hl-t">查看聊天记录</span>
                <span className="hl-s">点击回放对话</span>
                <span className="hl-a">→</span>
              </button>
            ) : (
              <div className="hist-nochat">未进行匹配</div>
            )}
          </div>
        ) : (
          /* ═══════ 匹配区（非历史）═══════ */
          <div className="match-section">
            <p className="guide">想要找到和你感受相似的人吗？</p>

            {/* Ghost CTA — 一键智能匹配 */}
            <div className="btn-ghost-wrap">
              <button className="btn-ghost" onClick={() => startMatch()}>
                ✨ 开始智能匹配
              </button>
              {recs.length > 0 && (
                <div className="btn-ghost-sub">系统已为你找到最佳匹配方向</div>
              )}
            </div>

            {/* 展开：推荐方向 + 自由搜索 */}
            {recs.length > 0 && (
              <>
                <button
                  className={`expand-toggle${expanded ? " open" : ""}`}
                  onClick={() => setExpanded(!expanded)}
                >
                  <span>看看推荐方向</span>
                  <span className="arrow">▾</span>
                </button>
                <div className={`expanded${expanded ? " show" : ""}`}>
                  <div className="expanded-inner">
                    <div className="rec-list">
                      {recs.map((rec, i) => (
                        <button
                          key={i}
                          className="rec-row"
                          onClick={() => startMatch(rec.target_emotion)}
                        >
                          <span className="rr-emoji">🧭</span>
                          <span className="rr-t">{rec.target_emotion}</span>
                          <span className="rr-r">{rec.reason}</span>
                          <span className="rr-go">→</span>
                        </button>
                      ))}
                    </div>

                    {/* 自由搜索 */}
                    {!showFree ? (
                      <div className="free-row">
                        <span className="fr-line" />
                        <button className="fr-link" onClick={() => setShowFree(true)}>
                          🔍 自由搜索情绪类型
                        </button>
                        <span className="fr-line" />
                      </div>
                    ) : (
                      <div className="free-input-row">
                        <input
                          value={freeText}
                          onChange={(e) => setFreeText(e.target.value)}
                          placeholder="输入你想匹配的情绪类型，如：平静"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && freeText.trim()) startMatch(freeText.trim());
                          }}
                        />
                        <button
                          className="btn"
                          style={{ padding: "8px 20px", fontSize: "0.82rem", flexShrink: 0 }}
                          onClick={() => freeText.trim() && startMatch(freeText.trim())}
                          disabled={!freeText.trim()}
                        >
                          匹配
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </>
  );
}
