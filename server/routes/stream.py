"""GET /api/sessions/:id/stream (SSE)"""
import asyncio
import json
from fastapi import APIRouter, Request, HTTPException
from sse_starlette.sse import EventSourceResponse

router = APIRouter()
COOKIE_NAME = "vibechat_user"
HEARTBEAT_INTERVAL = 30  # 秒


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

    return EventSourceResponse(event_generator())
