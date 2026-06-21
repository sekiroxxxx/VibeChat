"use client";
/** 关怀页 (/care) — 极端情绪阻断 + 求助资源 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sessionStore } from "@/lib/session-store";
import type { EmotionAnalysis } from "@shared/types";

const DEFAULT_RESOURCES = [
  { name: "全国心理援助热线", phone: "400-161-9995" },
  { name: "希望 24 热线", phone: "400-161-9995" },
  { name: "北京心理危机研究与干预中心", phone: "010-82951332" },
];

export default function CarePage() {
  const [analysis, setAnalysis] = useState<EmotionAnalysis | null>(null);
  const [theme, setTheme] = useState<"day" | "night">("day");
  const router = useRouter();

  useEffect(() => {
    const a = sessionStore.getAnalysis();
    if (a) setAnalysis(a);
    const saved = localStorage.getItem("vb_theme") as "day" | "night" | null;
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("vb_theme", theme);
  }, [theme]);

  const resources = analysis?.safety?.resources?.length
    ? analysis.safety.resources.map((r) => ({ name: r, phone: "" }))
    : DEFAULT_RESOURCES;

  return (
    <>
      <div className="care-atmo" />

      <nav className="nav">
        <span className="logo">VibeChat</span>
        <button className="tgl" onClick={() => setTheme((t) => (t === "day" ? "night" : "day"))} style={{ marginLeft: "auto" }}>
          <span>{theme === "day" ? "☀️" : "🌙"}</span>
          <span>{theme === "day" ? "白天" : "黑夜"}</span>
        </button>
      </nav>

      <main className="care-main">
        <div className="care-hero">
          <span className="ce">🕯️</span>
          <h1>这些感受是重要的</h1>
          <p>
            {analysis?.interpretation
              ? analysis.interpretation
              : "聊天可能不是此刻最适合的方式。\n这里有一些或许能帮到你的资源——"}
          </p>
        </div>

        <div className="care-resources">
          <span className="rl">求助资源</span>
          {resources.map((r, i) => (
            <div key={i} className="care-resource">
              <span className="re">📞</span>
              <span className="rt">{r.name}</span>
              {r.phone && <span className="rp">{r.phone}</span>}
            </div>
          ))}
        </div>

        <p className="care-msg">
          你不需要独自面对这一切。
          <br />
          任何时候你觉得准备好了，<span className="highlight">我们都在这里</span>。
        </p>

        <button className="btn-back" onClick={() => router.push("/")}>
          返回首页
        </button>
      </main>
    </>
  );
}
