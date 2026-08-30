import type { Metadata } from "next";
import { Noto_Sans_KR, Song_Myung } from "next/font/google";

const notoSansKR = Noto_Sans_KR({ subsets: ["latin"], weight: ["400", "500", "700"] });
const songMyung = Song_Myung({ weight: "400", variable: "--font-display" });

export const metadata: Metadata = {
  title: "연수 이수증 수거 | 쌤스 헬퍼",
  description: "연수 이수증 제출, 조회, 서명 수거",
};

// 2026-08-30 디자인 개편: teal-50 → 중립 종이색 (강조색은 cert 토큰이 화면 안에서 냄).
export default function CertificatesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${notoSansKR.className} ${songMyung.variable} bg-[#F1EEE6] text-[#221F1A] min-h-screen`}>
      {children}
    </div>
  );
}
