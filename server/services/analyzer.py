"""情绪分析服务 — LLM 调用 + 安全判断 + trace 记录"""
import time
from server.lib.llm_provider import analyze_with_fallback
from server.lib.tracer import TraceEntry, TraceStatus


async def analyze(text: str, user: dict, llm_provider, tracer, user_store, name_pool) -> dict:
    """
    输入: 用户文字 + 当前用户状态
    输出: {"redirect": "care"} | {"analysis": EmotionAnalysis, "anonymous_identity": str}
    副作用: 更新 user.current_emotion, emotion_history, anonymous_identity, trace
    """
    t0 = time.time()

    # 1. LLM 分析 + 降级
    result, is_fallback = await analyze_with_fallback(llm_provider, text)

    duration_ms = int((time.time() - t0) * 1000)

    # 2. Trace 记录
    tracer.record(TraceEntry(
        node="analyze",
        ts=t0,
        duration_ms=duration_ms,
        status=TraceStatus.OK if not is_fallback else TraceStatus.ERROR,
        summary=f"primary={result.get('primary_emotion')} risk={result.get('safety', {}).get('risk_level')}",
        prompt_tokens=llm_provider._last_prompt_tokens,
        completion_tokens=llm_provider._last_completion_tokens,
        model=getattr(llm_provider, 'model', ''),
        llm_raw_output=str(result) if is_fallback else None,
        error_type="fallback" if is_fallback else None,
    ))

    # 3. 安全阻断检查
    safety = result.get("safety", {})
    if safety.get("risk_level") == "HIGH":
        return {"redirect": "care", "safety": safety}

    # 4. 更新用户状态
    user["current_emotion"] = result
    user["emotion_history"].append(result)
    if not user.get("anonymous_identity"):
        user["anonymous_identity"] = name_pool.allocate(result.get("valence", 0))
    user["match_status"] = "analyzing"
    await user_store.save(user)

    return {
        "analysis": result,
        "anonymous_identity": user["anonymous_identity"],
        "is_fallback": is_fallback,
    }
