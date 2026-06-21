/** 统一空状态占位 */
interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({
  icon = "📭",
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div style={st.wrap} className={className}>
      <span style={st.icon}>{icon}</span>
      <h3 style={st.title}>{title}</h3>
      {description && <p style={st.desc}>{description}</p>}
      {action && (
        <button style={st.btn} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

const st: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    padding: "40px 24px",
    textAlign: "center",
  },
  icon: { fontSize: "40px" },
  title: { fontSize: "16px", fontWeight: 600, color: "var(--text2)" },
  desc: { fontSize: "14px", color: "var(--text3)", lineHeight: 1.6 },
  btn: {
    marginTop: "6px",
    padding: "10px 24px",
    borderRadius: "8px",
    background: "var(--accent)",
    color: "var(--btn-text)",
    fontSize: "14px",
    fontWeight: 600,
    border: "none",
    cursor: "pointer",
  },
};
