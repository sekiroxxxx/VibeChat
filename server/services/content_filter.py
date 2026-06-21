"""
内容安全扫描 — 纯规则引擎
★ 只匹配明确模式，不依赖 LLM，保证低延迟和确定性
"""

import re

CONTENT_RULES = [
    {
        "pattern": r"1[3-9]\d{9}",
        "flag": "phone_number",
        "replace": "⚠️ 为保护双方隐私，此消息未发送。请保持在对话中交流。"
    },
    {
        "pattern": r"(微信|wechat|QQ|qq|Telegram|WhatsApp|Line)\s*[:：]?\s*\w+",
        "flag": "social_account",
        "replace": "⚠️ 为保护双方隐私，此消息未发送。请保持在对话中交流。"
    },
    {
        "pattern": r"https?://\S+",
        "flag": "url",
        "replace": "⚠️ 为保护双方隐私，链接已隐藏。请保持在对话中交流。"
    },
    {
        "pattern": r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
        "flag": "email",
        "replace": "⚠️ 为保护双方隐私，此消息未发送。请保持在对话中交流。"
    },
]


def scan(content: str) -> list[dict]:
    """扫描消息内容 → 返回命中的规则列表"""
    hits = []
    for rule in CONTENT_RULES:
        if re.search(rule["pattern"], content):
            hits.append({"flag": rule["flag"], "replace": rule["replace"]})
    return hits


def filter_message(content: str) -> dict:
    """
    过滤消息 → 返回 {blocked: bool, content: str, flags: []}
    blocked=True 时 content 是拦截提示文本
    """
    hits = scan(content)
    if hits:
        return {
            "blocked": True,
            "content": hits[0]["replace"],
            "flags": [h["flag"] for h in hits]
        }
    return {"blocked": False, "content": content, "flags": []}
