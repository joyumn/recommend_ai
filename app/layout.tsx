import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "몸친 — 뭘, 어떤 부분을, 얼마나 먹을지",
  description: "목표 체중에 맞춰 운동 계획을 세우고, 사진 한 장으로 어떤 부분을 얼마나 먹을지 알려줍니다.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        <div className="mx-auto min-h-screen w-full max-w-[480px] bg-bg shadow-sm">{children}</div>
      </body>
    </html>
  );
}
