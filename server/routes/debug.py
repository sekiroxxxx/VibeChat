"""GET /api/debug/trace — 仅 DEMO_MODE"""
from fastapi import APIRouter
from server.config import config

router = APIRouter()


@router.get("/api/debug/trace")
async def get_trace(n: int = 20, node: str = None):
    if not config.DEMO_MODE_ENABLED:
        return {"error": "调试端点仅演示模式可用"}, 403
    # TODO: tracer.last(n) → 返回
    raise NotImplementedError
