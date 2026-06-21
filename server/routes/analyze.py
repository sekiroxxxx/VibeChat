"""POST /api/analyze"""
from fastapi import APIRouter

router = APIRouter()


@router.post("/api/analyze")
async def analyze_emotion(request: dict):
    """情绪分析 → EmotionAnalysis"""
    # TODO: 调用 analyzer.analyze() → 返回结果
    raise NotImplementedError
