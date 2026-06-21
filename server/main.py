"""VibeChat 应用入口"""
import asyncio
import signal
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from server.config import config

app = FastAPI(title="VibeChat", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.CORS_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 路由注册
from server.routes import auth, analyze, match, sessions, messages, stream, demo, debug, health
app.include_router(auth.router)
app.include_router(analyze.router)
app.include_router(match.router)
app.include_router(sessions.router)
app.include_router(messages.router)
app.include_router(stream.router)
app.include_router(demo.router)
app.include_router(debug.router)
app.include_router(health.router)


async def shutdown():
    """优雅关闭 — 通知活跃连接 + 等待完成"""
    # TODO: 通知所有活跃 SSE 连接
    await asyncio.sleep(10)
    sys.exit(0)


signal.signal(signal.SIGTERM, lambda _s, _f: asyncio.create_task(shutdown()))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.SERVER_HOST, port=config.SERVER_PORT)
