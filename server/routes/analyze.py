"""POST /api/analyze — 情绪分析端点"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field
from server.services.analyzer import analyze

router = APIRouter()

COOKIE_NAME = "vibechat_user"


class AnalyzeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)


@router.post("/api/analyze")
async def analyze_emotion(body: AnalyzeRequest, request: Request):
    # 1. 用户身份
    user_id = request.cookies.get(COOKIE_NAME)
    if not user_id:
        raise HTTPException(401, "请先创建游客身份")
    user = await request.app.state.user_store.get(user_id)
    if not user:
        raise HTTPException(401, "用户不存在，请刷新页面")

    # 2. 速率限制
    limiter = request.app.state.rate_limiter
    if not limiter.is_allowed(user_id):
        raise HTTPException(429, "请求太频繁，请稍后再试")
    limiter.record(user_id)

    # 3. 调用分析服务
    result = await analyze(
        text=body.text,
        user=user,
        llm_provider=request.app.state.llm_provider,
        tracer=request.app.state.tracer,
        user_store=request.app.state.user_store,
        name_pool=request.app.state.name_pool,
    )

    # 4. HIGH 风险 → 关怀页
    if "redirect" in result:
        return {"redirect": result["redirect"], "safety": result["safety"]}

    return {
        "analysis": result["analysis"],
        "anonymous_identity": result["anonymous_identity"],
        "is_fallback": result.get("is_fallback", False),
    }
