"use client";
/** 情绪分析 hook — 调 /api/analyze，管理 loading/error 状态 */
import { useState, useCallback } from "react";
import { api } from "@/api/client";
import type { EmotionAnalysis } from "@shared/types";

interface UseEmotionAnalysisReturn {
  analysis: EmotionAnalysis | null;
  anonymousIdentity: string;
  isLoading: boolean;
  error: string | null;
  analyze: (text: string) => Promise<EmotionAnalysis | null>;
  reset: () => void;
}

export function useEmotionAnalysis(): UseEmotionAnalysisReturn {
  const [analysis, setAnalysis] = useState<EmotionAnalysis | null>(null);
  const [anonymousIdentity, setAnonymousIdentity] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(
    async (text: string): Promise<EmotionAnalysis | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.analyze(text);
        setAnalysis(data.analysis);
        setAnonymousIdentity(data.anonymous_identity);
        return data.analysis;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "分析失败，请重试";
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setAnalysis(null);
    setAnonymousIdentity("");
    setError(null);
  }, []);

  return { analysis, anonymousIdentity, isLoading, error, analyze, reset };
}
