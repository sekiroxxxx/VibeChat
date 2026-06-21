"""Mock LLM Provider — 测试不耗 API 费用"""

from server.lib.fallback import EMOTION_FALLBACK_DEFAULT


class MockLLMProvider:
    """返回固定数据 — 用于测试 Schema 校验和降级路径"""

    def __init__(self, response: dict | None = None):
        self.response = response or EMOTION_FALLBACK_DEFAULT

    async def analyze_emotion(self, text: str) -> dict:
        return self.response

    async def generate_opening_message(self, ea, eb, ctx) -> dict:
        return {
            "opening_message": "你们此刻有相似的感受",
            "for_user_a": "说说你的故事吧",
            "for_user_b": "说说你的故事吧"
        }
