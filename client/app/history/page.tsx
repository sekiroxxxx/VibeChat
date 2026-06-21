"use client";
/** 历史时间线 — 情绪记录 + 聊天记录混排 */
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { EMOTION_COLORS, DEFAULT_EMOTION_COLOR } from "@/constants/emotion-colors";

/* ── 入口类型 ── */
type TlEntry = {
  type: "emotion" | "chat";
  ts: string;          // ISO
  emoji: string;
  /* emotion */
  emotion?: string;
  desc?: string;
  matched?: boolean;
  dur?: string | null;
  msgs?: number;
  session_id?: string;
  chat_session_id?: string;  // emotion→chat 关联
  /* chat */
  partner?: string;
  partnerEmo?: string;
  status?: string;
};

/* ── 格式化 ── */
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* ── 合并 API 数据为时间线 ── */
function buildTimeline(emotionHistory: Record<string, unknown>[], pastSessions: Record<string, unknown>[]): TlEntry[] {
  const entries: TlEntry[] = [];

  for (const e of emotionHistory) {
    const emo = (e.primary_emotion as string) || "";
    const ec = EMOTION_COLORS[emo] ?? DEFAULT_EMOTION_COLOR;
    entries.push({
      type: "emotion",
      ts: (e.timestamp as string) || "",
      emoji: ec.emoji,
      emotion: emo,
      desc: (e.summary as string) || "",
      matched: !!e.matched,
      dur: (e.dur as string) || null,
      msgs: (e.msgs as number) || 0,
      session_id: (e.session_id as string) || "",
      chat_session_id: (e.chat_session_id as string) || "",
    });
  }

  for (const s of pastSessions) {
    const emo = (s.other_emotion as string) || "";
    const ec = EMOTION_COLORS[emo] ?? DEFAULT_EMOTION_COLOR;
    entries.push({
      type: "chat",
      ts: (s.created_at as string) || "",
      emoji: ec.emoji,
      partner: (s.other_name as string) || "匿名",
      partnerEmo: emo,
      msgs: (s.msgs as number) || 0,
      dur: (s.dur as string) || "",
      status: (s.status as string) || "closed",
      session_id: (s.session_id as string) || "",
    });
  }

  entries.sort((a, b) => b.ts.localeCompare(a.ts)); // 倒序
  return entries;
}

/* ══════════════════════════════════════════ */
export default function HistoryPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<TlEntry[]>([]);
  const [filter, setFilter] = useState<"all" | "emotion" | "chat">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"day" | "night">("day");

  /* 初始化主题 */
  useEffect(() => {
    const saved = localStorage.getItem("vb_theme") as "day" | "night" | null;
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("vb_theme", theme);
  }, [theme]);

  /* 加载数据 */
  useEffect(() => {
    api.getMe()
      .then((data) => {
        const eh = (data.emotion_history as Record<string, unknown>[]) || [];
        const ps = (data.past_sessions as Record<string, unknown>[]) || [];
        setEntries(buildTimeline(eh, ps));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(
    () => filter === "all" ? entries : entries.filter((e) => e.type === filter),
    [entries, filter],
  );

  /* ── 渲染 ── */
  return (
    <>
      {/* 顶栏 */}
      <nav className="hist-bar">
        <button
          style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.85rem", color: "var(--accent)" }}
          onClick={() => router.push("/")}
        >
          ← 返回
        </button>
        <span className="logo">VibeChat</span>
        <button className="tgl" onClick={() => setTheme((t) => (t === "day" ? "night" : "day"))}>
          <span>{theme === "day" ? "☀️" : "🌙"}</span>
          <span>{theme === "day" ? "白天" : "黑夜"}</span>
        </button>
      </nav>

      <main className="hist-page">
        <h1>历史</h1>
        <p className="sub">
          你的情绪与对话，<br />在时间里连成一条线。
        </p>

        {/* 筛选芯片 */}
        <div className="filter-chips">
          {(["all", "emotion", "chat"] as const).map((f) => (
            <button
              key={f}
              className={`fchip${filter === f ? " on" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "全部" : f === "emotion" ? "情绪记录" : "对话记录"}
            </button>
          ))}
        </div>

        {/* 加载 / 错误 */}
        {isLoading && <p style={{ textAlign: "center", color: "var(--text3)", padding: "40px 0" }}>加载中…</p>}
        {error && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--error-color)" }}>
            {error}
            <br />
            <button
              onClick={() => window.location.reload()}
              style={{ marginTop: "10px", padding: "6px 16px", borderRadius: "9999px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text2)", cursor: "pointer" }}
            >
              重试
            </button>
          </div>
        )}

        {/* 空态 */}
        {!isLoading && !error && filtered.length === 0 && (
          <div className="tl-empty">
            <span className="ee">📋</span>
            <p className="et">{filter !== "all" ? "该分类暂无记录" : "暂无记录"}</p>
            <p className="ed">
              开始你的第一次情绪探索，<br />这里会慢慢填满你的故事。
            </p>
          </div>
        )}

        {/* 时间线 */}
        {!isLoading && filtered.length > 0 && (
          <div className="timeline">
            {filtered.map((e, i) => {
              const dateStr = fmtDate(e.ts) + " · " + fmtTime(e.ts);
              if (e.type === "emotion") {
                return (
                  <button
                    key={`e-${i}`}
                    className="tl-entry emotion"
                    onClick={() => {
                      if (e.session_id) router.push(`/result?history_id=${e.session_id}`);
                    }}
                  >
                    <div className="tl-date">{dateStr}</div>
                    <div className="tl-head">
                      <span className="tl-emoji">{e.emoji}</span>
                      <span className="tl-title">{e.emotion}</span>
                    </div>
                    <div className="tl-desc">{e.desc}</div>
                    <div className="tl-meta">
                      {e.matched ? (
                        <>
                          <span>🤝 已匹配</span>
                          {e.dur && <span>⏱ {e.dur}</span>}
                          {e.msgs ? <span>💬 {e.msgs} 条</span> : null}
                        </>
                      ) : (
                        <span>🚶 未匹配</span>
                      )}
                    </div>
                  </button>
                );
              }
              /* chat entry */
              return (
                <button
                  key={`c-${i}`}
                  className="tl-entry chat"
                  onClick={() => {
                    if (e.session_id) router.push(`/chat-history/${e.session_id}`);
                  }}
                >
                  <div className="tl-date">{dateStr}</div>
                  <div className="tl-head">
                    <span className="tl-emoji" style={{ fontSize: "1rem" }}>{e.emoji}</span>
                    <span className="tl-partner">与「{e.partner}」的对话</span>
                    <span className={`tl-badge ${e.status}`}>
                      {e.status === "closed" ? "已结束" : "进行中"}
                    </span>
                  </div>
                  <div className="tl-sub">
                    <span className="tl-tag">{e.partnerEmo}</span>
                    <span>{e.msgs} 条消息</span>
                    <span>{e.dur}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
