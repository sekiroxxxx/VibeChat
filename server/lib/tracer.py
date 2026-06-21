"""
可观测性 — 统一 Trace 记录
★ 手册 §13：所有层共用同一 trace 格式
★ 每个节点执行完后追加一条 TraceEntry
"""

import time
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum


class TraceStatus(Enum):
    OK = "ok"
    ERROR = "error"
    SKIP = "skip"


@dataclass
class TraceEntry:
    """最小 trace 条目 — 所有层共用"""
    node: str                  # analyze / match / send_message / filter
    ts: float                  # Unix 时间戳
    duration_ms: int           # 耗时（毫秒）
    status: TraceStatus
    summary: str               # 一句话摘要

    # 扩展 — LLM 调用层
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    model: Optional[str] = None
    llm_raw_output: Optional[str] = None   # 解析前原始输出

    # 扩展 — 匹配层
    queue_size: Optional[int] = None
    candidates_count: Optional[int] = None
    top_similarity: Optional[float] = None

    # 扩展 — 安全层
    filter_hits: Optional[list[str]] = None

    # 错误
    error_type: Optional[str] = None
    error_detail: Optional[str] = None


class Tracer:
    """追加 trace — 所有服务函数调用"""

    def __init__(self):
        self._traces: list[TraceEntry] = []

    def record(self, entry: TraceEntry):
        self._traces.append(entry)

    def last(self, n: int = 20) -> list[TraceEntry]:
        return self._traces[-n:]

    def by_node(self, node: str) -> list[TraceEntry]:
        return [t for t in self._traces if t.node == node]

    def errors(self) -> list[TraceEntry]:
        return [t for t in self._traces if t.status == TraceStatus.ERROR]
