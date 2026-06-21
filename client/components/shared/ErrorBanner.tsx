/** 统一错误横幅 — 消息 + 可选重试 */
interface ErrorBannerProps {
  message: string;
  /** 重试回调，不传则不显示按钮 */
  onRetry?: () => void;
  className?: string;
}

export function ErrorBanner({ message, onRetry, className = "" }: ErrorBannerProps) {
  return (
    <div style={st.wrap} className={className}>
      <span style={st.icon}>⚠️</span>
      <span style={st.message}>{message}</span>
      {onRetry && (
        <button style={st.btn} onClick={onRetry}>
          重试
        </button>
      )}
    </div>
  );
}

const st: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 16px",
    borderRadius: "10px",
    background: "#fdf0ef",
    color: "#c0392b",
    fontSize: "14px",
  },
  icon: { fontSize: "16px", flexShrink: 0 },
  message: { flex: 1, lineHeight: 1.4 },
  btn: {
    padding: "6px 14px",
    borderRadius: "6px",
    background: "#c0392b",
    color: "var(--btn-text)",
    fontSize: "12px",
    fontWeight: 600,
    flexShrink: 0,
    border: "none",
    cursor: "pointer",
  },
};
