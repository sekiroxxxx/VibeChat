import "./globals.css";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthGate } from "@/components/shared/AuthGate";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" data-theme="day" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthGate>{children}</AuthGate>
        </ThemeProvider>
      </body>
    </html>
  );
}
