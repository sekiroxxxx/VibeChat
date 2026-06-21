/** 情绪-颜色映射 — 所有组件引用此处，不硬编码 */

export const EMOTION_COLORS: Record<string, { bg: string; text: string; emoji: string }> = {
  "喜悦": { bg: "#FFF5E6", text: "#E8850C", emoji: "😊" },
  "悲伤": { bg: "#E8F0FE", text: "#4A6FA5", emoji: "🌧️" },
  "焦虑": { bg: "#FFF0E6", text: "#D4745C", emoji: "😰" },
  "愤怒": { bg: "#FFE8E6", text: "#C44D4D", emoji: "😤" },
  "孤独": { bg: "#F0E6FF", text: "#6B5B9E", emoji: "🌙" },
  "期待": { bg: "#FFF9E6", text: "#B8960C", emoji: "✨" },
  "平静": { bg: "#E6F5EE", text: "#4A8C6F", emoji: "🍃" },
  "疲惫": { bg: "#F5F0E6", text: "#8C7A5E", emoji: "😴" },
  "恐惧": { bg: "#F5E6F0", text: "#8C4A7A", emoji: "😨" },
  "感激": { bg: "#E6FFFA", text: "#4A8C7A", emoji: "💛" },
  "困惑": { bg: "#F0F0E6", text: "#7A8C5E", emoji: "🤔" },
  "释然": { bg: "#E6FAF5", text: "#5A8C7A", emoji: "😌" },
};

export const DEFAULT_EMOTION_COLOR = { bg: "#F5F5F5", text: "#666666", emoji: "💭" };
