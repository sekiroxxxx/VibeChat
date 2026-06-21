"""Schema 校验 — 解析器测试"""

from server.lib.schema_validator import parse_llm_output


def test_valid_json():
    result = parse_llm_output('{"primary_emotion":"孤独","intensity":0.7,"valence":-0.4,"emotion_vector":{"孤独":0.8},"interpretation":"解读","match_preferences":{"recommended":[],"avoid":[]},"safety":{"risk_level":"NONE","risk_type":"none","suitable_for_chat":true,"action":"allow_match"}}')
    assert result["parseError"] is False

def test_markdown_wrapped():
    raw = '```json\n{"primary_emotion":"孤独","intensity":0.7,"valence":-0.4,"emotion_vector":{"孤独":0.8},"interpretation":"解读","match_preferences":{"recommended":[],"avoid":[]},"safety":{"risk_level":"NONE","risk_type":"none","suitable_for_chat":true,"action":"allow_match"}}\n```'
    result = parse_llm_output(raw)
    assert result["parseError"] is False

def test_broken_json():
    raw = "not json at all"
    result = parse_llm_output(raw)
    assert result["parseError"] is True
    assert result["raw"] == raw

def test_missing_fields():
    result = parse_llm_output('{"primary_emotion":"孤独"}')
    assert result["parseError"] is True
