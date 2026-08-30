"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { ArrowLeft, KeyRound, Loader2, LogOut } from "lucide-react";
import AppSwitcher from "@/features/schedule-helper/components/AppSwitcher";
import AssistantApp from "@/features/schedule-helper/components/assistant/AssistantApp";

export default function AssistantPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const handleLogout = async () => {
    await signOut();
    router.push("/apps/schedule-helper/login?next=" + encodeURIComponent("/apps/schedule-helper/assistant"));
  };

  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-assist">
        <Loader2 className="w-12 h-12 animate-spin mb-4" />
        <p className="text-lg font-semibold">불러오는 중...</p>
      </div>
    );
  }

  return (
    <main className="max-w-[1920px] mx-auto px-2 md:px-6 py-6 w-full">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/80 hover:bg-white text-assist text-sm font-medium rounded-[10px] border border-assist/20 shadow-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            허브로 돌아가기
          </Link>
          <AppSwitcher tone="assist" />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/apps/schedule-helper/account"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/80 hover:bg-white text-stone-500 hover:text-assist text-sm font-medium rounded-[10px] border border-stone-200 shadow-sm transition-colors"
          >
            <KeyRound className="w-4 h-4" />
            비밀번호 변경
          </Link>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/80 hover:bg-white text-stone-500 hover:text-rose-600 text-sm font-medium rounded-[10px] border border-stone-200 shadow-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </div>

      {/* 그라데이션+이모지 배너 대신 강조색 하나로 차분하게 (2026-08-30 개편) */}
      <div className="bg-assist p-6 md:p-8 rounded-[14px] text-white mb-8">
        <h1 className="font-display text-2xl md:text-3xl mb-2">업무 AI 파트너</h1>
        <p className="text-white/80 font-medium text-sm md:text-base">
          {session?.user?.name ? `${session.user.name} 선생님의 ` : ""}업무 자료를 올려두면, 그 자료만 근거로 답하는
          챗봇이 만들어집니다
        </p>
      </div>

      <AssistantApp />
    </main>
  );
}
