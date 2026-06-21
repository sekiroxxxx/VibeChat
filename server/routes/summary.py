"""POST /api/sessions/:id/summary — 聊天总结"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()
COOKIE_NAME = "vibechat_user"


class SummaryRequest(BaseModel):
    feeling: str = Field(min_length=1, max_length=500)


@router.post("/api/sessions/{session_id}/summary")
async def create_summary(session_id: str, body: SummaryRequest, request: Request):
    # 1. 用户验证
    user_id = request.cookies.get(COOKIE_NAME)
    if not user_id:
        raise HTTPException(401, "请先创建游客身份")

    session = await request.app.state.session_store.get(session_id)
    if not session:
        raise HTTPException(404, "会话不存在")
    if user_id not in (session["user_a"]["id"], session["user_b"]["id"]):
        raise HTTPException(403, "无权操作")

    # 2. 获取用户聊天前的情绪
    user_key = "user_a" if session["user_a"]["id"] == user_id else "user_b"
    emotion_before = session[user_key].get("emotion", {})

    # 3. 调 LLM 生成总结
    result = await request.app.state.llm_provider.generate_chat_summary(
        messages=session.get("messages", []),
        feeling=body.feeling,
        emotion_before=emotion_before,
    )

    # 4. 写入用户的 emotion_history
    user = await request.app.state.user_store.get(user_id)
    if user:
        entry = {
            "primary_emotion": emotion_before.get("primary_emotion", ""),
            "summary": result.get("summary", ""),
            "feeling": body.feeling,
            "emotion_shift": result.get("emotion_shift", {}),
            "session_id": session_id,
            "timestamp": _now(),
        }
        if "emotion_history" not in user:
            user["emotion_history"] = []
        user["emotion_history"].append(entry)
        await request.app.state.user_store.save(user)

    return {
        "summary": result.get("summary", ""),
        "emotion_shift": result.get("emotion_shift", {
            "before": emotion_before.get("primary_emotion", ""),
            "after_hint": "",
        }),
    }


def _now():
    import time
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
