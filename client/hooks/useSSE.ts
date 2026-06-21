"use client";
/** SSE hook — EventSource 连接 + 指数退避重连 + 僵死检测 + 心跳 + TYPING */
import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "@/api/client";
import { SSEEventType } from "@shared/sse-events";
import type { SSEStatusEvent, SSETypingEvent } from "@shared/sse-events";
import type { Message } from "@shared/types";

const MAX_RECONNECT = 3;
const BASE_RECONNECT_DELAY = 1_000;  // 指数退避起点
const DEAD_TIMEOUT = 10_000;

export type ConnectionState = "connected" | "reconnecting" | "disconnected";

type SSECallbacks = {
  onMessage?: (msg: Message) => void;
  onStatus?: (data: SSEStatusEvent["data"]) => void;
  onError?: (msg: string, retryable: boolean) => void;
  /** F4 — 对方正在输入 */
  onTyping?: (data: SSETypingEvent["data"]) => void;
};

interface UseSSEReturn {
  isConnected: boolean;
  connectionState: ConnectionState;
  connect: (sessionId: string, callbacks: SSECallbacks) => void;
  disconnect: () => void;
}

export function useSSE(): UseSSEReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const esRef = useRef<EventSource | null>(null);
  const reconnectCountRef = useRef(0);
  const deadTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const callbacksRef = useRef<SSECallbacks>({});
  const stoppedRef = useRef(false);

  const resetDeadTimer = useCallback(() => {
    clearTimeout(deadTimerRef.current);
    deadTimerRef.current = setTimeout(() => {
      // 僵死 → 关闭触发 onerror 重连
      esRef.current?.close();
    }, DEAD_TIMEOUT);
  }, []);

  const connect = useCallback(
    (sessionId: string, callbacks: SSECallbacks) => {
      callbacksRef.current = callbacks;
      stoppedRef.current = false;

      const url = api.getStreamUrl(sessionId);
      const es = new EventSource(url, { withCredentials: true });
      esRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
        setConnectionState("connected");
        reconnectCountRef.current = 0;
        resetDeadTimer();
      };

      es.addEventListener(SSEEventType.MESSAGE, (e: MessageEvent) => {
        resetDeadTimer();
        try {
          const msg = JSON.parse(e.data);
          callbacksRef.current.onMessage?.(msg);
        } catch {
          /* 跳过畸形消息 */
        }
      });

      es.addEventListener(SSEEventType.STATUS, (e: MessageEvent) => {
        resetDeadTimer();
        try {
          const status = JSON.parse(e.data);
          callbacksRef.current.onStatus?.(status);
        } catch {
          /* 跳过 */
        }
      });

      /* F4 — 对方输入指示 */
      es.addEventListener(SSEEventType.TYPING, (e: MessageEvent) => {
        resetDeadTimer();
        try {
          const data = JSON.parse(e.data); // {session_id, sender_anonymous_id}
          callbacksRef.current.onTyping?.(data);
        } catch {
          /* 跳过 */
        }
      });

      es.addEventListener(SSEEventType.HEARTBEAT, () => {
        resetDeadTimer();
      });

      es.addEventListener(SSEEventType.ERROR, (e: MessageEvent) => {
        try {
          const err = JSON.parse(e.data);
          callbacksRef.current.onError?.(err.message, err.retryable);
        } catch {
          callbacksRef.current.onError?.("收到服务端错误", false);
        }
      });

      es.onerror = () => {
        setIsConnected(false);
        clearTimeout(deadTimerRef.current);
        es.close();

        if (stoppedRef.current) return;

        if (reconnectCountRef.current < MAX_RECONNECT) {
          reconnectCountRef.current++;
          setConnectionState("reconnecting");
          const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectCountRef.current - 1);
          setTimeout(() => {
            if (!stoppedRef.current) {
              connect(sessionId, callbacksRef.current);
            }
          }, delay);
        } else {
          setConnectionState("disconnected");
          callbacksRef.current.onError?.("连接已断开，请刷新页面", false);
        }
      };
    },
    [resetDeadTimer],
  );

  const disconnect = useCallback(() => {
    stoppedRef.current = true;
    clearTimeout(deadTimerRef.current);
    esRef.current?.close();
    esRef.current = null;
    setIsConnected(false);
    setConnectionState("disconnected");
    reconnectCountRef.current = 0;
  }, []);

  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      clearTimeout(deadTimerRef.current);
      esRef.current?.close();
    };
  }, []);

  return { isConnected, connectionState, connect, disconnect };
}
