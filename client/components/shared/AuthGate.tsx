"use client";
/** 游客认证门 — 确保 vibechat_user cookie 在首次 API 调用前就绪 */
import { useEffect, useRef } from "react";
import { api } from "@/api/client";
import { sessionStore } from "@/lib/session-store";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;

    // 先检查 cookie 是否已有（刷新恢复）
    api.getMe().then((data) => {
      if (data.authenticated && data.user?.user_id) {
        sessionStore.setUserId(data.user.user_id as string);
        return;
      }
      // 创建游客身份
      return api.createGuest().then((guest) => {
        sessionStore.setUserId(guest.user_id);
      });
    }).catch(() => {
      // 创建游客兜底
      api.createGuest().then((guest) => {
        sessionStore.setUserId(guest.user_id);
      }).catch(() => { /* 静默失败，API 层会统一报 401 */ });
    });
  }, []);

  return <>{children}</>;
}
