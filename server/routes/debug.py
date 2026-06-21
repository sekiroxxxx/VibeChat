"""GET /api/debug/trace — 仅 DEMO_MODE"""
from fastapi import APIRouter, Request, HTTPException
from server.config import config

router = APIRouter()


@router.get("/api/debug/trace")
async def get_trace(request: Request, n: int = 20, node: str = None):
    if not config.DEMO_MODE_ENABLED:
        raise HTTPException(403, "调试端点仅演示模式可用")

    tracer = request.app.state.tracer
    entries = tracer.last(n)
    if node:
        entries = [e for e in entries if e.node == node]

    return {
        "count": len(entries),
        "traces": [
            {
                "node": e.node,
                "ts": e.ts,
                "duration_ms": e.duration_ms,
                "status": e.status.value,
                "summary": e.summary,
            }
            for e in entries
        ]
    }
