/**
 * Mock 模式管理器
 * - 首次访问 ?mock=1 → 写入 sessionStorage，后续所有 API 走 mock
 * - 跨路由切换自动保持 mock 状态
 * - 关闭：清除 sessionStorage 或访问 ?mock=0
 */

const STORAGE_KEY = "vb_mock_mode";

export function isMockMode(): boolean {
  if (typeof window === "undefined") return false;
  // 每次读取 URL 参数，允许 ?mock=0 关闭
  const sp = new URLSearchParams(window.location.search);
  if (sp.has("mock")) {
    const v = sp.get("mock");
    if (v === "0") { sessionStorage.removeItem(STORAGE_KEY); return false; }
    sessionStorage.setItem(STORAGE_KEY, "1");
    return true;
  }
  return sessionStorage.getItem(STORAGE_KEY) === "1";
}

/** 初始化 mock 模式（在 layout 或 AuthGate 中调用一次） */
export function initMockMode(): void {
  isMockMode(); // 触发 URL 参数读取
}
