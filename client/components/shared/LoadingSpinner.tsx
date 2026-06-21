/** 统一加载动画 — 旋转环 + 可选文案 */
interface LoadingSpinnerProps {
  /** 加载提示文案 */
  text?: string;
  /** 大小 */
  size?: "sm" | "md";
  className?: string;
}

export function LoadingSpinner({ text, size = "md", className = "" }: LoadingSpinnerProps) {
  const dim = size === "sm" ? 20 : 32;
  const borderW = size === "sm" ? 2 : 3;

  return (
    <div style={{ ...st.wrap, gap: size === "sm" ? "8px" : "12px" }} className={className}>
      <div
        style={{
          width: dim,
          height: dim,
          border: `${borderW}px solid #e0e0e0`,
          borderTopColor: "#7c6ff7",
          borderRadius: "50%",
          animation: "spin 0.7s linear infinite",
        }}
      />
      {text && <span style={st.text}>{text}</span>}
    </div>
  );
}

const st: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px",
  },
  text: { fontSize: "14px", color: "#999" },
};
