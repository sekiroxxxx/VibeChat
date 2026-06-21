"""
SSE 事件总线 — 会话级 pub/sub
★ POST /messages 发布事件 → SSE stream 推送给所有订阅者
"""
import asyncio


class EventBus:
    """会话级发布/订阅 — v1 内存实现"""

    def __init__(self):
        self._queues: dict[str, list[asyncio.Queue]] = {}

    async def subscribe(self, session_id: str) -> asyncio.Queue:
        """订阅会话事件流 → 返回异步队列"""
        q: asyncio.Queue = asyncio.Queue()
        self._queues.setdefault(session_id, []).append(q)
        return q

    def unsubscribe(self, session_id: str, queue: asyncio.Queue) -> None:
        """取消订阅"""
        queues = self._queues.get(session_id, [])
        if queue in queues:
            queues.remove(queue)
        if not queues:
            self._queues.pop(session_id, None)

    async def publish(self, session_id: str, event: dict) -> None:
        """向会话所有订阅者推送事件"""
        for q in self._queues.get(session_id, []):
            await q.put(event)

    def subscriber_count(self, session_id: str) -> int:
        return len(self._queues.get(session_id, []))
