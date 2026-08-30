import type { Metadata } from "next";
import { Noto_Sans_KR, Song_Myung } from "next/font/google";
import { ScheduleProvider } from "@/features/schedule-helper/lib/ScheduleContext";

const notoSansKR = Noto_Sans_KR({ subsets: ["latin"], weight: ["400", "500", "700"] });
// 큰 제목 전용 세리프 — globals.css의 .font-display가 이 변수를 읽습니다.
const songMyung = Song_Myung({ weight: "400", variable: "--font-display" });

export const metadata: Metadata = {
  title: "수업교체 도우미 | 쌤스 헬퍼",
  description: "선생님들을 위한 수업교체 및 협의회 시간 탐색",
};

// 2026-08-30 디자인 개편: teal-50 파스텔 워시 대신 따뜻한 중립 종이색.
export default function ScheduleHelperLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${notoSansKR.className} ${songMyung.variable} bg-[#F1EEE6] text-[#221F1A] min-h-screen`}>
      <ScheduleProvider>{children}</ScheduleProvider>
    </div>
  );
}
