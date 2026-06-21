"use client";
/** 浏览器通知 + 未读计数 + title 徽标 */
import { useEffect, useRef, useState, useCallback } from "react";

const TITLE_BASE = "VibeChat";

export function useNotification() {
  const [unreadCount, setUnreadCount] = useState(0);
  const permissionRef = useRef<NotificationPermission>("default");

  /* 请求通知权限 */
  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    permissionRef.current = result;
  }, []);

  /* 收到新消息时调用 */
  const notify = useCallback((title: string, body: string) => {
    setUnreadCount((c) => {
      const next = c + 1;
      if (document.hidden && permissionRef.current === "granted") {
        new Notification(title, { body, icon: "💬" });
      }
      if (document.hidden) {
        document.title = `(${next}) ${TITLE_BASE}`;
      }
      return next;
    });
  }, []);

  /* 页面恢复可见时清零 */
  const resetUnread = useCallback(() => {
    setUnreadCount(0);
    document.title = TITLE_BASE;
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (!document.hidden) resetUnread();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [resetUnread]);

  return { unreadCount, requestPermission, notify, resetUnread };
}
