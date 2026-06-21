"use client";
/** 匹配 hook — 调 /api/match，管理入队/匹配/超时/取消 */
import { useState, useCallback, useRef } from "react";
import { api } from "@/api/client";
import type { ChatSession } from "@shared/types";

export type MatchStatus =
  | "idle"
  | "queuing"
  | "matched"
  | "timeout"
  | "no_match"
  | "error";

interface UseMatchReturn {
  status: MatchStatus;
  session: ChatSession | null;
  queuePosition: number | null;
  error: string | null;
  startMatch: (
    mode: "auto" | "guided" | "free",
    target?: string,
  ) => Promise<void>;
  cancelMatch: () => Promise<void>;
  reset: () => void;
}

export function useMatch(): UseMatchReturn {
  const [status, setStatus] = useState<MatchStatus>("idle");
  const [session, setSession] = useState<ChatSession | null>(null);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startMatch = useCallback(
    async (mode: "auto" | "guided" | "free", target?: string) => {
      setStatus("queuing");
      setError(null);
      abortRef.current = new AbortController();

      try {
        const data = await api.match(mode, target);

        if (data.matched && data.session) {
          setSession(data.session);
          setStatus("matched");
        } else if (data.fallback) {
          const reason =
            data.fallback.reason === "timeout" ? "timeout" : "no_match";
          setStatus(reason);
        } else if (data.queue_position !== undefined) {
          setQueuePosition(data.queue_position);
          setStatus("queuing");
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        const msg = e instanceof Error ? e.message : "匹配请求失败";
        setError(msg);
        setStatus("error");
      }
    },
    [],
  );

  const cancelMatch = useCallback(async () => {
    abortRef.current?.abort();
    try {
      await api.cancelMatch();
    } catch {
      /* 忽略取消失败 — 服务端有超时兜底 */
    }
    setStatus("idle");
    setQueuePosition(null);
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setSession(null);
    setQueuePosition(null);
    setError(null);
  }, []);

  return { status, session, queuePosition, error, startMatch, cancelMatch, reset };
}
