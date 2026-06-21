"""
存储层接口 + InMemory 实现
★ 决策 A：4 个 Store 接口隔离 — v1 内存，v2 Redis/DB 不改业务代码
"""

import time
import asyncio
from abc import ABC, abstractmethod


class UserStore(ABC):
    """用户状态存储"""
    @abstractmethod
    async def get(self, user_id: str) -> dict | None: ...
    @abstractmethod
    async def save(self, user: dict) -> None: ...
    @abstractmethod
    async def delete(self, user_id: str) -> None: ...
    @abstractmethod
    async def list_stale(self, idle_s: int) -> list[str]: ...


class SessionStore(ABC):
    """聊天会话存储"""
    @abstractmethod
    async def get(self, session_id: str) -> dict | None: ...
    @abstractmethod
    async def save(self, session: dict) -> None: ...
    @abstractmethod
    async def delete(self, session_id: str) -> None: ...


class MatchQueue(ABC):
    """匹配队列 — v2 可替换为 Redis sorted set"""
    @abstractmethod
    async def enqueue(self, user: dict) -> None: ...
    @abstractmethod
    async def dequeue(self, user_id: str) -> None: ...
    @abstractmethod
    async def get_candidates(self) -> list[dict]: ...
    @abstractmethod
    async def cleanup_stale(self, timeout_s: int) -> int: ...


class NamePool(ABC):
    """匿名身份名称池"""
    @abstractmethod
    def allocate(self, valence: float) -> str: ...
    @abstractmethod
    def release(self, name: str) -> None: ...


# ── v1: InMemory 实现 ──

class InMemoryUserStore(UserStore):
    def __init__(self):
        self._users: dict[str, dict] = {}
    async def get(self, uid): return self._users.get(uid)
    async def save(self, u):   self._users[u["user_id"]] = u
    async def delete(self, uid): self._users.pop(uid, None)
    async def list_stale(self, idle_s):
        now = time.time()
        return [uid for uid, u in self._users.items()
                if u.get("match_status") == "idle" and now - u.get("created_at", 0) > idle_s]


class InMemorySessionStore(SessionStore):
    def __init__(self):
        self._sessions: dict[str, dict] = {}
    async def get(self, sid): return self._sessions.get(sid)
    async def save(self, s):   self._sessions[s["session_id"]] = s
    async def delete(self, sid): self._sessions.pop(sid, None)


class InMemoryMatchQueue(MatchQueue):
    def __init__(self):
        self._queue: list[dict] = []
        self._lock = asyncio.Lock()

    async def enqueue(self, user):
        async with self._lock:
            user["match_status"] = "waiting"
            user["queue_entered_at"] = time.time()
            self._queue.append(user)

    async def dequeue(self, uid):
        async with self._lock:
            self._queue = [u for u in self._queue if u["user_id"] != uid]

    async def get_candidates(self):
        return [u for u in self._queue if u.get("match_status") == "waiting"]

    async def cleanup_stale(self, timeout_s):
        async with self._lock:
            now = time.time()
            stale = [u for u in self._queue if now - (u.get("queue_entered_at") or 0) > timeout_s]
            self._queue = [u for u in self._queue if u not in stale]
            return len(stale)


class InMemoryNamePool(NamePool):
    """从预定义名称池按情绪 valence 分配"""
    def __init__(self):
        self._used: set[str] = set()
        self._pools = {
            "positive": ["晨光里的人", "雨后的晴空", "正在微笑的人", "今晚的月亮",
                         "一杯温水", "窗外的鸟鸣", "刚晒过太阳的猫", "黄昏时分",
                         "新芽", "海边的风", "星空下的旅人", "等天亮的人",
                         "柔和的灯光", "清晨的露水", "正在深呼吸的人"],
            "neutral":  ["安静的房间", "夜色中的人", "午夜的收音机", "未完成的诗",
                         "走廊尽头", "等车的人", "冬日午后", "旧书的扉页",
                         "缓缓流淌的河", "窗边的绿植", "远方的来信", "一个人的电影院",
                         "翻阅日记的人", "凌晨四点的街", "半杯温水"],
            "negative": ["夜归的人", "雨天的窗台", "沉默的树", "深海的鲸",
                         "旧台灯下的人", "薄雾中的山", "长夜将尽", "候鸟",
                         "无人知晓的岛屿", "褪色的照片", "独行的路", "未眠的人",
                         "灰蓝色", "日记本最后一页", "即将破晓"],
        }

    def allocate(self, valence: float) -> str:
        if valence > 0.3:
            pool = self._pools["positive"]
        elif valence < -0.3:
            pool = self._pools["negative"]
        else:
            pool = self._pools["neutral"]
        available = [n for n in pool if n not in self._used]
        if not available:
            self._used.clear()
            available = pool
        name = available[0]
        self._used.add(name)
        return name

    def release(self, name: str):
        self._used.discard(name)
