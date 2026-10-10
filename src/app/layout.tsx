import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// 본문·제목 공통 글꼴. 가변 글꼴 한 파일(굵기 45~920)을 앱에 함께 실어 보내므로 PC에 설치돼
// 있지 않아도 같게 보입니다. 파일은 npm 패키지 pretendard(OFL-1.1)에서 가져옵니다.
const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
  fallback: ["Malgun Gothic", "Apple SD Gothic Neo", "system-ui", "sans-serif"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "명신고등학교 업무 도구 모음",
  description: "명신고등학교 업무를 위해 필요한 다양한 프로그램 모음입니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${pretendard.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
