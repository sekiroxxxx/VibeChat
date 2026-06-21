# VibeChat 设计文档

> AI 驱动的情绪社交 Web 应用 | FastAPI + Next.js 前后端分离
>
> **核心命题**：识别情绪 → 完成匹配 → 形成体验

---

## 目录

1. [产品定义](#1-产品定义)
2. [核心链路](#2-核心链路)
3. [数据 Schema](#3-数据-schema)
4. [会话状态机](#4-会话状态机)
5. [架构决策记录](#5-架构决策记录)
6. [存储层设计](#6-存储层设计)
7. [匹配引擎设计](#7-匹配引擎设计)
8. [安全设计](#8-安全设计)
9. [LLM Provider 设计](#9-llm-provider-设计)
10. [Prompt 设计](#10-prompt-设计)
11. [API 设计](#11-api-设计)
12. [SSE 输出契约](#12-sse-输出契约)
13. [前端设计](#13-前端设计)
14. [体验触点](#14-体验触点)
15. [v2 预留接口](#15-v2-预留接口)
16. [项目骨架](#16-项目骨架)
17. [配置 & 部署](#17-配置--部署)
18. [演示策略](#18-演示策略)

附录 A: [v1 功能清单](#附录-a-v1-功能清单) · 
附录 B: [v2 功能池](#附录-b-v2-功能池) · 
附录 C: [测试策略](#附录-c-测试策略)

---

## 1. 产品定义

### 1.1 6 个定位

| 维度 | 答案 |
|------|------|
| 问答型 / 操作型 / 混合型 | **混合型** — 情绪分析（问答）+ 匹配聊天（操作） |
| 单轮 / 短多轮 / 长多轮 | **短多轮** — 聊天上下文仅当前会话 |
| 实时 / 静态 / 两者 | **实时数据** — 无 RAG |
| 文本 / 结构化 / 两者 | **两者** — 情绪分析输出 JSON，聊天输出自然语言 |
| 只读 / 有副作用 | **有副作用** — 匹配出队、创建房间、发送消息 |
| 任务驱动 / 体验驱动 | **体验驱动** — "被理解"是核心价值 |

### 1.2 功能域 & 结构复杂度

- **功能域**：体验应用
- **结构复杂度**：L2（单 Agent + 工具）— 代码管线顺序调用，LLM 不路由

### 1.3 三层匹配模式

| 模式 | 描述 |
|------|------|
| **A. 智能推荐** | 系统用 `match_preferences.recommended[0]` 一键匹配 |
| **B. 引导选择** | 展示 2-3 个推荐方向，用户选一个 |
| **C. 自由选择** | 用户指定目标情绪类型（带安全约束） |

---

## 2. 核心链路

```
情绪输入 → LLM 分析 → 情绪画像 + 模式选择 → 匹配等待 → 匿名聊天 → 会话结束
                │                         │                      │
                ▼                         ▼                      ▼
         risk=HIGH → 关怀页(阻断)    匹配成功/超时/兜底       状态机: CLOSED
```

### 2.1 7 步流程

1. 用户输入情绪文字 → 引导式输入框 + 氛围背景
2. `POST /api/analyze` → LLM 分析 → 返回 EmotionAnalysis
3. 情绪画像展示 → 用户选择匹配模式（A/B/C）
4. `POST /api/match` → 入队 → 余弦相似度匹配 → 成功/等待/超时
5. 匹配成功 → 创建匿名会话（含开场白 + 情绪化匿名身份）
6. `GET /api/sessions/:id/stream` (SSE) → 收发消息
7. 离开 → 通知对方 → 会话关闭

### 2.2 记忆与上下文策略

| 层级 | 范围 | v1 实现 | 生命周期 |
|------|------|---------|---------|
| 会话上下文 | 单次聊天消息 | `ChatSession.messages` | 聊天期间 |
| 当前情绪 | 最近一次分析 | `UserState.current_emotion` | 用户会话 |
| 情绪历史 | 所有分析记录 | `UserState.emotion_history` (只追加) | 内存（重启清空） |

**v1 不做**：跨会话长期画像、Token 窗口管理（单次 < 50 轮）、对话摘要压缩

---

## 3. 数据 Schema

> 以下 Schema 在 v1 定义完整。v2 通过预留字段插入，不做 breaking change。

### 3.1 情绪分析结果

```typescript
interface EmotionAnalysis {
  // 情绪识别
  primary_emotion: string;
  secondary_emotion?: string;
  intensity: number;                  // 0-1
  valence: number;                    // -1 ~ 1
  emotion_vector: Record<string, number>;  // 多维分数 — 匹配算法输入
  interpretation: string;             // 共情解读 — 展示给用户
  keywords: string[];

  // 匹配引导
  match_preferences: {
    recommended: Array<{
      target_emotion: string;         // 推荐匹配的情绪类型
      reason: string;                 // 推荐理由 — 展示给用户
      priority: number;               // 1=最推荐
    }>;
    avoid?: string[];
  };

  // 安全标记
  safety: {
    risk_level: "NONE" | "MEDIUM" | "HIGH";
    risk_type: "self_harm" | "harm_others" | "crisis" | "none";
    suitable_for_chat: boolean;
    action: "allow_match" | "caution_match" | "show_resources";
    caution_message?: string;         // MEDIUM 时的温和提示
    resources?: string[];             // HIGH 时的求助热线
  };

  // 伪情绪检测
  authenticity: {
    is_genuine_emotion: boolean;
    flags: string[];
    confidence: number;
  };

  // v2 预留
  emotion_trajectory_hint?: string;
}
```

### 3.2 消息

```typescript
interface Message {
  id: string;
  session_id: string;
  type: "user" | "system";            // v2 扩展 "icebreaker" | "summary"
  sender_anonymous_id: string;
  content: string;
  timestamp: string;
}
```

### 3.3 用户状态

```typescript
interface UserState {
  user_id: string;
  auth_type: "guest";                 // v2 扩展 "token" | "oauth"
  anonymous_identity: string;         // 情绪衍生名称
  created_at: number;
  queue_entered_at?: number;

  current_emotion?: EmotionAnalysis;
  emotion_history: EmotionAnalysis[];

  match_status: "idle" | "analyzing" | "choosing" | "waiting"
              | "matched" | "chatting" | "disconnected";
  match_mode?: "auto" | "guided" | "free";
  target_emotion?: string;
  retry_count: number;                // 上限 3 — 防无限循环
  current_session_id?: string;

  trace: TraceEntry[];

  account_id: string | null;          // v2 预留
}
```

### 3.4 聊天会话

```typescript
interface ChatSession {
  session_id: string;
  user_a: { id: string; anonymous_name: string; emotion: EmotionAnalysis; };
  user_b: { id: string; anonymous_name: string; emotion: EmotionAnalysis; };
  shared_emotion_context: string;     // "你们都刚经历了一段担忧后的释然"
  opening_message: string;            // AI 开场白 (type: "system")
  messages: Message[];
  status: "active" | "closing" | "closed";
  risk_score: number;
  risk_flags: string[];
  created_at: string;
  closed_at?: string;
}
```

### 3.5 开场白

```typescript
interface OpeningMessage {
  opening_message: string;    // 共享开场白
  for_user_a: string;         // 用户 A 个性化引导
  for_user_b: string;         // 用户 B 个性化引导
}
```

### 3.6 API 请求/响应

```typescript
// POST /api/analyze
AnalyzeRequest  { text: string }        // 1-500 字符
AnalyzeResponse { analysis: EmotionAnalysis; anonymous_identity: string }

// POST /api/match
MatchRequest  { match_mode: "auto"|"guided"|"free"; target_emotion?: string; match_strategy: "similar" }
MatchResponse { matched: boolean; session?: ChatSession; fallback?: {...}; queue_position?: number }

// POST /api/sessions/:id/messages
SendMessageRequest { content: string }  // 1-1000 字符
```

### 源文件映射

| Schema | 文件 |
|--------|------|
| EmotionAnalysis, Message, UserState, ChatSession | `packages/shared/types.ts` |
| SSE 事件类型 | `packages/shared/sse-events.ts` |
| 后端 Pydantic 模型 | `server/models.py` |

### 3.7 数据流转 — 来源/消费表

> 每个字段必须标注来源节点和消费节点。不允许孤立字段。

**UserState**

| 字段 | 策略 | 来源 | 消费 |
|------|:--:|------|------|
| `user_id` | — | auth/guest | 全部 |
| `auth_type` | — | auth/guest | 前端 |
| `anonymous_identity` | overwrite | auth/guest, analyze | chat, match |
| `created_at` | — | auth/guest | cleanup |
| `current_emotion` | overwrite | analyze | show_result, match, chat, 前端情绪画像 |
| `emotion_history` | concat | analyze | v2 轨迹页 |
| `match_status` | overwrite | 全部节点 | 前端路由, match_queue |
| `match_mode` | overwrite | choose_mode | match_queue |
| `target_emotion` | overwrite | choose_mode | match_queue |
| `queue_entered_at` | overwrite | match_queue | match_queue, debug |
| `retry_count` | overwrite | match_queue, leave | match_queue |
| `current_session_id` | overwrite | match_queue, leave | chat, SSE, /api/me |
| `trace` | concat | 全部节点 | debug, v2 调试页 |
| `account_id` | — | v2 login | v2 长期画像 |

**ChatSession**

| 字段 | 策略 | 来源 | 消费 |
|------|:--:|------|------|
| `session_id` | — | match_queue | 全部聊天相关 |
| `user_a / user_b` | — | match_queue | chat header, opening_generator |
| `shared_emotion_context` | — | match_queue | chat header |
| `opening_message` | — | opening_generator | chat 首条消息 |
| `messages` | concat | send_message, opening_generator | SSE, 前端, content_filter |
| `status` | overwrite | leave, disconnect | SSE, 前端路由 |
| `risk_score` | overwrite | content_filter | v2 审核 |
| `risk_flags` | concat | content_filter, match_queue | v2 审核, debug |
| `created_at` | — | match_queue | 排序 |
| `closed_at` | overwrite | leave | 前端结束页 |

> concat = 追加（messages/trace/emotion_history/risk_flags），overwrite = 新值覆盖旧值。

---

## 4. 会话状态机

```
IDLE → ANALYZING → SHOWING_RESULT → CHOOSING_MODE → WAITING
                                                          │
                                    ┌─────────────────────┤
                                    ▼                     ▼                     ▼
                                MATCHED                 TIMEOUT              NO_MATCH
                                    │                     │                     │
                                    ▼                     ▼                     ▼
                               CHATTING               FALLBACK ──→ WAITING / IDLE
                                    │
                                    ▼
                              DISCONNECTED → CLOSED → IDLE

risk=HIGH → CARE (终止)
```

### 4.1 状态转换表

| 当前状态 | 触发事件 | 下一状态 | 副作用 |
|---------|---------|---------|--------|
| — | `POST /auth/guest` | IDLE | 创建 UserState |
| 页面刷新 | `GET /api/me` (cookie) | 恢复 | 如有 active session → 回聊天 |
| IDLE | `POST /analyze` | ANALYZING | — |
| ANALYZING | risk=HIGH | CARE | 阻断，展示关怀页 |
| ANALYZING | risk=NONE/MEDIUM | SHOWING_RESULT | 存储到 emotion_history |
| SHOWING_RESULT | 用户选择模式 | CHOOSING_MODE | — |
| CHOOSING_MODE | `POST /match` | WAITING | 入队 |
| WAITING | 匹配命中 | MATCHED | 出队双方，创建会话 |
| WAITING | 超时 + retry_count < 3 | FALLBACK | retry_count += 1 |
| WAITING | 超时 + retry_count >= 3 | FALLBACK | 强制随机匹配 |
| CHATTING | 对方离开 | DISCONNECTED | SSE STATUS 通知 |
| DISCONNECTED | 确认 | CLOSED | 清理会话 |
| CLOSED | 重新匹配 | IDLE | 重置状态 |

---

## 5. 架构决策记录

> 不可逆不是"v1 做完美"——是"v1 的设计必须允许 v2 的扩展"。

| # | 决策 | 选择 | v2 扩展路径 |
|:--:|------|------|-----------|
| 0 | 部署形态 | 前后端分离，单 repo 双目录 + packages/shared/ | packages/shared/ → npm 包 |
| 1 | State schema | 17 v1 字段 + 3 v2 预留 | account_id 启用登录 |
| 2 | 注册方式 | 3 个独立注册表：LLM Provider / 匹配策略 / 过滤规则 | YAML 驱动 |
| 3 | 编排模式 | 代码管线（async 链），LLM 不路由 | 图编排替换 |
| 4 | 消息/事件 schema | type: "user"\|"system"；SSE 5 种事件 | 扩展枚举值 |
| 5 | LLM 输出解析 | JSON Schema 校验 + parseError 显式标记 | 多版本兼容 |
| 6 | 内容格式 | 纯文本 | 可选 markdown |
| 7 | 共享类型 | packages/shared/ | npm 包 |
| A | 存储层隔离 | 4 个 Store 接口 + InMemory 实现 | Redis/DB |
| B | 实时通信 | SSE (推送) + HTTP POST (发送) | WebSocket 双向 |
| C | 游客持久化 | Cookie (httpOnly) 存 user_id | JWT Token |

### 管线错误边界

| 步骤 | 失败场景 | 行为 |
|------|---------|------|
| 情绪分析 | LLM 超时/JSON 畸形 | 重试一次 → 降级为默认情绪 |
| 情绪分析 | risk=HIGH | 阻断，跳关怀页 |
| 匹配入队 | 队列不可用 | 返回 error |
| 匹配超时 | retry_count < 3 | 兜底选项 |
| 匹配超时 | retry_count >= 3 | 强制随机匹配 |
| 发送消息 | 内容被过滤 | 返回拦截提示 |
| SSE | 连接中断 | 自动重连（3 次，间隔 2s） |

---

## 6. 存储层设计

4 个接口隔离存储——v1 内存实现，v2 换 Redis/DB 不改业务代码。

| 接口 | 方法 | v1 实现 |
|------|------|---------|
| `UserStore` | get / save / delete / list_stale | InMemoryUserStore (dict) |
| `SessionStore` | get / save / delete | InMemorySessionStore (dict) |
| `MatchQueue` | enqueue / dequeue / get_candidates / cleanup_stale | InMemoryMatchQueue (list + asyncio.Lock) |
| `NamePool` | allocate / release | InMemoryNamePool (按 valence 分区) |

源文件：`server/services/storage.py`

---

## 7. 匹配引擎设计

### 7.1 算法概要

```
1. 安全准入：跳过 risk=HIGH 的用户
2. 余弦相似度计算 user.emotion_vector ↔ other.emotion_vector
3. 超高相似降权：>0.98 → -0.3
4. 排序 → 从 top-3 随机选择（时间抖动）
5. 创建会话 → 双方出队
6. 无候选 + 超时 → 兜底
```

### 7.2 参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| SIMILARITY_THRESHOLD | 0.7 | 最低匹配门槛 |
| MATCH_TIMEOUT | 30s | 等待超时 |
| FALLBACK_THRESHOLD | 0.4 | 随机匹配门槛 |
| SIMILARITY_CEILING | 0.98 | 降权触发 |
| TOP_N_RANDOM | 3 | 时间抖动范围 |

源文件：`server/services/matcher.py`

---

## 8. 安全设计

### 8.1 四层防御

```
第 1 层 · 输入：risk_level (NONE/MEDIUM/HIGH) + authenticity 标记
        → HIGH 阻断匹配，代码层强制
第 2 层 · 匹配：时间抖动 + 超高相似降权 — 防暗号 rendezvous
第 3 层 · 对话：正则扫描（手机号/微信/URL/邮箱）→ 命中消息不发送
第 4 层 · 平台：聊天界面底部常驻举报入口
```

### 8.2 风险分级

| 等级 | 行为 |
|------|------|
| NONE | 三层匹配全开放 |
| MEDIUM | 限制模式 C 可选范围 + 温和提示 |
| HIGH | 代码强制阻断匹配 → 关怀页 + 求助热线 |

### 8.3 速率限制

`/api/analyze` 每用户每分钟 10 次（滑动窗口，内存计数）。

源文件：`server/lib/rate_limiter.py`、`server/services/content_filter.py`

---

## 9. LLM Provider 设计

### 9.1 接口

```python
class LLMProvider(ABC):
    async def analyze_emotion(self, text: str) -> dict: ...
    async def generate_opening_message(self, ea, eb, ctx) -> dict: ...
```

### 9.2 实现

| Provider | 配置 |
|----------|------|
| OpenAIProvider | `OPENAI_API_KEY` + `OPENAI_MODEL` (默认 gpt-4o) |
| AnthropicProvider | `ANTHROPIC_API_KEY` + `ANTHROPIC_MODEL` (默认 claude-sonnet-4-6) |

环境变量 `LLM_PROVIDER` 切换。

### 9.3 降级策略

LLM 失败 → 重试一次 → 仍失败 → `EMOTION_FALLBACK_DEFAULT`（中性情绪，可匹配任何人，前端展示温和提示）。

源文件：`server/lib/llm_provider.py`、`server/lib/fallback.py`、`server/lib/schema_validator.py`

---

## 10. Prompt 设计

### 10.1 组织

```
server/prompts/
├── analyze_emotion.md      # 情绪分析 System Prompt（核心资产）
├── opening_message.md      # 开场白生成 System Prompt
├── index.py                # AgentProfile 定义（Prompt + temperature + maxTokens 同置）
└── prompt-fixtures.json    # 5 条固定测试输入
```

### 10.2 AgentProfile

每个 Agent 节点的 Prompt、temperature、maxTokens 放在同一个 `AgentProfile` 中——改 temperature 和改 Prompt 是同一个变更单元。

| Profile | temperature | max_tokens |
|---------|:-----------:|:----------:|
| ANALYZE_PROFILE | 0.3（低温 — 情绪标签需要一致性） | 1024 |
| OPENING_PROFILE | 0.7（中温 — 开场白需要多样性） | 256 |

### 10.3 Prompt 测试闭环

5 条 fixtures（正常/极端/短文本/疑似暗号/混合情绪）→ 改 Prompt → 对比输出差异 → 确认符合预期 → 提交。

源文件：`server/prompts/`

---

## 11. API 设计

| 分组 | 端点 | v1 |
|------|------|:--:|
| 认证 | `POST /api/auth/guest` | ✅ |
| | `GET /api/me` | ✅ |
| 情绪 | `POST /api/analyze` | ✅ |
| 匹配 | `POST /api/match` / `DELETE /api/match` | ✅ |
| 会话 | `POST /api/sessions` / `GET /:id` / `POST /:id/leave` / `POST /:id/report` | ✅ |
| 消息 | `POST /api/sessions/:id/messages` | ✅ |
| 流 | `GET /api/sessions/:id/stream` (SSE) | ✅ |
| 演示 | `POST /api/demo/seed` | ✅ |
| 运维 | `GET /api/health` / `GET /api/debug/trace` | ✅ |

---

## 12. SSE 输出契约

### 12.1 事件类型

| 事件 | 何时 | data |
|------|------|------|
| `message` | 新消息 | Message 对象 |
| `status` | 会话状态变更 | `{ session_id, status, reason? }` |
| `notification` | 系统通知 | `{ level, content, dismissible }` |
| `error` | 错误 | `{ message, code, retryable }` |
| `heartbeat` | 每 30s | 空 — 防止代理超时 |

源文件：`packages/shared/sse-events.ts`

### 12.2 连接规范

- 重连：断开后自动重连（最多 3 次），携带 `last_event_id`
- 僵死检测：10 秒无事件 → 视为僵死 → 重连
- 心跳：30 秒间隔

### 12.3 内容格式约定

Agent 输出 **纯文本**。v2 如需 markdown → Prompt 同步改 + 前端集成 react-markdown。

---

## 13. 前端设计

### 13.1 页面路由

| 路由 | 页面 |
|------|------|
| `/` | 情绪输入 |
| `/result` | 情绪画像 + 匹配模式选择 |
| `/waiting` | 匹配等待 |
| `/chat/:id` | 匿名聊天 |
| `/care` | 关怀页（极端情绪） |
| `/closed` | 会话结束 |

### 13.2 组件树

```
App
├── EmotionInput        引导式输入 + 氛围背景
├── EmotionResult       情绪卡片 + 匹配模式选择器
├── MatchWaiting        等待动画 + 动态文案
├── ChatRoom
│   ├── ChatHeader      共享情绪 + 匿名身份
│   ├── MessageList     消息列表 + SystemBubble / UserBubble
│   ├── MessageInput    输入框
│   └── ReportButton    举报入口
├── CarePage            关怀页
└── Shared
    ├── Icon            统一图标组件
    └── EmotionColor    情绪-颜色映射
```

源文件：`client/constants/emotion-colors.ts`、`client/constants/anonymous-names.ts`

---

## 14. 体验触点

| # | 触点 | 用户感受 | v1 实现 |
|:--:|------|---------|---------|
| 1 | 情绪输入 | 引导式，不冰冷 | 渐变背景 + placeholder 轮换 |
| 2 | 情绪画像 | "被读懂了" | emoji + 颜色卡片 + 共情解读 |
| 3 | 匹配等待 | 氛围而非焦虑 | 动态文案 + 微动效 |
| 4 | 匹配成功 | 情绪连接 | 共享卡片 + 匿名身份 + 开场白 |
| ★ | 安全触点 | 关怀而非错误 | CarePage + 求助资源 |

---

## 15. v2 预留接口

| 预留点 | v1 定义 | v2 启用 |
|--------|---------|---------|
| `match_strategy` | `"similar"` | `"complementary"` `"room"` |
| `room_size` | 常量 2 | 可配置 |
| `emotion_history` | `[]` | 轨迹可视化 |
| `Message.type` | `"user" \| "system"` | `"icebreaker"` `"summary"` |
| `risk_score` | 累积 | 自动审核 |
| `account_id` | null | 登录系统 |
| `<Icon>` 组件 | emoji | SVG |
| 动态主题 | CSS 变量 | 按情绪调整 |

---

## 16. 项目骨架

```
VibeChat/
├── DESIGN.md                   本文件
├── packages/shared/            前后端共享类型
│   ├── types.ts               EmotionAnalysis, Message, UserState, ChatSession
│   └── sse-events.ts          SSE 事件类型
├── server/                     FastAPI 后端
│   ├── routes/                 auth / analyze / match / sessions / messages / stream / demo / debug / health
│   ├── services/               analyzer / matcher / session_manager / content_filter / storage / name_pool / cleanup
│   ├── lib/                    llm_provider / openai_provider / anthropic_provider / schema_validator / rate_limiter / tracer / fallback
│   ├── prompts/                analyze_emotion.md / opening_message.md / index.py / prompt-fixtures.json
│   ├── tests/                  test_content_filter / test_matcher / test_schema_validator / mock_llm
│   └── .env.example
├── client/                     Next.js 前端
│   ├── app/                    6 个页面路由
│   ├── components/             EmotionInput / EmotionCard / MatchModeSelector / WaitingAnimation / ChatRoom / CarePage / shared
│   ├── hooks/                  useEmotionAnalysis / useMatch / useChat / useSSE
│   ├── constants/              emotion-colors.ts / anonymous-names.ts
│   └── api/                    client.ts
└── deploy/                     nginx.conf / docker-compose.yml
```

**硬约束**：`client/` 不 import `server/`，`server/` 不 import `client/`。共享类型通过 `packages/shared/`。API Key 只在 server 侧。

---

## 17. 配置 & 部署

### 17.1 环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `LLM_PROVIDER` | openai / anthropic | openai |
| `OPENAI_API_KEY` | OpenAI API Key | sk-xxx |
| `OPENAI_MODEL` | 模型名称 | gpt-4o |
| `ANTHROPIC_API_KEY` | Anthropic API Key | sk-ant-xxx |
| `ANTHROPIC_MODEL` | 模型名称 | claude-sonnet-4-6 |
| `CORS_ORIGIN` | 前端域名 | http://localhost:3000 |
| `MATCH_SIMILARITY_THRESHOLD` | 匹配门槛 | 0.7 |
| `MATCH_TIMEOUT` | 等待超时(秒) | 30 |
| `DEMO_MODE_ENABLED` | 演示模式 | true |

### 17.2 部署拓扑

```
Internet → Nginx/Vercel → 前端 Next.js (Vercel)
                       → 后端 FastAPI :8000 (Railway/Render/Docker)
```

| 方案 | 适用 |
|------|------|
| Vercel + Railway | 推荐 — 免费额度够演示 |
| 单机 Docker | 一个 VPS 全跑 |

### 17.3 SSE 特殊配置

Nginx `proxy_buffering off` + `proxy_read_timeout 600s`。源文件：`deploy/nginx.conf`

### 17.4 健康检查

`GET /health` — 200 就绪，503 启动中。`SIGTERM` → 通知活跃连接 → 等待 10s → 退出。

---

## 18. 演示策略

| 方案 | 操作 |
|------|------|
| A | 两个浏览器窗口（普通 + 无痕）各输入情绪 → 自动匹配 |
| B（推荐） | `POST /api/demo/seed` 注入假用户到队列 → 自动匹配 → 假用户自动回复 |

预设情绪：joy / anxiety / sadness / calm。源文件：`server/services/demo.py`

---

## 附录 A: v1 功能清单

- [ ] 游客身份创建 (POST /api/auth/guest) + cookie 持久化
- [ ] 用户状态恢复 (GET /api/me)
- [ ] 内存清理定时任务
- [ ] 重试上限保护 (retry_count >= 3)
- [ ] 情绪输入页面（引导式文案 + 氛围背景）
- [ ] LLM 情绪分析（多维向量 + 共情解读 + 安全分级 + 伪情绪标记）
- [ ] JSON Schema 校验 + 降级
- [ ] 情绪画像展示
- [ ] 三层匹配模式选择
- [ ] 匹配队列 + 余弦相似度 + 时间抖动 + 超高相似降权
- [ ] 匹配超时 + 兜底选项
- [ ] 匿名聊天（消息发送/展示/时间戳）
- [ ] AI 开场白
- [ ] 情绪化匿名身份（名称池）
- [ ] 对话内容安全扫描
- [ ] 举报入口
- [ ] 极端情绪关怀页
- [ ] MEDIUM 温和提示
- [ ] 会话生命周期
- [ ] 对方离开通知
- [ ] 离开后可重新匹配
- [ ] LLM Provider 接口 + OpenAI + Anthropic 双实现
- [ ] 环境变量切换 LLM Provider
- [ ] 情绪分析 System Prompt
- [ ] 开场白生成 Prompt
- [ ] AgentProfile 定义
- [ ] LLM 输出解析器
- [ ] Prompt 测试闭环
- [ ] 速率限制
- [ ] 存储接口定义
- [ ] InMemory 存储实现
- [ ] `<Icon>` 组件 + 情绪-颜色映射
- [ ] SSE 事件类型定义
- [ ] SSE 连接 + 重连 + 僵死检测
- [ ] Demo Seed API
- [ ] 健康检查 + 启动就绪
- [ ] Trace 记录
- [ ] 调试端点
- [ ] EMOTION_FALLBACK_DEFAULT 降级默认值
- [ ] OpeningMessage 类型定义
- [ ] 内容过滤单元测试
- [ ] 匹配器单元测试
- [ ] Schema 校验单元测试
- [ ] Mock LLM Provider
- [ ] Nginx 配置
- [ ] Docker Compose
- [ ] 优雅关闭
- [ ] FastAPI + Next.js 前后端分离
- [ ] README（双 API 配置说明 + 启动方式 + 演示说明 + 部署地址）

## 附录 B: v2 功能池

- [ ] 互补情绪匹配
- [ ] 多人情绪房间
- [ ] 情绪轨迹可视化
- [ ] 对话冷场检测 + 温和提醒
- [ ] AI 情绪总结（会话结束）
- [ ] 对话破冰建议
- [ ] 阅后即焚选项
- [ ] 动态主题 + 动画/动效
- [ ] 风险自动审核
- [ ] 长期情绪画像
- [ ] 用户账号体系

## 附录 C: 测试策略

| 层 | 测什么 | 优先级 |
|----|--------|:--:|
| 纯函数 | 内容过滤、余弦相似度、JSON 解析降级 | 🔴 |
| 集成 | 分析→匹配→会话 全链路（手动 / Demo Seed） | 🔴 |
| Mock LLM | Schema 校验逻辑、降级路径 | 🟡 |
| 前端 | 组件三态 (empty/loading/error) | 🟡 |

v1 不追求覆盖率。E2E（Playwright）、CI、前端组件测试推至 v2。

源文件：`server/tests/test_content_filter.py`、`test_matcher.py`、`test_schema_validator.py`、`mock_llm.py`
