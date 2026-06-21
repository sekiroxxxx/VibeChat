"use client";
/** 会话结束页 (/closed) */
import { useRouter } from "next/navigation";

export default function ClosedPage() {
  const router = useRouter();

  return (
    <main style={st.bg}>
      <div style={st.card}>
        <span style={st.emoji}>👋</span>
        <h1 style={st.title}>会话已结束</h1>
        <p style={st.text}>
          感谢你的真诚交流。
          <br />
          每一次对话都是一次连接。
        </p>

        <div style={st.actions}>
          <button style={st.primaryBtn} onClick={() => router.push("/result")}>
            重新匹配
          </button>
          <button style={st.secondaryBtn} onClick={() => router.push("/")}>
            返回首页
          </button>
        </div>
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
    background: "linear-gradient(135deg, #f8f7fc, #fefefe)",
    padding: "20px",
  },
  card: {
    width: "100%",
    maxWidth: "400px",
    background: "#fff",
    borderRadius: "20px",
    padding: "48px 32px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
    textAlign: "center",
  },
  emoji: { fontSize: "56px" },
  title: { fontSize: "22px", fontWeight: 700, color: "#2d2d2d" },
  text: { fontSize: "15px", color: "#888", lineHeight: 1.8 },
  actions: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    width: "100%",
    marginTop: "12px",
  },
  primaryBtn: {
    padding: "14px 32px",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #7c6ff7, #6e5ce6)",
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
};
