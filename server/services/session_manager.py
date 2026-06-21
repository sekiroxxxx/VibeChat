"""会话生命周期管理"""


async def get(session_id: str, session_store) -> dict | None:
    return await session_store.get(session_id)


async def close(session_id: str, session_store, match_queue):
    """关闭会话 + 通知对方"""
    session = await session_store.get(session_id)
    if session:
        session["status"] = "closed"
        session["closed_at"] = _now()
        await session_store.save(session)
    # TODO: SSE 通知对方


async def leave(session_id: str, user_id: str, session_store, match_queue):
    """用户离开会话"""
    # TODO: 通知对方 → 关闭会话 → 用户可重新匹配
    raise NotImplementedError


def _now():
    import time
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
