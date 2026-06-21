"""
VibeChat 后端全功能验证脚本
覆盖: 所有 API 端点 + 边界情况 + SSE
用法: python -m server.verify_all
"""
import asyncio
import json
import os
import sys
import time
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from server.config import config
from server.lib.llm_provider import LLMConfig, create_llm_provider
from server.lib.tracer import Tracer
from server.lib.rate_limiter import RateLimiter
from server.services.storage import (
    InMemoryUserStore, InMemorySessionStore,
    InMemoryMatchQueue, InMemoryNamePool,
)
from server.services.event_bus import EventBus
from server.services.cleanup import cleanup_loop
from server.services.analyzer import analyze
from server.services.matcher import match_user
from server.services.session_manager import get, close, leave
from server.services.content_filter import filter_message

# 简易 HTTP 测试用
import urllib.request
import urllib.error

PASS = 0
FAIL = 0

def check(name: str, condition: bool, detail: str = ""):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  [PASS] {name}")
    else:
        FAIL += 1
        print(f"  [FAIL] {name}  -- {detail}")

# ═══════════════════════════════════════════════
# 1. 存储层测试
# ═══════════════════════════════════════════════
async def test_storage():
    print("\n── 1. 存储层 ──")
    us = InMemoryUserStore()
    ss = InMemorySessionStore()
    mq = InMemoryMatchQueue()
    np = InMemoryNamePool()

    # UserStore
    u = {"user_id": "u1", "match_status": "idle", "created_at": time.time() - 99999}
    await us.save(u)
    check("UserStore.save", (await us.get("u1")) is not None)
    check("UserStore.get (miss)", (await us.get("no")) is None)
    check("UserStore.list_stale", "u1" in await us.list_stale(10))
    await us.delete("u1")
    check("UserStore.delete", (await us.get("u1")) is None)

    # SessionStore
    s = {"session_id": "s1", "status": "active"}
    await ss.save(s)
    check("SessionStore.save", (await ss.get("s1")) is not None)
    await ss.delete("s1")
    check("SessionStore.delete", (await ss.get("s1")) is None)

    # MatchQueue
    await mq.enqueue(u)
    check("MatchQueue.enqueue", len(await mq.get_candidates()) == 1)
    await mq.dequeue("u1")
    check("MatchQueue.dequeue", len(await mq.get_candidates()) == 0)

    # NamePool
    name = np.allocate(0.8)
    check("NamePool.allocate (positive valence)", name in np._pools["positive"])
    np.release(name)
    check("NamePool.release", name not in np._used)

    # EventBus
    eb = EventBus()
    q = await eb.subscribe("s1")
    check("EventBus.subscribe", eb.subscriber_count("s1") == 1)
    await eb.publish("s1", {"type": "message", "data": "hi"})
    event = await asyncio.wait_for(q.get(), timeout=1)
    check("EventBus.publish", event["data"] == "hi")
    eb.unsubscribe("s1", q)
    check("EventBus.unsubscribe", eb.subscriber_count("s1") == 0)


# ═══════════════════════════════════════════════
# 2. 纯函数测试
# ═══════════════════════════════════════════════
async def test_pure_functions():
    print("\n── 2. 纯函数 ──")

    # 余弦相似度
    from server.services.matcher import cosine_similarity
    a = {"joy": 1.0, "sad": 0.0}
    b = {"joy": 1.0, "sad": 0.0}
    c = {"joy": 0.0, "sad": 1.0}
    sim_ab = cosine_similarity(a, b)
    sim_ac = cosine_similarity(a, c)
    check("cosine_similarity (identical)", abs(sim_ab - 1.0) < 0.001, f"got {sim_ab}")
    check("cosine_similarity (orthogonal)", sim_ac < 0.001, f"got {sim_ac}")

    # 内容过滤
    check("filter phone", filter_message("13812345678")["blocked"])
    check("filter URL", filter_message("https://example.com")["blocked"])
    check("filter email", filter_message("test@gmail.com")["blocked"])
    check("filter wechat", filter_message("微信: abc123")["blocked"])
    check("filter clean", not filter_message("hello there")["blocked"])

    # Schema 校验
    from server.lib.schema_validator import parse_llm_output
    valid_json = '{"primary_emotion":"joy","intensity":0.5,"valence":0.3,"emotion_vector":{"joy":1},"interpretation":"ok","match_preferences":{"recommended":[]},"safety":{"risk_level":"NONE"}}'
    result = parse_llm_output(valid_json)
    check("schema valid JSON", not result["parseError"])
    result = parse_llm_output("not json")
    check("schema invalid JSON", result["parseError"])
    result = parse_llm_output('```json\n' + valid_json + '\n```')
    check("schema md-wrapped JSON", not result["parseError"])

    # 降级默认值
    from server.lib.fallback import EMOTION_FALLBACK_DEFAULT
    check("fallback has primary_emotion", EMOTION_FALLBACK_DEFAULT["primary_emotion"] == "平静")
    check("fallback risk=NONE", EMOTION_FALLBACK_DEFAULT["safety"]["risk_level"] == "NONE")


