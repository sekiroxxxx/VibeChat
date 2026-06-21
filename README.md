# VibeChat — AI 驱动的情绪社交

基于情绪识别的匿名社交 Web 应用。输入一段文字 → AI 分析情绪 → 自动匹配情绪相近的人 → 匿名对话。

> "被理解"是核心价值，而非"连接"。

---

## 核心功能

| 功能 | 说明 |
|------|------|
| 🎭 **情绪分析** | LLM 多维度分析：主次情绪、强度、效价、多维向量 + 共情解读 |
| 🔗 **智能匹配** | 余弦相似度 + 时间抖动 + 超高相似降权，三种匹配模式（智能推荐/引导选择/自由选择） |
| 💬 **匿名聊天** | AI 开场白 + 情绪化匿名身份 + SSE 实时推送 |
| 🛡️ **安全防护** | 四层防御：风险分级阻断 + 内容正则扫描 + 伪情绪检测 + 举报入口 |
| 💛 **关怀页** | 极端情绪（risk=HIGH）自动阻断，展示求助热线 |
| 🧪 **演示模式** | Demo Seed API 注入假用户，单人即可跑通全流程 |

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | **Next.js 14** · React 18 · TypeScript · SSE |
| 后端 | **FastAPI** · Python · uvicorn · asyncio |
| AI | OpenAI / Anthropic / DeepSeek（可切换） |
| 共享类型 | `packages/shared/` — TypeScript 前后端同源 |
| 部署 | Docker Compose + Nginx（见 `deploy/`） |

---

## 项目结构

```
VibeChat/
├── README.md
├── DESIGN.md                     # 完整设计文档（架构/状态机/API/Schema/安全）
├── packages/shared/              # 前后端共享类型
│   ├── types.ts
│   └── sse-events.ts
├── server/                       # FastAPI 后端
│   ├── main.py                   # 入口
│   ├── config.py                 # 环境变量配置
│   ├── routes/                   # 9 个路由模块
│   ├── services/                 # 业务逻辑（匹配/分析/存储/过滤）
│   ├── lib/                      # 基础设施（LLM Provider/限流/降级）
│   ├── prompts/                  # System Prompt + AgentProfile
│   └── tests/                    # 单元测试 + Mock LLM
├── client/                       # Next.js 前端
│   ├── app/                      # 6 个页面路由
│   ├── components/               # UI 组件
│   ├── hooks/                    # useEmotionAnalysis / useMatch / useChat / useSSE
│   ├── api/client.ts             # HTTP 客户端
│   └── constants/                # 情绪-颜色映射 / 匿名名池
└── deploy/
    ├── docker-compose.yml
    └── nginx.conf
```

---

## 快速开始

### 1. 环境配置

```bash
# 后端
cp server/.env.example server/.env
# 编辑 server/.env，填入 LLM API Key 和模型

# 前端
cp client/.env.local.example client/.env.local
```

### 2. 安装依赖

```bash
# 后端 (Python ≥3.10)
cd server
pip install -r requirements.txt

# 前端
cd client
npm install
```

### 3. 启动

```bash
# 终端 1 — 后端
cd server
uvicorn main:app --host 0.0.0.0 --port 8000

# 终端 2 — 前端
cd client
npm run dev
```

访问 http://localhost:3000

---

## 单人演示

两种方式跑通全流程，不需要第二个人：

**方式 A — 两个浏览器窗口**

1. 窗口 1（普通模式）→ 输入情绪 → 等待匹配
2. 窗口 2（无痕模式）→ 输入情绪 → 自动匹配
3. 两者进入匿名聊天

**方式 B — Demo Seed API（推荐）**

```bash
curl -X POST http://localhost:8000/api/demo/seed \
  -H "Content-Type: application/json" \
  -d '{"preset_emotion": "joy"}'
```

预设情绪：`joy` · `anxiety` · `sadness` · `calm`

---

## LLM Provider 配置

### OpenAI

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key
OPENAI_MODEL=gpt-4o
```

### Anthropic Claude

```bash
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-key
ANTHROPIC_MODEL=claude-sonnet-4-6
```

### DeepSeek（兼容 OpenAI）

```bash
LLM_PROVIDER=openai
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-chat
OPENAI_API_KEY=your-key
```

---

## 线上演示

快速让外部人员预览（使用 Cloudflare Tunnel）：

```bash
# 安装 cloudflared
winget install --id Cloudflare.cloudflared

# 启动公网隧道
cloudflared tunnel --url http://localhost:3000
```

输出 `https://xxx.trycloudflare.com` 即为公网演示地址。

> 演示时需将 `client/.env.local` 中 `NEXT_PUBLIC_API_URL` 设为空字符串，并在 `next.config.js` 中添加 `rewrites` 代理 `/api/*` 到后端。详见 [DESIGN.md §17](./DESIGN.md#17-配置--部署)。

---

## 完整环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `LLM_PROVIDER` | `openai` | LLM 提供商 |
| `OPENAI_API_KEY` | — | OpenAI/兼容 API Key |
| `OPENAI_MODEL` | `gpt-4o` | 模型名称 |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | 自定义端点 |
| `ANTHROPIC_API_KEY` | — | Anthropic API Key |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | 模型名称 |
| `CORS_ORIGIN` | `http://localhost:3000` | 前端域名 |
| `MATCH_SIMILARITY_THRESHOLD` | `0.7` | 匹配相似度门槛 |
| `MATCH_TIMEOUT` | `30` | 匹配等待超时（秒） |
| `DEMO_MODE_ENABLED` | `true` | 演示模式开关 |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | 前端 API 地址 |

---

## 设计文档

架构设计、状态机、数据流向、API 契约、安全模型等详见 [DESIGN.md](./DESIGN.md)。

---

## License

MIT
