"""POST /api/demo/seed — 演示专用"""
from fastapi import APIRouter
from server.config import config

router = APIRouter()


@router.post("/api/demo/seed")
async def seed_demo_user(request: dict):
    """注入假用户到匹配队列 — 仅 DEMO_MODE_ENABLED=true"""
    if not config.DEMO_MODE_ENABLED:
        return {"error": "演示模式未启用"}, 403
    # TODO: 从 DEMO_PRESETS 选预设 → 注入到队列
    raise NotImplementedError
