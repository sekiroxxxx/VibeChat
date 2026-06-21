"use client";
/** 首页 (/) — 情绪输入 · 底线式设计 · 日/夜主题 · 快捷chips · 最近记录 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useEmotionAnalysis } from "@/hooks/useEmotionAnalysis";
import { useTheme } from "@/hooks/useTheme";
import { sessionStore } from "@/lib/session-store";
import { api } from "@/api/client";
import { EMOTION_COLORS, DEFAULT_EMOTION_COLOR } from "@/constants/emotion-colors";

/* ═══════ 常量 ═══════ */
const PLACEHOLDERS = [
  "今天过得怎么样？",
  "此刻的心情像什么颜色？",
  "如果用一个词形容现在的你…",
  "最近有什么一直在脑子里转的事吗？",
];

const CHIPS = [
  { emoji: "🌙", label: "深夜孤独", text: "加班到深夜，地铁上一个人都没有，突然觉得好孤独" },
  { emoji: "😰", label: "汇报焦虑", text: "明天要汇报，准备了很久还是睡不着" },
  { emoji: "🍃", label: "周末平静", text: "周末在咖啡馆发呆，好久没这么安静了" },
  { emoji: "🌧️", label: "关系困扰", text: "和朋友吵了一架，不知道还能不能和好" },
];

const MAX_LENGTH = 500;

interface RecentItem {
  key: string;
  emoji: string;
  title: string;
  date: string;
  onClick: () => void;
}

