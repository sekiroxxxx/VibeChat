/**
 * SSE 事件类型 — 前后端共享契约
 * 新增事件类型时前后端同步更新
 */

export enum SSEEventType {
  MESSAGE = "message",
  STATUS = "status",
  NOTIFICATION = "notification",
  ERROR = "error",
  HEARTBEAT = "heartbeat",
}

export interface SSEMessageEvent {
  type: SSEEventType.MESSAGE;
  data: {
    id: string;
    session_id: string;
    type: "user" | "system";
    sender_anonymous_id: string;
    content: string;
    timestamp: string;
  };
}

export interface SSEStatusEvent {
  type: SSEEventType.STATUS;
  data: {
    session_id: string;
    status: "active" | "closing" | "closed";
    reason?: string;
  };
}

export interface SSENotificationEvent {
  type: SSEEventType.NOTIFICATION;
  data: {
    level: "info" | "warning";
    content: string;
    dismissible: boolean;
  };
}

export interface SSEErrorEvent {
  type: SSEEventType.ERROR;
  data: {
    message: string;
    code: "SESSION_CLOSED" | "MESSAGE_BLOCKED" | "SERVER_ERROR" | "CONNECTION_LOST";
    retryable: boolean;
  };
}

export type SSEEvent = SSEMessageEvent | SSEStatusEvent | SSENotificationEvent | SSEErrorEvent;
