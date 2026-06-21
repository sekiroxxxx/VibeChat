"""
降级默认值 — LLM 调用完全失败且重试无效时使用
★ 中性情绪 · 可匹配任何人 · 前端展示温和提示
"""

EMOTION_FALLBACK_DEFAULT = {
    "primary_emotion": "平静",
    "secondary_emotion": None,
    "intensity": 0.5,
    "valence": 0.0,
    "emotion_vector": {
        "喜悦": 0.0, "悲伤": 0.0, "焦虑": 0.0, "愤怒": 0.0,
        "孤独": 0.0, "期待": 0.0, "平静": 1.0, "疲惫": 0.0,
        "恐惧": 0.0, "感激": 0.0, "困惑": 0.0, "释然": 0.0
    },
    "interpretation": "我们正在理解你的情绪，这是我们的最佳猜测 ✨",
    "keywords": ["平静"],
    "match_preferences": {
        "recommended": [{
            "target_emotion": "任何情绪",
            "reason": "此刻的陪伴比精准匹配更重要",
            "priority": 1
        }],
        "avoid": []
    },
    "safety": {
        "risk_level": "NONE",
        "risk_type": "none",
        "suitable_for_chat": True,
        "action": "allow_match"
    },
    "authenticity": {
        "is_genuine_emotion": True,
        "flags": [],
        "confidence": 0.5
    }
}
