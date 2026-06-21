"""情绪分析服务 — 调用 LLMProvider + 安全判断 + trace 记录"""


async def analyze(text: str, llm_provider, tracer, user_store, name_pool) -> dict:
    """
    输入: 用户文字
    输出: {analysis: EmotionAnalysis, anonymous_identity: str}
    副作用: 写入 emotion_history, trace
    """
    # TODO:
    # 1. tracer.record(node="analyze", ...)
    # 2. llm_provider.analyze_emotion(text) + fallback
    # 3. schema 校验 → 失败降级
    # 4. HIGH → 阻断返回 care redirect
    # 5. 成功 → 写入 user.current_emotion + emotion_history
    raise NotImplementedError
