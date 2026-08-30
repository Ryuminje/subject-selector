import type { Metadata } from "next";
import { Noto_Sans_KR, Song_Myung } from "next/font/google";

const notoSansKR = Noto_Sans_KR({ subsets: ["latin"], weight: ["400", "500", "700"] });
const songMyung = Song_Myung({ weight: "400", variable: "--font-display" });

export const metadata: Metadata = {
  title: "업무 AI 파트너 | 쌤스 헬퍼",
  description: "내 업무 자료를 올려두고 그 자료로만 답하는 챗봇",
};

// 2026-08-30 디자인 개편: 다른 두 앱과 같은 중립 종이색 배경으로 통일하고, 강조색만
// assist 토큰(세이지)으로 이 앱을 구분합니다. 예전의 흐릿한 원형 배경(blob)은
// 전형적인 "AI가 만든 대시보드" 장식이라 걷어냈습니다.
export default function AssistantLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`${notoSansKR.className} ${songMyung.variable} bg-[#F1EEE6] text-[#221F1A] min-h-screen`}>
      {children}
    </div>
  );
}
