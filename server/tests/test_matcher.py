"""匹配引擎 — 纯函数测试"""

from server.services.matcher import cosine_similarity


def test_identical_vectors():
    vec = {"孤独": 0.8, "平静": 0.2}
    assert cosine_similarity(vec, vec) > 0.99

def test_orthogonal_vectors():
    a = {"喜悦": 1.0, "悲伤": 0.0}
    b = {"悲伤": 1.0, "喜悦": 0.0}
    assert cosine_similarity(a, b) < 0.01

def test_similarity_ceiling_penalty():
    """超高相似应触发降权 — 在 match_user 中处理"""
    vec = {"孤独": 0.99, "平静": 0.01}
    sim = cosine_similarity(vec, vec)
    assert sim > 0.99  # 余弦本身高
    # 降权逻辑在 match_user 中 — 集成测试覆盖

def test_different_dimensions():
    a = {"焦虑": 0.8, "孤独": 0.2}
    b = {"喜悦": 0.8, "期待": 0.2}
    sim = cosine_similarity(a, b)
    assert sim < 0.5
