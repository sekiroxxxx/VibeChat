"""VibeChat 应用入口 — FastAPI 启动 + 依赖初始化 + 优雅关闭"""
import asyncio
import os
import signal
import sys
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
from server.config import config
from server.lib.llm_provider import LLMConfig, create_llm_provider
from server.lib.tracer import Tracer
from server.lib.rate_limiter import analyze_limiter
from server.services.storage import (
    InMemoryUserStore, InMemorySessionStore,
    InMemoryMatchQueue, InMemoryNamePool,
)
from server.services.event_bus import EventBus
from server.services.cleanup import cleanup_loop


# ── 全局引用（供 shutdown 使用） ──
_cleanup_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """启动时初始化所有依赖，关闭时清理"""
    global _cleanup_task

    # ── 存储层 ──
    app.state.user_store = InMemoryUserStore()
    app.state.session_store = InMemorySessionStore()
    app.state.match_queue = InMemoryMatchQueue()
    app.state.name_pool = InMemoryNamePool()

    # ── LLM Provider ──
    llm_config = LLMConfig(
        provider=config.LLM_PROVIDER,
        api_key=config.OPENAI_API_KEY if config.LLM_PROVIDER == "openai" else config.ANTHROPIC_API_KEY,
        model=config.OPENAI_MODEL if config.LLM_PROVIDER == "openai" else config.ANTHROPIC_MODEL,
        base_url=config.OPENAI_BASE_URL if config.LLM_PROVIDER == "openai" else config.ANTHROPIC_BASE_URL,
    )
    app.state.llm_provider = create_llm_provider(llm_config)

    # ── 横切关注点 ──
    app.state.tracer = Tracer()
    app.state.rate_limiter = analyze_limiter
    app.state.event_bus = EventBus()

    # ── 后台清理任务 ──
    _cleanup_task = asyncio.create_task(
        cleanup_loop(app.state.user_store, app.state.match_queue)
    )

    yield

    # ── 关闭 ──
    if _cleanup_task:
        _cleanup_task.cancel()
    await asyncio.sleep(2)


app = FastAPI(title="VibeChat", version="0.1.0", lifespan=lifespan)

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


def _handle_sigterm():
    """SIGTERM 处理器 — 不做复杂逻辑，交给 uvicorn 优雅关闭"""
    sys.exit(0)


signal.signal(signal.SIGTERM, lambda _s, _f: _handle_sigterm())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.SERVER_HOST, port=config.SERVER_PORT)
