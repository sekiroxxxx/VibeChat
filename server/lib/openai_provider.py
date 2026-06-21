"""OpenAI Provider — 实现 LLMProvider 接口"""
import json
from openai import AsyncOpenAI
from server.lib.llm_provider import LLMProvider, LLMConfig, EmotionAnalysisError
from server.prompts.index import ANALYZE_PROFILE, OPENING_PROFILE, SUMMARY_PROFILE


class OpenAIProvider(LLMProvider):
    def __init__(self, config: LLMConfig):
        self.config = config
        self.model = config.model
        self.client = AsyncOpenAI(
            api_key=config.api_key,
            base_url=config.base_url,
            timeout=30.0,
        )
        self._last_prompt_tokens = 0
        self._last_completion_tokens = 0

    async def analyze_emotion(self, text: str) -> dict:
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                temperature=ANALYZE_PROFILE.temperature,
                max_tokens=ANALYZE_PROFILE.max_tokens,
                messages=[
                    {"role": "system", "content": ANALYZE_PROFILE.system_prompt},
                    {"role": "user", "content": text},
                ],
            )
            self._last_prompt_tokens = response.usage.prompt_tokens if response.usage else 0
            self._last_completion_tokens = response.usage.completion_tokens if response.usage else 0
            raw = response.choices[0].message.content
            return raw  # 原始字符串 — 解析留给 schema_validator
        except Exception as e:
            raise EmotionAnalysisError(str(e), retryable=True)

    async def generate_opening_message(self, emotion_a: dict, emotion_b: dict, ctx: str) -> dict:
        user_prompt = (
            f"用户A情绪: {emotion_a.get('primary_emotion')} + {emotion_a.get('secondary_emotion', '')}\n"
            f"用户B情绪: {emotion_b.get('primary_emotion')} + {emotion_b.get('secondary_emotion', '')}\n"
            f"共享上下文: {ctx}"
        )
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                temperature=OPENING_PROFILE.temperature,
                max_tokens=OPENING_PROFILE.max_tokens,
                messages=[
                    {"role": "system", "content": OPENING_PROFILE.system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
            raw = response.choices[0].message.content
            return json.loads(raw)
        except (json.JSONDecodeError, Exception):
            return {
                "opening_message": "你们此刻都在经历相似的心情，聊聊吧 ✨",
                "for_user_a": "",
                "for_user_b": "",
            }

    async def generate_chat_summary(self, messages: list[dict], feeling: str, emotion_before: dict) -> dict:
        # 构建对话文本
        chat_text = "\n".join(
            f"[{m['sender_anonymous_id']}]: {m['content']}" for m in messages
        )
        user_prompt = (
            f"聊天前情绪: {emotion_before.get('primary_emotion', '')}\n"
            f"对话记录:\n{chat_text}\n\n"
            f"聊后感受: {feeling}"
        )
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                temperature=SUMMARY_PROFILE.temperature,
                max_tokens=SUMMARY_PROFILE.max_tokens,
                messages=[
                    {"role": "system", "content": SUMMARY_PROFILE.system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
            return json.loads(response.choices[0].message.content)
        except (json.JSONDecodeError, Exception):
            return {
                "summary": "感谢你的分享，这段对话已经结束。",
                "emotion_shift": {"before": emotion_before.get("primary_emotion", ""), "after_hint": "情绪似乎有了微妙的变化"},
            }
