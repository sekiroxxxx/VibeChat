"use client";
/** 聊天消息 hook — 管理消息列表 + 发送 */
import { useState, useCallback, useRef } from "react";
import { api } from "@/api/client";
import type { Message } from "@shared/types";

interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  /** 发送消息 → 只校验成功/失败，不更新 state（SSE 统一推送） */
  sendMessage: (sessionId: string, content: string) => Promise<boolean>;
  /** SSE 回调 — 追加新消息（含去重） */
  addMessage: (msg: Message) => void;
  /** 页面初始化 — 设置历史消息 */
  setMessages: (msgs: Message[]) => void;
}

export function useChat(initialMessages: Message[] = []): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seenIds = useRef<Set<string>>(new Set(initialMessages.map((m) => m.id)));

  const sendMessage = useCallback(
    async (sessionId: string, content: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.sendMessage(sessionId, content);
        // 消息由 SSE 统一推送给双方 — 此处不更新 state，避免重复
        if (data.blocked) {
          setError("消息未能发送：包含不合适的內容");
          return false;
        }
        return data.sent !== false;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "发送失败";
        setError(msg);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const addMessage = useCallback((msg: Message) => {
    if (seenIds.current.has(msg.id)) return; // 去重
    seenIds.current.add(msg.id);
    setMessages((prev) => [...prev, msg]);
  }, []);

  const setMessagesAndTrack = useCallback((msgs: Message[]) => {
    seenIds.current = new Set(msgs.map((m) => m.id));
    setMessages(msgs);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    addMessage,
    setMessages: setMessagesAndTrack,
  };
}
