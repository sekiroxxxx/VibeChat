"""内存清理 — 定时清理僵尸用户"""
import asyncio


async def cleanup_loop(user_store, match_queue, interval_s: int = 60, idle_s: int = 1800):
    """每 60s 扫描：清理 idle > 30 分钟的无会话用户"""
    while True:
        stale_ids = await user_store.list_stale(idle_s)
        for uid in stale_ids:
            await match_queue.dequeue(uid)
            await user_store.delete(uid)
        await match_queue.cleanup_stale(idle_s)
        await asyncio.sleep(interval_s)
