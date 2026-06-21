"""POST /api/demo/seed — 演示专用"""
import uuid
import time
from fastapi import APIRouter, Request, HTTPException
from server.config import config
from server.services.demo import DEMO_PRESETS
from server.services.matcher import match_user
from server.routes.match import _make_opening_generator

router = APIRouter()


@router.post("/api/demo/seed")
async def seed_demo_user(request: Request, body: dict | None = None):
    """注入假用户到匹配队列 — 仅 DEMO_MODE_ENABLED=true"""
    if not config.DEMO_MODE_ENABLED:
        raise HTTPException(403, "演示模式未启用")

    preset_key = (body or {}).get("preset_emotion", "joy")
    preset = DEMO_PRESETS.get(preset_key, DEMO_PRESETS["joy"])

    user_store = request.app.state.user_store
    name_pool = request.app.state.name_pool

    # 创建演示用户
    user_id = f"demo-{uuid.uuid4().hex[:8]}"
    user = {
        "user_id": user_id,
        "auth_type": "guest",
        "anonymous_identity": preset["anonymous_name"],
        "created_at": time.time(),
        "current_emotion": None,
        "emotion_history": [],
        "match_status": "idle",
        "retry_count": 0,
        "current_session_id": None,
        "account_id": None,
    }

    # 模拟情绪分析
    analysis = await _analyze_for_demo(preset["text"], request.app.state.llm_provider)
    user["current_emotion"] = analysis
    user["emotion_history"].append(analysis)
    user["anonymous_identity"] = preset["anonymous_name"]
    await user_store.save(user)

    # 入队匹配
    user["match_mode"] = "auto"
    user["match_status"] = "waiting"
    user["queue_entered_at"] = time.time()
    await request.app.state.match_queue.enqueue(user)

    result = await match_user(
        user=user,
        match_queue=request.app.state.match_queue,
        session_store=request.app.state.session_store,
        opening_generator=_make_opening_generator(request.app.state.llm_provider),
    )

    if result.get("matched"):
        user["match_status"] = "chatting"
        user["current_session_id"] = result["session"]["session_id"]
        await user_store.save(user)

    return {"demo_user": {"user_id": user_id, "name": preset["anonymous_name"]}, "match_result": result}


async def _analyze_for_demo(text: str, llm_provider) -> dict:
    """为演示用户模拟情绪分析"""
    from server.lib.llm_provider import analyze_with_fallback
    result, _ = await analyze_with_fallback(llm_provider, text)
    return result
