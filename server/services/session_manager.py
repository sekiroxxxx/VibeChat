"""会话生命周期管理"""
import time


def _now():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


async def get(session_id: str, session_store) -> dict | None:
    return await session_store.get(session_id)


async def close(session_id: str, session_store, event_bus):
    """关闭会话 + SSE 通知双方"""
    session = await session_store.get(session_id)
    if not session:
        return
    session["status"] = "closed"
    session["closed_at"] = _now()
    await session_store.save(session)
    await event_bus.publish(session_id, {
        "type": "status",
        "data": {"session_id": session_id, "status": "closed", "reason": "会话已结束"},
    })


async def leave(session_id: str, user_id: str, session_store, user_store, event_bus):
    """
    用户离开会话 → 通知对方 → 清理双方状态 → 关闭会话
    注意: left_by 标记由调用方 (routes/sessions.py) 在调用前写入 session，
    供 SSE 掉线检测 (routes/stream.py) 区分主动离开/断线。
    """
    session = await session_store.get(session_id)
    if not session:
        return {"error": "会话不存在"}

    # 找出对方
    partner_id = (
        session["user_b"]["id"] if session["user_a"]["id"] == user_id
        else session["user_a"]["id"]
    )

    # 更新会话状态
    session["status"] = "closing"
    await session_store.save(session)

    # 通知对方
    await event_bus.publish(session_id, {
        "type": "status",
        "data": {"session_id": session_id, "status": "closing", "reason": "对方已离开"},
    })

    # 清理双方状态
    for uid in (user_id, partner_id):
        u = await user_store.get(uid)
        if u:
            u["match_status"] = "idle"
            u["current_session_id"] = None
            u["retry_count"] = 0
            u["queue_entered_at"] = None
            await user_store.save(u)

    # 标记会话关闭
    session["status"] = "closed"
    session["closed_at"] = _now()
    await session_store.save(session)
    return {"left": True}
