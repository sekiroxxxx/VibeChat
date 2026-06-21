"""Anthropic Provider — 实现 LLMProvider 接口"""
import json
from anthropic import AsyncAnthropic
from server.lib.llm_provider import LLMProvider, LLMConfig, EmotionAnalysisError
from server.prompts.index import ANALYZE_PROFILE, OPENING_PROFILE


class AnthropicProvider(LLMProvider):
    def __init__(self, config: LLMConfig):
        self.config = config
        self.model = config.model
        self.client = AsyncAnthropic(
            api_key=config.api_key,
            base_url=config.base_url,
            timeout=30.0,
        )
        self._last_prompt_tokens = 0
        self._last_completion_tokens = 0

    async def analyze_emotion(self, text: str) -> dict:
        try:
            response = await self.client.messages.create(
                model=self.model,
                temperature=ANALYZE_PROFILE.temperature,
                max_tokens=ANALYZE_PROFILE.max_tokens,
                system=ANALYZE_PROFILE.system_prompt,
                messages=[{"role": "user", "content": text}],
            )
            self._last_prompt_tokens = response.usage.input_tokens if response.usage else 0
            self._last_completion_tokens = response.usage.output_tokens if response.usage else 0
            raw = response.content[0].text
            return json.loads(raw)
        except Exception as e:
            raise EmotionAnalysisError(str(e), retryable=True)

    async def generate_opening_message(self, emotion_a: dict, emotion_b: dict, ctx: str) -> dict:
        prompt = OPENING_PROFILE.system_prompt.format(
            emotion_a_summary=f"{emotion_a.get('primary_emotion')} + {emotion_a.get('secondary_emotion', '')}",
            emotion_b_summary=f"{emotion_b.get('primary_emotion')} + {emotion_b.get('secondary_emotion', '')}",
            shared_context=ctx,
        )
        response = await self.client.messages.create(
            model=self.model,
            temperature=OPENING_PROFILE.temperature,
            max_tokens=OPENING_PROFILE.max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return json.loads(response.content[0].text)
