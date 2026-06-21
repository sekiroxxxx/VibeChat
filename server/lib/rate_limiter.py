"""
速率限制 — 保护 LLM API 费用
★ 手册 §16 问题 3：每用户每分钟 N 次 /api/analyze
★ v1 内存计数，重启后重置
"""

import time
from collections import defaultdict


class RateLimiter:
    """滑动窗口速率限制器"""

    def __init__(self, max_requests: int = 10, window_s: int = 60):
        self.max = max_requests
        self.window = window_s
        self._hits: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, key: str) -> bool:
        """过去 window 秒内是否超过 max 次"""
        now = time.time()
        cutoff = now - self.window
        self._hits[key] = [t for t in self._hits[key] if t > cutoff]
        return len(self._hits[key]) < self.max

    def record(self, key: str):
        self._hits[key].append(time.time())


# 全局实例 — 仅限制 /api/analyze（成本最高）
analyze_limiter = RateLimiter(max_requests=10, window_s=60)
