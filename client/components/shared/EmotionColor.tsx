/** 情绪-颜色包装组件 — 根据情绪名应用背景/文字色 */
import { EMOTION_COLORS, DEFAULT_EMOTION_COLOR } from "@/constants/emotion-colors";

interface EmotionColorProps {
  emotion: string;
  /** bg = 仅背景色, text = 仅文字色, both = 两者（默认） */
  variant?: "bg" | "text" | "both";
  as?: "div" | "span";
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export function EmotionColor({
  emotion,
  variant = "both",
  as: Tag = "div",
  className = "",
  style,
  children,
}: EmotionColorProps) {
  const config = EMOTION_COLORS[emotion] ?? DEFAULT_EMOTION_COLOR;
  const merged: React.CSSProperties = {
    ...(variant === "bg" || variant === "both"
      ? { backgroundColor: config.bg }
      : {}),
    ...(variant === "text" || variant === "both"
      ? { color: config.text }
      : {}),
    ...style,
  };
  return (
    <Tag className={className} style={merged}>
      {children}
    </Tag>
  );
}
