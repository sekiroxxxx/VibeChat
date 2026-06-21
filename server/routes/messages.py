"""POST /api/sessions/:id/messages"""
from fastapi import APIRouter

router = APIRouter()


@router.post("/api/sessions/{session_id}/messages")
async def send_message(session_id: str, request: dict):
    """发送消息 → 内容扫描 → 追加到 session.messages"""
    raise NotImplementedError
