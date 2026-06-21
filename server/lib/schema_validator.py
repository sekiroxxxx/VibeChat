"""
LLM 输出解析器 — 集中式入口
★ 所有 LLM 输出走此函数，不在各节点自写 try-catch
★ 处理三种畸变：markdown 包裹 / JSON 语法错误 / 字段缺失
"""

import json
import re


def parse_llm_output(raw: str) -> dict:
    """
    解析 LLM 原始输出 → 返回结构化结果

    Returns:
        {"parseError": False, "data": {...}}
        {"parseError": True, "raw": "<原始输出>", "error": "..."}
    """
    # Step 1: 剥离 markdown 包裹
    cleaned = raw.strip()
    md_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', cleaned, re.DOTALL)
    if md_match:
        cleaned = md_match.group(1).strip()

    # Step 2: 尝试解析
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        return {"parseError": True, "raw": raw, "error": "JSON decode failed"}

    # Step 3: 必填字段检查
    required = ["primary_emotion", "intensity", "valence", "emotion_vector",
                "interpretation", "match_preferences", "safety"]
    missing = [f for f in required if f not in parsed]
    if missing:
        return {"parseError": True, "raw": raw,
                "error": f"Missing fields: {missing}", "partial": parsed}

    return {"parseError": False, "data": parsed}


def validate_emotion_schema(data: dict) -> None:
    """校验必填字段 — 缺失时抛出 ValueError"""
    required = ["primary_emotion", "intensity", "valence", "emotion_vector"]
    for f in required:
        if f not in data:
            raise ValueError(f"Missing required field: {f}")
