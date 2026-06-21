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

async def analyze_with_fallback(provider: LLMProvider, text: str) -> dict:
    """
    JSON 校验失败 → 重试一次 → 仍失败 → 返回默认情绪
    """
    from server.lib.schema_validator import parse_llm_output
    from server.lib.fallback import EMOTION_FALLBACK_DEFAULT

    try:
        result = await provider.analyze_emotion(text)
        return parse_llm_output(result)
    except EmotionAnalysisError:
        try:
            result = await provider.analyze_emotion(text)
            return parse_llm_output(result)
        except EmotionAnalysisError:
            return EMOTION_FALLBACK_DEFAULT
