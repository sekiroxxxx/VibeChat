"""
最简链路验证脚本
用法: python -m server.verify
验证: 文本 → LLM → 情绪 JSON → Schema 校验 → 输出
"""
import asyncio
import json
import os
import sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from server.config import config
from server.lib.llm_provider import LLMConfig, create_llm_provider
from server.lib.schema_validator import parse_llm_output
from server.lib.fallback import EMOTION_FALLBACK_DEFAULT


async def verify():
    print("=" * 50)
    print(f"VibeChat 最简链路验证")
    print(f"LLM Provider: {config.LLM_PROVIDER}")
    print(f"Model: {config.OPENAI_MODEL if config.LLM_PROVIDER == 'openai' else config.ANTHROPIC_MODEL}")
    print("=" * 50)

    # 1. 创建 Provider
    llm_config = LLMConfig(
        provider=config.LLM_PROVIDER,
        api_key=config.OPENAI_API_KEY if config.LLM_PROVIDER == "openai" else config.ANTHROPIC_API_KEY,
        model=config.OPENAI_MODEL if config.LLM_PROVIDER == "openai" else config.ANTHROPIC_MODEL,
        base_url=config.OPENAI_BASE_URL if config.LLM_PROVIDER == "openai" else config.ANTHROPIC_BASE_URL,
    )
    provider = create_llm_provider(llm_config)
    print("\n✅ Provider 创建成功")

    # 2. 单次 LLM 调用
    test_text = "今天加班到11点，地铁上一个人都没有，突然觉得好孤独"
    print(f"\n📝 测试输入: \"{test_text}\"")

    try:
        result = await provider.analyze_emotion(test_text)
        print(f"✅ LLM 调用成功 — {provider._last_prompt_tokens}+{provider._last_completion_tokens} tokens")
    except Exception as e:
        print(f"❌ LLM 调用失败: {e}")
        return 1

    # 3. Schema 校验
    validated = parse_llm_output(result if isinstance(result, str) else json.dumps(result))
    if validated.get("parseError"):
        print(f"⚠️  Schema 校验失败 — 尝试降级")
        print(f"   原始输出: {json.dumps(validated.get('raw', '')[:200], ensure_ascii=False)}")
        print(f"   降级为: EMOTION_FALLBACK_DEFAULT")
        final = EMOTION_FALLBACK_DEFAULT
    else:
        final = validated["data"]
        print(f"✅ Schema 校验通过")

    # 4. 展示结果
    print(f"\n📊 情绪分析结果:")
    print(f"   主要情绪: {final.get('primary_emotion')}")
    print(f"   强度: {final.get('intensity')}")
    print(f"   正负向: {final.get('valence')}")
    print(f"   解读: {final.get('interpretation')}")
    safety = final.get("safety", {})
    print(f"   安全等级: {safety.get('risk_level')}")

    # 5. 打印情绪向量
    vec = final.get("emotion_vector", {})
    if vec:
        top = sorted(vec.items(), key=lambda x: x[1], reverse=True)[:3]
        print(f"   Top-3 情绪: {', '.join(f'{k}({v:.2f})' for k, v in top)}")

    print(f"\n{'=' * 50}")
    print(f"验证{'通过' if not validated.get('parseError') else '通过(降级)'}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(verify()))
