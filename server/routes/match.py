"""POST /api/match · DELETE /api/match"""
import time
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from server.services.matcher import match_user

router = APIRouter()
COOKIE_NAME = "vibechat_user"

VALID_MODES = {"auto", "guided", "free"}


class MatchRequest(BaseModel):
    match_mode: str = "auto"
    target_emotion: str | None = None


def _make_opening_generator(llm_provider):
    """包装 LLM 开场白生成器 → 适配 matcher 签名"""
    async def generate(ea: dict, eb: dict) -> dict:
        ctx = f"你们都带着'{ea['primary_emotion']}'和'{eb['primary_emotion']}'的情绪来到了这里"
        return await llm_provider.generate_opening_message(ea, eb, ctx)
    return generate


@router.post("/api/match")
async def enter_match(body: MatchRequest, request: Request):
    # 1. 用户身份
    user_id = request.cookies.get(COOKIE_NAME)
    if not user_id:
        raise HTTPException(401, "请先创建游客身份")
    user = await request.app.state.user_store.get(user_id)
    if not user:
        raise HTTPException(401, "用户不存在，请刷新页面")

    # 2. 校验模式
    if body.match_mode not in VALID_MODES:
        raise HTTPException(400, f"match_mode 必须为: {', '.join(VALID_MODES)}")
    if not user.get("current_emotion"):
        raise HTTPException(400, "请先完成情绪分析")

    # 3. 状态检查
    if user["match_status"] == "chatting":
        raise HTTPException(400, "你正在聊天中")

    # 4. 进入匹配队列
    user["match_mode"] = body.match_mode
    user["target_emotion"] = body.target_emotion
    await request.app.state.match_queue.enqueue(user)
    await request.app.state.user_store.save(user)

    # 5. 尝试匹配
    result = await match_user(
        user=user,
        match_queue=request.app.state.match_queue,
        session_store=request.app.state.session_store,
        opening_generator=_make_opening_generator(request.app.state.llm_provider),
    )

    # 6. 更新匹配后状态
    if result.get("matched"):
        user["match_status"] = "chatting"
        user["current_session_id"] = result["session"]["session_id"]
        matched_user = await _update_matched_partner(result["session"], user_id, request)
        # 推送开场白消息
        opening = result["session"]["opening_message"]
        await _push_opening_messages(result["session"], opening, request)

    await request.app.state.user_store.save(user)
    return result


async def _update_matched_partner(session: dict, my_id: str, request: Request) -> dict | None:
    """更新对方状态"""
    partner_key = "user_b" if session["user_a"]["id"] == my_id else "user_a"
    partner_id = session[partner_key]["id"]
    partner = await request.app.state.user_store.get(partner_id)
    if partner:
        partner["match_status"] = "chatting"
        partner["current_session_id"] = session["session_id"]
        await request.app.state.user_store.save(partner)
    return partner


async def _push_opening_messages(session: dict, opening: dict, request: Request):
    """向双方 SSE 连接推送开场白"""
    import time as _time
    sid = session["session_id"]
    ts = _time.strftime("%Y-%m-%dT%H:%M:%SZ", _time.gmtime())
    event_bus = request.app.state.event_bus

    # 共享开场白
    shared_msg = {
        "type": "message",
        "data": {
            "id": f"{sid}-sys-0",
            "session_id": sid,
            "type": "system",
            "sender_anonymous_id": "system",
            "content": opening.get("opening_message", ""),
            "timestamp": ts,
        }
    }
    await event_bus.publish(sid, shared_msg)


@router.delete("/api/match")
async def cancel_match(request: Request):
    user_id = request.cookies.get(COOKIE_NAME)
    if not user_id:
        raise HTTPException(401, "请先创建游客身份")
    user = await request.app.state.user_store.get(user_id)
    if not user:
        raise HTTPException(401, "用户不存在")

    await request.app.state.match_queue.dequeue(user_id)
    user["match_status"] = "idle"
    user["queue_entered_at"] = None
    user["retry_count"] = 0
    await request.app.state.user_store.save(user)
    return {"cancelled": True}
