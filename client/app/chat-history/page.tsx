"use client";
/** 聊天记录列表 (/chat-history) — F4 依赖 B1 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { EmptyState } from "@/components/shared/EmptyState";
import { EMOTION_COLORS, DEFAULT_EMOTION_COLOR } from "@/constants/emotion-colors";

interface SessionItem {
  session_id: string;
  other_name: string;
  other_emotion: string;
  created_at: string;
  closed_at?: string;
  status: string;
}

export default function ChatHistoryPage() {
  const [items, setItems] = useState<SessionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const load = () => {
    setIsLoading(true);
    setError(null);
    api.getMe()
      .then((data) => {
        setItems((data.past_sessions as unknown as SessionItem[]) || []);
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
          <h1 style={st.title}>💬 聊天记录</h1>
        </div>

        {isLoading && <LoadingSpinner text="加载中…" />}
        {error && <ErrorBanner message={error} onRetry={load} />}

        {!isLoading && !error && items.length === 0 && (
          <EmptyState
            icon="💬"
            title="还没有聊天记录"
            description="去匹配一个聊伴，开始你的第一次对话"
            action={{ label: "去匹配", onClick: () => router.push("/") }}
          />
        )}

        {!isLoading && items.map((item) => {
          const ec = EMOTION_COLORS[item.other_emotion] ?? DEFAULT_EMOTION_COLOR;
          const date = item.created_at
            ? new Date(item.created_at).toLocaleDateString()
            : "";
          const time = item.created_at
            ? new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "";
          return (
            <button
              key={item.session_id}
              style={st.item}
              onClick={() => router.push(`/chat-history/${item.session_id}`)}
            >
              <span style={st.itemEmoji}>{ec.emoji}</span>
              <div style={st.itemText}>
                <span style={st.itemName}>{item.other_name || "匿名用户"}</span>
                <span style={st.itemSub}>
                  {item.other_emotion || ""}
                  {item.status === "closed" ? " · 已结束" : ""}
                </span>
              </div>
              <div style={st.itemTime}>
                <span style={st.itemDate}>{date}</span>
                <span style={st.itemHour}>{time}</span>
              </div>
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
  itemName: { fontSize: "15px", fontWeight: 600, color: "#333" },
  itemSub: { fontSize: "13px", color: "#999" },
  itemTime: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "2px",
    flexShrink: 0,
  },
  itemDate: { fontSize: "12px", color: "#bbb" },
  itemHour: { fontSize: "11px", color: "#ccc" },
};
