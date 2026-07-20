import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { ScheduleProvider } from "@/features/schedule-helper/lib/ScheduleContext";

const notoSansKR = Noto_Sans_KR({ subsets: ["latin"], weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: "명신고등학교 수업교체 도우미",
  description: "선생님들을 위한 수업교체 및 협의회 시간 탐색",
};

export default function ScheduleHelperLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${notoSansKR.className} bg-teal-50 text-slate-800 min-h-screen`}>
      <ScheduleProvider>{children}</ScheduleProvider>
    </div>
  );
}
