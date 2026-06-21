/** ChatBubble + DateSeparator — 沉浸式气泡（chat + chat-history 复用） */
import React from "react";
import type { Message } from "@shared/types";

/** 格式化 HH:mm */
export function fmtTime(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

/** 日期分隔 — 胶囊 pill */
export const DateSeparator = React.memo(function DateSeparator({ label }: { label: string }) {
  return <div className="cdate-pill">{label}</div>;
});

/** 单条消息气泡 — 沉浸式风格：名字上方 + 非对称圆角 + 时间内置 */
export const ChatBubble = React.memo(function ChatBubble({
  msg,
  time,
  isMine,
  isSystem,
  senderName,
}: {
  msg: Message;
  time: string;
  isMine: boolean;
  isSystem: boolean;
  senderName?: string;
}) {
  if (isSystem) {
    return <div className="cmsg sys">{msg.content}</div>;
  }

  const side = isMine ? "me" : "other";

  return (
    <div className={`cmsg ${side}`}>
      {senderName && <div className="cname">{senderName}</div>}
      <div className="cbubble">
        {msg.content}
        <span className="ctime">{time}</span>
      </div>
    </div>
  );
});
