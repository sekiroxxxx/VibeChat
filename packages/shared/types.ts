/** VibeChat 共享类型 — 前后端独立引用 */

export interface EmotionAnalysis {
  primary_emotion: string;
  secondary_emotion?: string;
  intensity: number;
  valence: number;
  emotion_vector: Record<string, number>;
  interpretation: string;
  keywords: string[];
  match_preferences: {
    recommended: Array<{ target_emotion: string; reason: string; priority: number }>;
    avoid?: string[];
  };
  safety: {
    risk_level: "NONE" | "MEDIUM" | "HIGH";
    risk_type: "self_harm" | "harm_others" | "crisis" | "none";
    suitable_for_chat: boolean;
    action: "allow_match" | "caution_match" | "show_resources";
    caution_message?: string;
    resources?: string[];
  };
  authenticity: {
    is_genuine_emotion: boolean;
    flags: string[];
    confidence: number;
  };
  emotion_trajectory_hint?: string;
}

export interface Message {
  id: string;
  session_id: string;
  type: "user" | "system";
  sender_anonymous_id: string;
  content: string;
  timestamp: string;
}

export interface UserState {
  user_id: string;
  auth_type: "guest";
  anonymous_identity: string;
  created_at: number;
  queue_entered_at?: number;
  current_emotion?: EmotionAnalysis;
  emotion_history: EmotionAnalysis[];
  match_status: "idle" | "analyzing" | "choosing" | "waiting" | "matched" | "chatting" | "disconnected";
  match_mode?: "auto" | "guided" | "free";
  target_emotion?: string;
  retry_count: number;
  current_session_id?: string;
  account_id: string | null;
}

export interface ChatSession {
  session_id: string;
  user_a: { id: string; anonymous_name: string; emotion: EmotionAnalysis };
  user_b: { id: string; anonymous_name: string; emotion: EmotionAnalysis };
  shared_emotion_context: string;
  opening_message: string;
  messages: Message[];
  status: "active" | "closing" | "closed";
  risk_score: number;
  risk_flags: string[];
  created_at: string;
  closed_at?: string;
}

export interface OpeningMessage {
  opening_message: string;
  for_user_a: string;
  for_user_b: string;
}