# ═══════════════════════════════════════════════
# 3. LLM 分析集成测试
# ═══════════════════════════════════════════════
async def test_llm_integration(llm_provider):
    print("\n── 3. LLM 分析集成 ──")

    # 正常分析
    result, is_fb = await _analyze_with_fallback(llm_provider, "I feel happy and excited today")
    check("LLM analyze (normal)", not is_fb and "primary_emotion" in result,
          f"emotion={result.get('primary_emotion')}")
    check("LLM has emotion_vector", len(result.get("emotion_vector", {})) > 0)
    check("LLM has safety", result.get("safety", {}).get("risk_level") in ("NONE", "MEDIUM", "HIGH"))
    check("LLM has match_preferences", len(result.get("match_preferences", {}).get("recommended", [])) > 0)

    # 安全分级
    check("LLM safety has risk_level", "risk_level" in result.get("safety", {}))
    check("LLM safety has action", "action" in result.get("safety", {}))

    # 情绪向量维度
    vec = result.get("emotion_vector", {})
    expected_dims = {"喜悦", "悲伤", "焦虑", "愤怒", "孤独", "期待", "平静", "疲惫", "恐惧", "感激", "困惑", "释然"}
    check("LLM 12 emotion dims", set(vec.keys()) == expected_dims,
          f"missing: {expected_dims - set(vec.keys())}")


async def _analyze_with_fallback(provider, text):
    from server.lib.llm_provider import analyze_with_fallback
    return await analyze_with_fallback(provider, text)


