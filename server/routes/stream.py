"""GET /api/sessions/:id/stream (SSE)"""
import asyncio
import json
import time
from fastapi import APIRouter, Request, HTTPException
from sse_starlette.sse import EventSourceResponse

router = APIRouter()
COOKIE_NAME = "vibechat_user"
HEARTBEAT_INTERVAL = 30  # 秒


def _now():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


@router.get("/api/sessions/{session_id}/stream")
async def stream_session(session_id: str, request: Request):
    # 1. 用户验证
    user_id = request.cookies.get(COOKIE_NAME)
    if not user_id:
        raise HTTPException(401, "请先创建游客身份")

    session = await request.app.state.session_store.get(session_id)
    if not session:
        raise HTTPException(404, "会话不存在")
    if user_id not in (session["user_a"]["id"], session["user_b"]["id"]):
        raise HTTPException(403, "无权访问此会话")

    event_bus = request.app.state.event_bus
    session_store = request.app.state.session_store
    user_store = request.app.state.user_store

    async def event_generator():
        queue = await event_bus.subscribe(session_id)
        try:
            # 发送已存在的历史消息
            for msg in session.get("messages", []):
                yield {"event": "message", "data": json.dumps(msg, ensure_ascii=False)}

            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_INTERVAL)
                    yield {"event": event["type"], "data": json.dumps(event["data"], ensure_ascii=False)}
                except asyncio.TimeoutError:
                    yield {"event": "heartbeat", "data": ""}
        except asyncio.CancelledError:
            pass
        finally:
            event_bus.unsubscribe(session_id, queue)

            # 掉线检测：非主动离开 + 会话仍活跃 → 对方断线
            s = await session_store.get(session_id)
            if s and s["status"] == "active" and not s.get("left_by"):
                await event_bus.publish(session_id, {
                    "type": "status",
                    "data": {"session_id": session_id, "status": "closing", "reason": "partner_disconnected"},
                })
                # 清理会话
                s["status"] = "closed"
                s["closed_at"] = _now()
                await session_store.save(s)
                # 清理双方用户状态
                for uid in (s["user_a"]["id"], s["user_b"]["id"]):
                    u = await user_store.get(uid)
                    if u:
                        u["match_status"] = "idle"
                        u["current_session_id"] = None
                        u["retry_count"] = 0
                        await user_store.save(u)

    return EventSourceResponse(event_generator())
