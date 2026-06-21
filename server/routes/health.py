"""GET /api/health — 健康检查"""
from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/health")
async def health(request: Request):
    llm = request.app.state.llm_provider
    if llm is None:
        return {"status": "starting"}, 503
    return {"status": "ok"}
