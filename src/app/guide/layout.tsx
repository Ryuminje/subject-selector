import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { guideTitle } from "@/config/guide";

export const metadata: Metadata = {
  title: `${guideTitle} | 명신고등학교 업무 도구 모음`,
  description: "명신고등학교 업무 도구 모음의 쉬운 사용 설명서입니다.",
};

// 로그인 없이 누구나 읽을 수 있는 구역입니다(src/proxy.ts의 matcher는 /apps/schedule-helper 만 잡습니다).
export default function GuideLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-orange-50 text-stone-900 font-sans">
      <header className="print:hidden border-b border-stone-200 bg-white/90">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-800 bg-white rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            허브로 돌아가기
          </Link>
          <Link href="/guide" className="inline-flex items-center gap-1.5 text-sm font-bold text-stone-800 hover:text-amber-800">
            <BookOpen className="w-4 h-4" />
            {guideTitle}
          </Link>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
