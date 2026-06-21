/** 统一图标组件 — 情绪emoji + 自定义emoji */
import { EMOTION_COLORS, DEFAULT_EMOTION_COLOR } from "@/constants/emotion-colors";

const SIZE_CLASS = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-4xl",
} as const;

interface IconProps {
  /** 情绪名称（中文）或 emoji 本身 */
  name: string;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}

export function Icon({ name, size = "md", className = "" }: IconProps) {
  const config = EMOTION_COLORS[name] ?? DEFAULT_EMOTION_COLOR;
  return (
    <span
      className={`inline-block ${SIZE_CLASS[size]} ${className}`}
      role="img"
      aria-label={name}
    >
      {config.emoji}
    </span>
  );
}

/** 直接渲染任意 emoji 的轻量版 */
export function Emoji({
  char,
  label,
  size = "md",
  className = "",
}: {
  char: string;
  label: string;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  return (
    <span
      className={`inline-block ${SIZE_CLASS[size]} ${className}`}
      role="img"
      aria-label={label}
    >
      {char}
    </span>
  );
}
