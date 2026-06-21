"""应用配置 — 从环境变量加载"""
import os


class AppConfig:
    LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai")

    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
    OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")

    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
    ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
    ANTHROPIC_BASE_URL = os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com")

    SERVER_HOST = os.getenv("SERVER_HOST", "0.0.0.0")
    SERVER_PORT = int(os.getenv("SERVER_PORT", "8000"))
    CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:3000")

    MATCH_SIMILARITY_THRESHOLD = float(os.getenv("MATCH_SIMILARITY_THRESHOLD", "0.7"))
    MATCH_TIMEOUT = int(os.getenv("MATCH_TIMEOUT", "30"))
    MATCH_FALLBACK_THRESHOLD = float(os.getenv("MATCH_FALLBACK_THRESHOLD", "0.4"))

    DEMO_MODE_ENABLED = os.getenv("DEMO_MODE_ENABLED", "true").lower() == "true"


config = AppConfig()
