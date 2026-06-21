"use client";
/** 聊天消息 hook — 管理消息列表 + 发送 */
import { useState, useCallback } from "react";
import { api } from "@/api/client";
import type { Message } from "@shared/types";

interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (sessionId: string, content: string) => Promise<boolean>;
  /** SSE 回调用 — 追加对方消息 */
  addMessage: (msg: Message) => void;
  /** 页面初始化用 — 设置历史消息 */
  setMessages: (msgs: Message[]) => void;
}

export function useChat(initialMessages: Message[] = []): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (sessionId: string, content: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.sendMessage(sessionId, content);
        if (data.message) {
          setMessages((prev) => [...prev, data.message]);
        }
        return true;
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
    setMessages((prev) => [...prev, msg]);
  }, []);

  return { messages, isLoading, error, sendMessage, addMessage, setMessages };
}
