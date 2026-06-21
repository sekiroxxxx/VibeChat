"""GET /api/sessions/:id/stream (SSE)"""
from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

router = APIRouter()


@router.get("/api/sessions/{session_id}/stream")
async def stream_session(session_id: str):
    """SSE 消息流 — message/status/notification/error/heartbeat 事件"""
    # TODO: 从 session.messages 订阅新消息 → 推送给客户端
    raise NotImplementedError
