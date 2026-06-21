"use client";
/** 历史报告列表 (/history) — F3 依赖 B1 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { EmptyState } from "@/components/shared/EmptyState";
import { EMOTION_COLORS, DEFAULT_EMOTION_COLOR } from "@/constants/emotion-colors";
import { shouldMock, MOCK_ME } from "@/lib/mock-data";

interface HistoryItem {
  primary_emotion: string;
  summary?: string;
  feeling?: string;
  session_id?: string;
  timestamp?: string;
}

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [isMock, setIsMock] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const load = () => {
    setIsLoading(true);
    setError(null);

    if (shouldMock()) {
      setIsMock(true);
      setItems((MOCK_ME.emotion_history as unknown as HistoryItem[]) || []);
      setIsLoading(false);
      return;
    }

    api.getMe()
      .then((data) => {
        setItems((data.emotion_history as unknown as HistoryItem[]) || []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <main style={st.bg}>
      <div style={st.card}>
        <div style={st.header}>
          <button style={st.backBtn} onClick={() => router.push("/")}>
            ← 返回
          </button>
          <h1 style={st.title}>📋 历史报告</h1>
          {isMock && <span style={st.mockBadge}>Mock</span>}
        </div>

        {isLoading && <LoadingSpinner text="加载中…" />}
        {error && <ErrorBanner message={error} onRetry={load} />}

        {!isLoading && !error && items.length === 0 && (
          <EmptyState
            icon="📋"
            title="还没有情绪记录"
            description="开始第一次分析，记录你的情绪变化"
            action={{ label: "去记录", onClick: () => router.push("/") }}
          />
        )}

        {!isLoading && items.map((item, i) => {
          const ec = EMOTION_COLORS[item.primary_emotion] ?? DEFAULT_EMOTION_COLOR;
          const date = item.timestamp
            ? new Date(item.timestamp).toLocaleDateString()
            : "";
          return (
            <button
              key={i}
              style={st.item}
              onClick={() => {
                if (item.session_id) {
                  router.push(`/result?history_id=${item.session_id}`);
                }
              }}
            >
              <span style={st.itemEmoji}>{ec.emoji}</span>
              <div style={st.itemText}>
                <span style={st.itemEmotion}>{item.primary_emotion || "未知"}</span>
                <span style={st.itemSummary}>
                  {item.summary || item.feeling || ""}
                </span>
              </div>
              {date && <span style={st.itemDate}>{date}</span>}
            </button>
          );
        })}
      </div>
    </main>
  );
}

const st: Record<string, React.CSSProperties> = {
  bg: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #f8f7fc, #fefefe)",
    padding: "40px 20px",
    display: "flex",
    justifyContent: "center",
  },
  card: {
    width: "100%",
    maxWidth: "560px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "8px",
  },
  backBtn: { fontSize: "14px", color: "#7c6ff7", background: "none", padding: "4px 0" },
  title: { fontSize: "22px", fontWeight: 700, color: "#2d2d2d" },
  item: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "14px 16px",
    background: "#fff",
    borderRadius: "12px",
    border: "1px solid #f0f0f0",
    textAlign: "left",
    cursor: "pointer",
    transition: "box-shadow 0.15s",
  },
  itemEmoji: { fontSize: "28px", flexShrink: 0 },
  itemText: { flex: 1, display: "flex", flexDirection: "column", gap: "3px", overflow: "hidden" },
  itemEmotion: { fontSize: "15px", fontWeight: 600, color: "#333" },
  itemSummary: {
    fontSize: "13px",
    color: "#999",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  itemDate: { fontSize: "12px", color: "#bbb", flexShrink: 0 },
  mockBadge: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#fff",
    background: "#f0a030",
    padding: "2px 8px",
    borderRadius: "4px",
    marginLeft: "8px",
  },
};
