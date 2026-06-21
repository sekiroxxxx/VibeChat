"use client";
/** /chat-history → 重定向到合并后的 /history */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ChatHistoryRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/history"); }, [router]);
  return null;
}
