"""POST /api/match · DELETE /api/match"""
import asyncio
import time
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from server.services.matcher import match_user

router = APIRouter()
COOKIE_NAME = "vibechat_user"

VALID_MODES = {"auto", "guided", "free"}
POLL_INTERVAL = 1.5      # 轮询间隔（秒）
MATCH_TIMEOUT = 30        # 最长等待（秒）


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
    user_store = request.app.state.user_store
    user = await user_store.get(user_id)
    if not user:
        raise HTTPException(401, "用户不存在，请刷新页面")

    # 2. 校验
    if body.match_mode not in VALID_MODES:
        raise HTTPException(400, f"match_mode 必须为: {', '.join(VALID_MODES)}")
    if not user.get("current_emotion"):
        raise HTTPException(400, "请先完成情绪分析")
    if user["match_status"] == "chatting":
        raise HTTPException(400, "你正在聊天中")

    # 3. 进入匹配队列
    match_queue = request.app.state.match_queue
    session_store = request.app.state.session_store
    og = _make_opening_generator(request.app.state.llm_provider)

    user["match_mode"] = body.match_mode
    user["target_emotion"] = body.target_emotion
    await match_queue.enqueue(user)
    await user_store.save(user)

    # 4. 轮询匹配 — 保持连接直到匹配成功或超时
    deadline = time.time() + MATCH_TIMEOUT
    while time.time() < deadline:
        # 4a. 先检查是否已被对方匹配
        fresh = await user_store.get(user_id)
        if fresh and fresh.get("current_session_id"):
            sid = fresh["current_session_id"]
            session = await session_store.get(sid)
            if session:
                user["match_status"] = "chatting"
                user["current_session_id"] = sid
                await user_store.save(user)
                return {"matched": True, "session": session}

        # 4b. 检查是否已取消
        if fresh and fresh.get("match_status") == "idle":
            return {"matched": False, "cancelled": True}

        # 4c. 主动匹配
        result = await match_user(user=user, match_queue=match_queue,
                                   session_store=session_store, opening_generator=og)
        if result.get("matched"):
            user["match_status"] = "chatting"
            user["current_session_id"] = result["session"]["session_id"]
            await _update_matched_partner(result["session"], user_id, request)
            await _push_opening_messages(result["session"],
                                          result["session"]["opening_message"], request)
            await user_store.save(user)
            return result

        # 4d. 未匹配 → 等一会再试
        await asyncio.sleep(POLL_INTERVAL)

    # 5. 超时
    user["retry_count"] = user.get("retry_count", 0) + 1
    await user_store.save(user)
    return {
        "matched": False,
        "fallback": {
            "type": "timeout",
            "retry_count": user["retry_count"],
            "options": ["retry", "random_match", "leave"],
        }
    }


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
