# VibeChat 开发任务计划

> 开发完成后删除此文件。

## 对话 A：后端实现（串行）

### A1. 组1 — 零依赖模块
- [ ] `server/routes/health.py` — GET /health 返回 200
- [ ] `server/routes/auth.py` — POST /auth/guest 生成 UUID + Set-Cookie；GET /me 查状态
- [ ] `server/services/cleanup.py` — 启动后台定时任务，清理僵尸用户
- [ ] `server/main.py` — 启动时初始化 store/provider，注册 cleanup 任务

### A2. 组2 — 情绪分析
- [ ] `server/services/analyzer.py` — 实现 analyze()：调 LLM → schema 校验 → 降级 → HIGH 阻断
- [ ] `server/routes/analyze.py` — POST /analyze：校验输入长度 → 调 analyzer → 返回结果

### A3. 组3 — 匹配引擎
- [ ] `server/services/matcher.py` — 实现 match_user()：安全准入 → 余弦相似度 → 降权 → 时间抖动 → 创建会话
- [ ] `server/routes/match.py` — POST /match：入队 → 定时扫描 → 返回结果或兜底；DELETE /match 取消

### A4. 组4 — 会话 & 聊天
- [ ] `server/services/session_manager.py` — 实现 create/close/leave
- [ ] `server/routes/sessions.py` — 4 个端点
- [ ] `server/routes/messages.py` — POST /messages：扫描 → 追加 → 推送
- [ ] `server/routes/stream.py` — SSE：message/status/heartbeat 事件

### A5. 收尾
- [ ] `server/routes/demo.py` — POST /demo/seed 注入假用户
- [ ] `server/routes/debug.py` — GET /debug/trace 返回 trace
- [ ] 手动 curl 测试全链路

---

## 对话 B：前端实现（可并行）

### B1. 基础
- [ ] `client/components/shared/Icon.tsx` — emoji 统一组件
- [ ] `client/components/shared/EmotionColor.tsx` — 情绪-颜色组件
- [ ] `client/hooks/useEmotionAnalysis.ts` — 调 /api/analyze
- [ ] `client/hooks/useMatch.ts` — 调 /api/match
- [ ] `client/hooks/useChat.ts` — 消息管理
- [ ] `client/hooks/useSSE.ts` — SSE 连接 + 重连

### B2. 页面（按用户流程）
- [ ] `client/app/page.tsx` — 情绪输入页（EmotionInput + MoodBackground + AnalyzeButton）
- [ ] `client/app/care/page.tsx` — 关怀页（CareMessage + ResourceList）
- [ ] `client/app/result/page.tsx` — 情绪画像页（EmotionCard + MatchModeSelector）
- [ ] `client/app/waiting/page.tsx` — 匹配等待页（WaitingAnimation + DynamicStatus）
- [ ] `client/app/chat/[id]/page.tsx` — 聊天页（ChatHeader + MessageList + MessageInput + ReportButton）
- [ ] `client/app/closed/page.tsx` — 结束页

### B3. 收尾
- [ ] 页面间路由跳转 + 状态管理
- [ ] 三态处理（empty/loading/error）
- [ ] 响应式布局

---

## 依赖关系

```
对话 A 后端：
  A1 ──→ A2 ──→ A3 ──→ A4 ──→ A5
         │      │      │
         共享类型  匹配逻辑 SSE 契约
         │      │      │
对话 B 前端：  │      │      │
  B1 ──→ B2 ──→ B3
  组件+hooks  页面  收尾
  (可 mock API 独立开发)
```

## 预计时间

| 对话 | 预计 |
|------|------|
| A 后端 | 3-4 小时 |
| B 前端 | 3-4 小时 |
| **并行总时间** | **~4 小时** |
