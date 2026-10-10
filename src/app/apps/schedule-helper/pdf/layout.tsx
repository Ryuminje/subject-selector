import type { Metadata } from "next";
import { Song_Myung } from "next/font/google";

const songMyung = Song_Myung({ weight: "400", variable: "--font-display" });

export const metadata: Metadata = {
  title: "PDF 다듬이 | 쌤스 헬퍼",
  description: "PDF 합치기·나누기, 용량 줄이기, 암호 제거. 파일은 브라우저 안에서만 처리됩니다.",
};

// 다른 쌤스 헬퍼 앱(연수 이수증 수거, 업무 AI 파트너)과 같은 종이색 바탕·글꼴. 강조색만 pdf 토큰(벽돌)으로 구분합니다.
export default function PdfLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`font-sans ${songMyung.variable} bg-[#F1EEE6] text-[#221F1A] min-h-screen`}>
      {children}
    </div>
  );
}
