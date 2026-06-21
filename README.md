# VibeChat — AI 驱动的情绪社交

基于情绪识别的匿名社交 Web 应用。输入一段文字 → AI 分析情绪 → 自动匹配情绪相近的人 → 匿名对话。

## 技术栈

- **后端**: FastAPI (Python)
- **前端**: Next.js (TypeScript)
- **AI**: 支持 OpenAI 和 Anthropic 双 API

## 快速开始

### 1. 环境配置

```bash
# 后端
cp server/.env.example server/.env
# 编辑 server/.env，填入 LLM API Key

# 前端
cp client/.env.local.example client/.env.local
```

### 2. 安装依赖

```bash
# 后端
cd server && pip install -r requirements.txt

# 前端
cd client && npm install
```

### 3. 启动

```bash
# 终端 1: 后端
cd server && uvicorn main:app --reload

# 终端 2: 前端
cd client && npm run dev
```

访问 http://localhost:3000

## LLM API 配置

### 使用 OpenAI

```bash
# server/.env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key
OPENAI_MODEL=gpt-4o
```

### 使用 Anthropic

```bash
# server/.env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-key
ANTHROPIC_MODEL=claude-sonnet-4-6
```

### 使用兼容 API（如 DeepSeek）

```bash
LLM_PROVIDER=openai
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-chat
OPENAI_API_KEY=your-key
```

## 演示

单人演示匹配流程：

1. 浏览器窗口 1（普通模式）→ 输入情绪 → 等待匹配
2. 浏览器窗口 2（无痕模式）→ 输入情绪 → 自动匹配
3. 两者进入匿名聊天

或使用 Demo Seed API 注入假用户：

```bash
curl -X POST http://localhost:8000/api/demo/seed \
  -H "Content-Type: application/json" \
  -d '{"preset_emotion": "joy"}'
```

## 设计文档

见 [DESIGN.md](./DESIGN.md)
