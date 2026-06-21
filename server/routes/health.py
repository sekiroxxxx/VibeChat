"""健康检查 + 优雅关闭"""

from fastapi import APIRouter

router = APIRouter()
_started = False

async def init_health(llm_provider):
    """启动时预加载 — 确认 LLM 连通性"""
    global _started
    try:
        _started = True
    except Exception:
        _started = False


@router.get("/health")
async def health():
    if not _started:
        return {"status": "starting"}, 503
    return {"status": "ok"}


# server/main.py 中:
# import signal, asyncio, sys
# async def shutdown():
#     for sid in active_sessions:
#         await notify_session_closed(sid, "服务正在重启，请稍后刷新")
#     await asyncio.sleep(10)
#     sys.exit(0)
# signal.signal(signal.SIGTERM, lambda: asyncio.create_task(shutdown()))
