"""POST /api/match · DELETE /api/match"""
from fastapi import APIRouter

router = APIRouter()


@router.post("/api/match")
async def enter_match(request: dict):
    """进入匹配队列"""
    raise NotImplementedError


@router.delete("/api/match")
async def cancel_match():
    """取消匹配"""
    raise NotImplementedError
