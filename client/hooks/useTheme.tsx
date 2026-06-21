"use client";
/** 日/夜间主题切换 — CSS 变量驱动，localStorage 持久化 */
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";

type Theme = "day" | "night";

const CTX = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "day",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("day");

  // 初始化：读 localStorage / 系统偏好
  useEffect(() => {
    const stored = localStorage.getItem("vb_theme") as Theme | null;
    const preferred: Theme =
      stored ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "day");
    setTheme(preferred);
    document.documentElement.setAttribute("data-theme", preferred);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "day" ? "night" : "day";
      localStorage.setItem("vb_theme", next);
      document.documentElement.setAttribute("data-theme", next);
      return next;
    });
  }, []);

  return <CTX.Provider value={{ theme, toggle }}>{children}</CTX.Provider>;
}

export function useTheme() {
  return useContext(CTX);
}
