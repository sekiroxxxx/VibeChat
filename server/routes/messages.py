"""POST /api/sessions/:id/messages"""
import time
import uuid
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field
from server.services.content_filter import filter_message

router = APIRouter()
COOKIE_NAME = "vibechat_user"


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=1000)


@router.post("/api/sessions/{session_id}/messages")
async def send_message(session_id: str, body: SendMessageRequest, request: Request):
    # 1. 用户验证
    user_id = request.cookies.get(COOKIE_NAME)
    if not user_id:
        raise HTTPException(401, "请先创建游客身份")

    session = await request.app.state.session_store.get(session_id)
    if not session:
        raise HTTPException(404, "会话不存在")
    if session["status"] != "active":
        raise HTTPException(400, "会话已结束")

    # 确认用户属于此会话
    user_key = "user_a" if session["user_a"]["id"] == user_id else "user_b"
    if user_id not in (session["user_a"]["id"], session["user_b"]["id"]):
        raise HTTPException(403, "无权发送消息")

    # 2. 内容安全扫描
    filtered = filter_message(body.content)
    if filtered["blocked"]:
        return {"sent": False, "blocked": True, "content": filtered["content"], "flags": filtered["flags"]}

    # 3. 创建消息
    msg = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "type": "user",
        "sender_anonymous_id": session[user_key]["anonymous_name"],
        "content": filtered["content"],
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    # 4. 追加到会话
    session["messages"].append(msg)
    await request.app.state.session_store.save(session)

    # 5. 推送 SSE
    await request.app.state.event_bus.publish(session_id, {
        "type": "message",
        "data": msg,
    })

    return {"sent": True, "message": msg}


@router.post("/api/sessions/{session_id}/typing")
async def send_typing(session_id: str, request: Request):
    """输入状态通知 → SSE 广播给对方"""
    user_id = request.cookies.get(COOKIE_NAME)
    if not user_id:
        raise HTTPException(401, "请先创建游客身份")

    session = await request.app.state.session_store.get(session_id)
    if not session:
        raise HTTPException(404, "会话不存在")
    if session["status"] != "active":
        raise HTTPException(400, "会话已结束")
    if user_id not in (session["user_a"]["id"], session["user_b"]["id"]):
        raise HTTPException(403, "无权操作")

    user_key = "user_a" if session["user_a"]["id"] == user_id else "user_b"

    await request.app.state.event_bus.publish(session_id, {
        "type": "typing",
        "data": {
            "session_id": session_id,
            "sender_anonymous_id": session[user_key]["anonymous_name"],
        },
    })
    return {"ok": True}
