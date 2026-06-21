/** ChatBubble + DateSeparator — 聊天消息气泡共享组件（chat + chat-history 复用） */
import React from "react";
import type { Message } from "@shared/types";

/** 格式化 HH:mm */
export function fmtTime(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

/** 日期分隔线 */
export const DateSeparator = React.memo(function DateSeparator({ label }: { label: string }) {
  return (
    <div style={st.dateSep}>
      <span style={st.dateSepLine} />
      <span style={st.dateSepText}>{label}</span>
      <span style={st.dateSepLine} />
    </div>
  );
});

/** 单条消息气泡 — memo 避免全列表重渲染 */
export const ChatBubble = React.memo(function ChatBubble({
  msg,
  time,
  isMine,
  isSystem,
}: {
  msg: Message;
  time: string;
  isMine: boolean;
  isSystem: boolean;
}) {
  return (
    <div
      style={{
        ...st.msgRow,
        justifyContent: isSystem ? "center" : isMine ? "flex-end" : "flex-start",
      }}
    >
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMine ? "flex-end" : isSystem ? "center" : "flex-start",
        maxWidth: "80%",
      }}>
        <div
          style={{
            ...st.msgBubble,
            ...(isSystem ? st.systemBubble : isMine ? st.myBubble : st.otherBubble),
          }}
        >
          {msg.content}
        </div>
        <span style={{
          ...st.msgTime,
          textAlign: isSystem ? "center" : isMine ? "right" : "left" as const,
        }}>
          {time}
        </span>
      </div>
    </div>
  );
});

const st: Record<string, React.CSSProperties> = {
  msgRow: {
    display: "flex",
    animation: "fadeInUp 0.3s ease",
  },
  msgBubble: {
    maxWidth: "75%",
    padding: "10px 14px",
    borderRadius: "14px",
    fontSize: "15px",
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  systemBubble: {
    background: "var(--tag-bg)",
    color: "var(--accent)",
    fontSize: "13px",
    maxWidth: "85%",
    textAlign: "center",
  },
  myBubble: {
    background: "var(--accent)",
    color: "var(--btn-text)",
    borderBottomRightRadius: "4px",
  },
  otherBubble: {
    background: "var(--surface)",
    color: "var(--text)",
    borderBottomLeftRadius: "4px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  },
  msgTime: {
    fontSize: "11px",
    color: "var(--text3)",
    marginTop: "3px",
    padding: "0 4px",
  },
  dateSep: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 0",
  },
  dateSepLine: {
    flex: 1,
    height: "1px",
    background: "var(--border)",
  },
  dateSepText: {
    fontSize: "12px",
    color: "var(--text3)",
    whiteSpace: "nowrap",
  },
};
