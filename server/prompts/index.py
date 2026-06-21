"""
Prompt 加载 + AgentProfile 定义
★ 每个 Agent 节点的 Prompt + 采样参数 + 输出 Schema 同置
"""

from dataclasses import dataclass

@dataclass
class AgentProfile:
    name: str
    system_prompt: str           # 从 .md 文件加载
    temperature: float
    max_tokens: int


def load_prompt(name: str) -> str:
    """加载 prompts/<name>.md"""
    import os
    path = os.path.join(os.path.dirname(__file__), name)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


ANALYZE_PROFILE = AgentProfile(
    name="emotion_analyzer",
    system_prompt=load_prompt("analyze_emotion.md"),
    temperature=0.3,             # 低温 — 情绪标签需要一致性
    max_tokens=2048,             # 完整 EmotionAnalysis JSON 需要 1.5-2K tokens
)

OPENING_PROFILE = AgentProfile(
    name="opening_generator",
    system_prompt=load_prompt("opening_message.md"),
    temperature=0.7,             # 中温 — 开场白需要多样性
    max_tokens=256,
)
