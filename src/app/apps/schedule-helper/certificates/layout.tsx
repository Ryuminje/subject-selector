import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";

const notoSansKR = Noto_Sans_KR({ subsets: ["latin"], weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: "연수 이수증 수거 | 쌤스 헬퍼",
  description: "연수 이수증 제출, 조회, 서명 수거",
};

export default function CertificatesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className={`${notoSansKR.className} bg-teal-50 text-slate-800 min-h-screen`}>{children}</div>;
}