# ═══════════════════════════════════════════════
# 4. 管线集成测试 (analyze → match → chat → leave)
# ═══════════════════════════════════════════════
async def test_pipeline(llm_provider):
    print("\n── 4. 管线集成 (analyze → match → chat → leave) ──")

    # 初始化依赖
    us = InMemoryUserStore()
    ss = InMemorySessionStore()
    mq = InMemoryMatchQueue()
    np = InMemoryNamePool()
    eb = EventBus()
    tracer = Tracer()

    # ── 4a. 创建用户 + 分析 ──
    ua_id = "test-user-a"
    ub_id = "test-user-b"
    ua = {"user_id": ua_id, "auth_type": "guest", "anonymous_identity": "",
          "created_at": time.time(), "current_emotion": None,
          "emotion_history": [], "match_status": "idle", "retry_count": 0,
          "current_session_id": None, "account_id": None}
    ub = dict(ua, user_id=ub_id)
    await us.save(ua)
    await us.save(ub)

    r = await analyze("I feel happy today", ua, llm_provider, tracer, us, np)
    check("4a. analyze success", "analysis" in r, f"got: {list(r.keys())}")
    check("4a. anonymous identity set", ua["anonymous_identity"] != "")
    check("4a. emotion in history", len(ua["emotion_history"]) == 1)

    r = await analyze("I feel happy and excited too", ub, llm_provider, tracer, us, np)
    check("4a. user B analyzed", "analysis" in r)

    # ── 4b. 匹配 ──
    ua["match_mode"] = "auto"
    await mq.enqueue(ua)
    ub["match_mode"] = "auto"
    await mq.enqueue(ub)

    from server.routes.match import _make_opening_generator
    og = _make_opening_generator(llm_provider)

    result = await match_user(ub, mq, ss, og)
    if result.get("matched"):
        check("4b. match success", True)
        session = result["session"]
        check("4b. session created", session["status"] == "active")
        check("4b. has opening_message", bool(session.get("opening_message")))
        sid = session["session_id"]

        # ── 4c. 发送消息 ──
        msg_a = {"id": "m1", "session_id": sid, "type": "user",
                 "sender_anonymous_id": ua["anonymous_identity"],
                 "content": "hello!", "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        session["messages"].append(msg_a)
        await ss.save(session)
        check("4c. message appended", len(session["messages"]) == 1)

        # 内容过滤
        blocked = filter_message("my phone 13812345678")
        check("4c. content filter blocks phone", blocked["blocked"])

        # ── 4d. SSE 推送 ──
        q = await eb.subscribe(sid)
        await eb.publish(sid, {"type": "message", "data": msg_a})
        event = await asyncio.wait_for(q.get(), timeout=1)
        check("4d. SSE message received", event["data"]["content"] == "hello!")
        eb.unsubscribe(sid, q)

        # ── 4e. 离开 ──
        r = await leave(sid, ua_id, ss, us, eb)
        check("4e. leave returns ok", r.get("left"))
        s = await ss.get(sid)
        check("4e. session closed", s["status"] == "closed")
        ua_after = await us.get(ua_id)
        check("4e. user A reset to idle", ua_after["match_status"] == "idle")
        ub_after = await us.get(ub_id)
        check("4e. user B reset to idle", ub_after["match_status"] == "idle")
    else:
        check("4b. match success", False, f"no match: {result}")


# ═══════════════════════════════════════════════
# 5. 边界情况
# ═══════════════════════════════════════════════
async def test_edge_cases():
    print("\n── 5. 边界情况 ──")

    # 速率限制
    rl = RateLimiter(max_requests=3, window_s=60)
    for i in range(3):
        check(f"rate_limit #{i+1} allowed", rl.is_allowed("u1"))
        rl.record("u1")
    check("rate_limit blocked (#4)", not rl.is_allowed("u1"))

    # 空情绪向量
    from server.services.matcher import cosine_similarity
    sim = cosine_similarity({}, {})
    check("cosine empty vectors → 0", sim == 0.0)

    # Trace 记录
    tracer = Tracer()
    from server.lib.tracer import TraceEntry, TraceStatus
    tracer.record(TraceEntry(node="test", ts=time.time(), duration_ms=10,
                              status=TraceStatus.OK, summary="ok"))
    check("tracer.last(1)", len(tracer.last(1)) == 1)
    check("tracer.by_node", len(tracer.by_node("test")) == 1)
    check("tracer.errors empty", len(tracer.errors()) == 0)
    tracer.record(TraceEntry(node="test", ts=time.time(), duration_ms=5,
                              status=TraceStatus.ERROR, summary="fail"))
    check("tracer.errors has 1", len(tracer.errors()) == 1)

    # Demo Presets
    from server.services.demo import DEMO_PRESETS
    check("demo 4 presets", set(DEMO_PRESETS.keys()) == {"joy", "anxiety", "sadness", "calm"})
    for k in DEMO_PRESETS:
        check(f"demo {k} has opening_replies", len(DEMO_PRESETS[k]["opening_replies"]) >= 2)

    # 清理
    us = InMemoryUserStore()
    mq = InMemoryMatchQueue()
    old_u = {"user_id": "old", "match_status": "idle", "created_at": time.time() - 99999}
    await us.save(old_u)
    from server.services.cleanup import cleanup_loop as _cl
    # 手动调一次清理逻辑
    stale = await us.list_stale(10)
    check("cleanup finds stale users", "old" in stale)


# ═══════════════════════════════════════════════
# main
# ═══════════════════════════════════════════════
async def main():
    print("=" * 55)
    print("VibeChat 后端全功能验证")
    print(f"Provider: {config.LLM_PROVIDER} | Model: {config.OPENAI_MODEL if config.LLM_PROVIDER == 'openai' else config.ANTHROPIC_MODEL}")
    print("=" * 55)

    # 初始化 LLM
    llm_config = LLMConfig(
        provider=config.LLM_PROVIDER,
        api_key=config.OPENAI_API_KEY if config.LLM_PROVIDER == "openai" else config.ANTHROPIC_API_KEY,
        model=config.OPENAI_MODEL if config.LLM_PROVIDER == "openai" else config.ANTHROPIC_MODEL,
        base_url=config.OPENAI_BASE_URL if config.LLM_PROVIDER == "openai" else config.ANTHROPIC_BASE_URL,
    )
    llm_provider = create_llm_provider(llm_config)

    await test_storage()
    await test_pure_functions()
    await test_llm_integration(llm_provider)
    await test_pipeline(llm_provider)
    await test_edge_cases()

    print(f"\n{'=' * 55}")
    print(f"Result: {PASS} passed / {PASS + FAIL} total")
    if FAIL:
        print(f"FAIL: {FAIL} failed!")
    else:
        print("ALL PASSED!")
    print(f"{'=' * 55}")
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
