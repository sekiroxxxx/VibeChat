"use client";
/** 情绪分析 hook — 调 /api/analyze，管理 loading/error/redirect */
import { useState, useCallback } from "react";
import { api } from "@/api/client";
import type { EmotionAnalysis } from "@shared/types";

export interface AnalyzeResult {
  /** 分析结果 — redirect 时为空 */
  analysis: EmotionAnalysis | null;
  anonymousIdentity: string;
  /** 'care' = HIGH 风险阻断；null = 正常 */
  redirect: "care" | null;
  isFallback: boolean;
}

interface UseEmotionAnalysisReturn {
  analysis: EmotionAnalysis | null;
  anonymousIdentity: string;
  isLoading: boolean;
  error: string | null;
  analyze: (text: string) => Promise<AnalyzeResult | null>;
  reset: () => void;
}

export function useEmotionAnalysis(): UseEmotionAnalysisReturn {
  const [analysis, setAnalysis] = useState<EmotionAnalysis | null>(null);
  const [anonymousIdentity, setAnonymousIdentity] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(
    async (text: string): Promise<AnalyzeResult | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.analyze(text);

        // HIGH 风险：server 返回 {redirect: "care", safety: ...} 无 analysis
        if (data.redirect) {
          const partial = data.safety
            ? ({ safety: data.safety } as unknown as EmotionAnalysis)
            : null;
          setAnalysis(partial);
          return {
            analysis: partial,
            anonymousIdentity: "",
            redirect: "care",
            isFallback: false,
          };
        }

        const analysis = (data.analysis ?? null) as EmotionAnalysis | null;
        const identity = (data.anonymous_identity ?? "") as string;
        setAnalysis(analysis);
        setAnonymousIdentity(identity);
        return {
          analysis,
          anonymousIdentity: identity,
          redirect: null,
          isFallback: (data.is_fallback ?? false) as boolean,
        };
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
