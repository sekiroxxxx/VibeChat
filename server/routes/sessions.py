"""POST /api/sessions · GET /:id · POST /:id/leave · POST /:id/report"""
from fastapi import APIRouter, Request, HTTPException
from server.services.session_manager import get, leave

router = APIRouter()
COOKIE_NAME = "vibechat_user"


def _get_user(request: Request) -> dict:
    """从 cookie 获取当前用户"""
    user_id = request.cookies.get(COOKIE_NAME)
    if not user_id:
        raise HTTPException(401, "请先创建游客身份")
    return {"user_id": user_id}


@router.get("/api/sessions/{session_id}")
async def get_session(session_id: str, request: Request):
    user = _get_user(request)
    session = await get(session_id, request.app.state.session_store)
    if not session:
        raise HTTPException(404, "会话不存在")
    # 确认用户属于此会话
    ids = {session["user_a"]["id"], session["user_b"]["id"]}
    if user["user_id"] not in ids:
        raise HTTPException(403, "无权访问此会话")
    return {"session": session}


@router.post("/api/sessions/{session_id}/leave")
async def leave_session(session_id: str, request: Request):
    user = _get_user(request)

    # 标记主动离开者 — SSE 掉线检测用
    session = await get(session_id, request.app.state.session_store)
    if session:
        session["left_by"] = user["user_id"]
        await request.app.state.session_store.save(session)

    result = await leave(
        session_id=session_id,
        user_id=user["user_id"],
        session_store=request.app.state.session_store,
        user_store=request.app.state.user_store,
        event_bus=request.app.state.event_bus,
    )
    if "error" in result:
        raise HTTPException(404, result["error"])
    return result


@router.post("/api/sessions/{session_id}/report")
async def report_session(session_id: str, request: Request):
    user = _get_user(request)
    session = await get(session_id, request.app.state.session_store)
    if not session:
        raise HTTPException(404, "会话不存在")
    # v1: 仅记录，不做自动处理
    tracer = request.app.state.tracer
    from server.lib.tracer import TraceEntry, TraceStatus
    tracer.record(TraceEntry(
        node="report",
        ts=__import__("time").time(),
        duration_ms=0,
        status=TraceStatus.OK,
        summary=f"user {user['user_id']} reported session {session_id}",
    ))
    # 通知双方会话结束
    await request.app.state.event_bus.publish(session_id, {
        "type": "status",
        "data": {"session_id": session_id, "status": "closed", "reason": "会话已被举报并关闭"},
    })
    return {"reported": True}