/* ═══════ 组件 ═══════ */
export default function HomePage() {
  const [text, setText] = useState("");
  const [phIdx, setPhIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const { analyze, isLoading, error } = useEmotionAnalysis();
  const { theme, toggle: toggleTheme } = useTheme();
  const router = useRouter();
  const submittingRef = useRef(false);
  const phTimerRef = useRef<ReturnType<typeof setInterval>>();

  /* ── Date ── */
  const todayStr = useMemo(() => {
    return new Date().toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  }, []);

  /* ── Placeholder 轮换 ── */
  useEffect(() => {
    phTimerRef.current = setInterval(() => {
      if (document.activeElement?.tagName !== "TEXTAREA") {
        setPhIdx((i) => (i + 1) % PLACEHOLDERS.length);
      }
    }, 4000);
    return () => clearInterval(phTimerRef.current);
  }, []);

  /* ── 加载最近记录 ── */
  useEffect(() => {
    let cancelled = false;
    api.getMe().then((data) => {
      if (cancelled) return;
      const merged: RecentItem[] = [];

      const history = (data.emotion_history as any[]) || [];
      for (const h of history.slice(0, 3)) {
        const ec = EMOTION_COLORS[h.primary_emotion] ?? DEFAULT_EMOTION_COLOR;
        merged.push({
          key: `emo-${h.session_id || Math.random()}`,
          emoji: ec.emoji,
          title: h.summary || h.feeling || h.primary_emotion || "情绪记录",
          date: h.timestamp ? new Date(h.timestamp).toLocaleDateString("zh-CN", { month: "long", day: "numeric" }) : "",
          onClick: () => h.session_id && router.push(`/result?history_id=${h.session_id}`),
        });
      }

      const sessions = (data.past_sessions as any[]) || [];
      for (const s of sessions.slice(0, 3)) {
        const ec = EMOTION_COLORS[s.other_emotion] ?? DEFAULT_EMOTION_COLOR;
        merged.push({
          key: `chat-${s.session_id}`,
          emoji: "💬",
          title: `与「${s.other_name || "匿名用户"}」的对话`,
          date: s.created_at ? new Date(s.created_at).toLocaleDateString("zh-CN", { month: "long", day: "numeric" }) : "",
          onClick: () => router.push(`/chat-history/${s.session_id}`),
        });
      }

      merged.sort((a, b) => b.date.localeCompare(a.date));
      setRecentItems(merged.slice(0, 5));
    }).catch(() => { /* 静默失败，最近记录非关键 */ });
  }, [router]);

  /* ── 提交 ── */
  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > MAX_LENGTH || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await analyze(trimmed);
      if (!result) return;
      if (result.redirect === "care") {
        if (result.analysis) sessionStore.setAnalysis(result.analysis);
        if (result.anonymousIdentity) sessionStore.setAnonymousIdentity(result.anonymousIdentity);
        router.push("/care");
        return;
      }
      if (result.analysis) {
        sessionStore.setAnalysis(result.analysis);
        if (result.anonymousIdentity) sessionStore.setAnonymousIdentity(result.anonymousIdentity);
        router.push("/result");
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [text, analyze, router]);

  /* ── Chip 点击 ── */
  const handleChip = useCallback((t: string) => {
    setText(t);
    document.querySelector<HTMLTextAreaElement>("#emotion-input")?.focus();
  }, []);

  const counterColor = text.length > MAX_LENGTH * 0.9 ? "var(--error-color)" : "var(--text3)";
  const isBtnLoading = isLoading || submitting;

  return (
    <>
      {/* 氛围光晕 */}
      <div className="atmo" style={{ "--hue": "30" } as React.CSSProperties} />

      {/* 导航 */}
      <nav className="nav">
        <span className="logo">VibeChat</span>
        <div className="nav-r">
          <a href="/history">历史</a>
          <button className="tgl" onClick={toggleTheme}>
            <span>{theme === "day" ? "☀️" : "🌙"}</span>
            <span>{theme === "day" ? "白天" : "黑夜"}</span>
          </button>
        </div>
      </nav>

      <main className="main">
        {/* 日期 */}
        <div className="date">{todayStr}</div>

        {/* Hero */}
        <div className="hero">
          <h1>此刻的你</h1>
          <p>
            写下你的感受，让 AI 帮你理解当下的情绪。
            <br />
            一句话也行，一段话也行。
          </p>
        </div>

        {/* 底线式输入 */}
        <div className="input-area">
          <textarea
            id="emotion-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDERS[phIdx]}
            rows={2}
            maxLength={MAX_LENGTH}
            autoFocus
          />
        </div>

        {/* 操作行：计数 + 按钮 */}
        <div className="actions">
          <span className="hint" style={{ color: counterColor }}>
            {text.length > 0 ? `${text.length}/${MAX_LENGTH}` : ""}
          </span>
          <button
            className={`btn${isBtnLoading ? " loading" : ""}`}
            onClick={handleSubmit}
            disabled={!text.trim() || isBtnLoading}
          >
            {isBtnLoading ? "感受中…" : "开始感受"}
          </button>
        </div>

        {/* 错误提示 */}
        {error && (
          <div style={st.error}>
            <span>{error}</span>
            <button style={st.retryBtn} onClick={handleSubmit}>重试</button>
          </div>
        )}

        {/* 快捷情绪 Chips */}
        <div className="chips">
          {CHIPS.map((chip) => (
            <button key={chip.label} onClick={() => handleChip(chip.text)}>
              {chip.emoji} {chip.label}
            </button>
          ))}
        </div>

        {/* 最近记录 */}
        {recentItems.length > 0 && (
          <div className="recent">
            <span className="rl">最近</span>
            {recentItems.map((item) => (
              <button key={item.key} className="recent-item" onClick={item.onClick}>
                <span className="ri-e">{item.emoji}</span>
                <span className="ri-t">{item.title}</span>
                <span className="ri-s">{item.date}</span>
                <span className="ri-a">→</span>
              </button>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

const st: Record<string, React.CSSProperties> = {
  error: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    borderRadius: "10px",
    background: "var(--error-bg)",
    color: "var(--error-color)",
    fontSize: "13px",
    marginBottom: "20px",
  },
  retryBtn: {
    padding: "4px 12px",
    borderRadius: "6px",
    border: "1px solid var(--error-color)",
    background: "transparent",
    color: "var(--error-color)",
    fontSize: "12px",
    cursor: "pointer",
  },
};
