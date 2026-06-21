import "./globals.css";
import { AuthGate } from "@/components/shared/AuthGate";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
