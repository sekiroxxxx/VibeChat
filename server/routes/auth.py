"""POST /api/auth/guest · GET /api/me"""
from fastapi import APIRouter, Request, Response

router = APIRouter()


@router.post("/api/auth/guest")
async def create_guest(response: Response):
    """游客身份创建 → Set-Cookie: user_id={uuid}; HttpOnly"""
    # TODO: 生成 UUID → InMemoryUserStore.save → Set-Cookie
    raise NotImplementedError


@router.get("/api/me")
async def get_me(request: Request):
    """cookie 中 user_id → 查找当前状态 → 页面刷新恢复"""
    # TODO: 从 cookie 取 user_id → store.get → 返回 UserState
    raise NotImplementedError
