import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";

const notoSansKR = Noto_Sans_KR({ subsets: ["latin"], weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: "업무 AI 파트너 | 쌤스 헬퍼",
  description: "내 업무 자료를 올려두고 그 자료로만 답하는 챗봇",
};

// 색은 수강신청 자료 정리 도우미와 같은 크림/앰버 톤입니다. 연수 이수증 수거(teal)와
// 나란히 놓았을 때 서로 다른 도구라는 게 색으로 먼저 구분되게 하려는 의도입니다.
export default function AssistantLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`${notoSansKR.className} bg-orange-50 text-stone-900 min-h-screen relative`}>
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-amber-300/25 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-rose-300/20 blur-[120px]" />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
