"""
匹配引擎
★ 余弦相似度 + 时间抖动 + 超高相似降权
"""

import time
import random
import math


# 可配置参数
SIMILARITY_THRESHOLD = 0.7       # 余弦相似度最低匹配门槛
MATCH_TIMEOUT = 30               # 等待超时（秒）
FALLBACK_THRESHOLD = 0.4         # 随机匹配降低后的门槛
SIMILARITY_CEILING = 0.98        # 超高相似降权触发
SIMILARITY_CEILING_PENALTY = 0.3 # 降权幅度
TOP_N_RANDOM = 3                 # 从 top-N 候选中随机


def cosine_similarity(a: dict[str, float], b: dict[str, float]) -> float:
    """余弦相似度 — 两个情绪向量"""
    keys = set(a) | set(b)
    dot = sum(a.get(k, 0) * b.get(k, 0) for k in keys)
    mag_a = math.sqrt(sum(v ** 2 for v in a.values()))
    mag_b = math.sqrt(sum(v ** 2 for v in b.values()))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


async def match_user(user: dict, match_queue, session_store, opening_generator):
    """
    输入：已入队的用户 + MatchQueue + SessionStore 接口
    输出：MatchResult
    """
    candidates = []

    for other in await match_queue.get_candidates():
        if other["user_id"] == user["user_id"]:
            continue

        # 安全准入
        safety = other.get("current_emotion", {}).get("safety", {})
        if safety.get("risk_level") == "HIGH":
            continue
        if not safety.get("suitable_for_chat", True):
            continue

        # 相似度计算
        vec_a = user["current_emotion"]["emotion_vector"]
        vec_b = other["current_emotion"]["emotion_vector"]
        sim = cosine_similarity(vec_a, vec_b)

        near_identical = False
        if sim > SIMILARITY_CEILING:
            sim -= SIMILARITY_CEILING_PENALTY
            near_identical = True

        if sim > SIMILARITY_THRESHOLD:
            candidates.append((other, sim, near_identical))

    if not candidates:
        wait_time = time.time() - (user.get("queue_entered_at") or 0)
        if wait_time > MATCH_TIMEOUT:
            return {"matched": False, "fallback": {
                "type": "timeout",
                "options": ["retry", "random_match", "leave"]
            }}
        return {"matched": False, "queue_position": len(await match_queue.get_candidates())}

    # 时间抖动
    top = sorted(candidates, key=lambda x: x[1], reverse=True)[:TOP_N_RANDOM]
    matched_user, score, near_identical = random.choice(top)

    # 创建会话
    session = {
        "session_id": _uuid(),
        "user_a": {"id": user["user_id"], "anonymous_name": user["anonymous_identity"],
                     "emotion": user["current_emotion"]},
        "user_b": {"id": matched_user["user_id"], "anonymous_name": matched_user["anonymous_identity"],
                     "emotion": matched_user["current_emotion"]},
        "shared_emotion_context": _build_context(user["current_emotion"], matched_user["current_emotion"]),
        "opening_message": await opening_generator(user["current_emotion"], matched_user["current_emotion"]),
        "messages": [],
        "status": "active",
        "risk_score": 0,
        "risk_flags": ["near_identical_match"] if near_identical else [],
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    await match_queue.dequeue(user["user_id"])
    await match_queue.dequeue(matched_user["user_id"])
    await session_store.save(session)
    return {"matched": True, "session": session}


def _uuid():
    import uuid
    return str(uuid.uuid4())

def _build_context(ea, eb):
    """构建共享情绪上下文"""
    return f"你们都带着'{ea['primary_emotion']}'和'{eb['primary_emotion']}'的情绪来到了这里"
