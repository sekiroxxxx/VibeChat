"""
LLM Provider 抽象层
★ 决策 2：接口隔离 — v1 定义接口，OpenAI/Anthropic 两个实现
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class LLMConfig:
    provider: str          # "openai" | "anthropic"
    api_key: str
    model: str
    base_url: str

    # 采样参数 — 与 Prompt 同置在 AgentProfile 中
    temperature: float = 0.3
    max_tokens: int = 1024


class EmotionAnalysisError(Exception):
    """情绪分析失败 — 调用方据此决定降级策略"""
    def __init__(self, message: str, retryable: bool = True):
        self.message = message
        self.retryable = retryable


class LLMProvider(ABC):
    """LLM 供应商抽象接口"""

    @abstractmethod
    async def analyze_emotion(self, text: str) -> dict:
        """
        分析用户输入文字的情绪
        input:  用户原始文字
        output: 结构化 dict（EmotionAnalysis JSON）
        raises: EmotionAnalysisError
        """
        ...

    @abstractmethod
    async def generate_opening_message(
        self,
        emotion_a: dict,
        emotion_b: dict,
        shared_context: str
    ) -> dict:
        """生成对话开场白 → OpeningMessage JSON"""
        ...

    @abstractmethod
    async def generate_chat_summary(
        self,
        messages: list[dict],
        feeling: str,
        emotion_before: dict,
    ) -> dict:
        """生成聊天总结 → {summary, emotion_shift} JSON"""
        ...


def create_llm_provider(config: LLMConfig) -> LLMProvider:
    """
    工厂函数 — 根据环境变量 LLM_PROVIDER 创建对应实现
    "openai"   → OpenAIProvider
    "anthropic" → AnthropicProvider
    """
    if config.provider == "anthropic":
        from server.lib.anthropic_provider import AnthropicProvider
        return AnthropicProvider(config)

    from server.lib.openai_provider import OpenAIProvider
    return OpenAIProvider(config)


# ── 降级处理 ──

async def analyze_with_fallback(provider: LLMProvider, text: str) -> tuple[dict, bool]:
    """
    调用 LLM → schema 校验 → 重试一次 → 仍失败返回默认情绪

    Returns:
        (emotion_dict, is_fallback) — is_fallback=True 表示使用了降级值
    """
    from server.lib.schema_validator import parse_llm_output
    from server.lib.fallback import EMOTION_FALLBACK_DEFAULT

    for attempt in range(2):
        try:
            raw = await provider.analyze_emotion(text)
        except EmotionAnalysisError:
            continue

        parsed = parse_llm_output(raw)
        if not parsed.get("parseError"):
            return parsed["data"], False

    return EMOTION_FALLBACK_DEFAULT, True
