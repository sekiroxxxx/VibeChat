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
    return {"authenticated": True, "user": user}
