"use client";
/** 关怀页 (/care) — 极端情绪阻断 + 求助资源 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sessionStore } from "@/lib/session-store";
import type { EmotionAnalysis } from "@shared/types";

const DEFAULT_RESOURCES = [
  { name: "全国心理援助热线", phone: "400-161-9995" },
  { name: "北京心理危机研究与干预中心", phone: "010-82951332" },
  { name: "希望 24 热线", phone: "400-161-9995" },
];

export default function CarePage() {
  const [analysis, setAnalysis] = useState<EmotionAnalysis | null>(null);
  const router = useRouter();

  useEffect(() => {
    const a = sessionStore.getAnalysis();
    if (a) setAnalysis(a);
  }, []);

  const resources = analysis?.safety?.resources?.length
    ? analysis.safety.resources.map((r) => ({ name: r, phone: "" }))
    : DEFAULT_RESOURCES;

  return (
    <main style={st.bg}>
      <div style={st.card}>
        <span style={st.emoji}>💙</span>
        <h1 style={st.title}>我们在这里</h1>

        {analysis?.interpretation && (
          <p style={st.interpretation}>{analysis.interpretation}</p>
        )}

        <p style={st.text}>
          你不需要独自面对这一切。以下资源也许能帮到你：
        </p>

        <ul style={st.list}>
          {resources.map((r, i) => (
            <li key={i} style={st.item}>
              <span style={st.itemName}>{r.name}</span>
              {r.phone && <span style={st.itemPhone}>{r.phone}</span>}
            </li>
          ))}
        </ul>

        <button style={st.btn} onClick={() => router.push("/")}>
          返回首页
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
    background: "linear-gradient(135deg, #e8f4fd, #f5edf8)",
    padding: "20px",
  },
  card: {
    width: "100%",
    maxWidth: "480px",
    background: "#fff",
    borderRadius: "20px",
    padding: "40px 32px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.06)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
    textAlign: "center",
  },
  emoji: { fontSize: "56px" },
  title: { fontSize: "24px", fontWeight: 700, color: "#2d2d2d" },
  interpretation: {
    fontSize: "15px",
    color: "#666",
    lineHeight: 1.8,
    background: "#f8f6ff",
    padding: "12px 16px",
    borderRadius: "10px",
    maxWidth: "100%",
  },
  text: { fontSize: "15px", color: "#888" },
  list: {
    listStyle: "none",
    textAlign: "left",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  item: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    background: "#f8f9fa",
    borderRadius: "10px",
  },
  itemName: { fontSize: "14px", fontWeight: 500 },
  itemPhone: { fontSize: "14px", color: "#7c6ff7", fontWeight: 600 },
  btn: {
    marginTop: "8px",
    padding: "12px 36px",
    borderRadius: "10px",
    background: "#7c6ff7",
    color: "#fff",
    fontSize: "16px",
    fontWeight: 600,
  },
};
