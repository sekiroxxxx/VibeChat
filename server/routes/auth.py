"""POST /api/auth/guest · GET /api/me"""
import time
import uuid
from fastapi import APIRouter, Request, Response

router = APIRouter()

COOKIE_NAME = "vibechat_user"
COOKIE_MAX_AGE = 86400 * 7  # 7 天


def _new_user(user_id: str) -> dict:
    return {
        "user_id": user_id,
        "auth_type": "guest",
        "anonymous_identity": "",
        "created_at": time.time(),
        "current_emotion": None,
        "emotion_history": [],
        "match_status": "idle",
        "retry_count": 0,
        "current_session_id": None,
        "account_id": None,
    }


@router.post("/api/auth/guest")
async def create_guest(response: Response, request: Request):
    user_id = str(uuid.uuid4())
    user = _new_user(user_id)
    await request.app.state.user_store.save(user)
    response.set_cookie(
        key=COOKIE_NAME,
        value=user_id,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
    )
    return {"user_id": user_id, "auth_type": "guest"}


@router.get("/api/me")
async def get_me(request: Request):
    user_id = request.cookies.get(COOKIE_NAME)
    if not user_id:
        return {"authenticated": False}
    user = await request.app.state.user_store.get(user_id)
    if not user:
        return {"authenticated": False}

    # 历史情绪
    emotion_history = user.get("emotion_history", [])

    # 历史会话
    all_sessions = await request.app.state.session_store.list_by_user(user_id)
    past_sessions = []
    for s in all_sessions:
        # 找出对方信息
        is_a = s["user_a"]["id"] == user_id
        other = s["user_b"] if is_a else s["user_a"]
        past_sessions.append({
            "session_id": s["session_id"],
            "other_name": other.get("anonymous_name", ""),
            "other_emotion": other.get("emotion", {}).get("primary_emotion", ""),
            "created_at": s.get("created_at", ""),
            "closed_at": s.get("closed_at", ""),
            "status": s.get("status", ""),
        })

    return {
        "authenticated": True,
        "user": user,
        "emotion_history": emotion_history,
        "past_sessions": sorted(past_sessions, key=lambda x: x["created_at"], reverse=True),
    }
