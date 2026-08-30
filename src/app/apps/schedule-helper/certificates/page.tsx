"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { ArrowLeft, LogOut, Loader2, KeyRound, UserPlus } from "lucide-react";
import AppSwitcher from "@/features/schedule-helper/components/AppSwitcher";
import CertificatesTabs from "@/features/schedule-helper/components/certificates/CertificatesTabs";

export default function CertificatesPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const handleLogout = async () => {
    await signOut();
    router.push("/apps/schedule-helper/login?next=" + encodeURIComponent("/apps/schedule-helper/certificates"));
  };

  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-cert">
        <Loader2 className="w-12 h-12 animate-spin mb-4" />
        <p className="text-lg font-semibold">불러오는 중...</p>
      </div>
    );
  }

  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <main className="max-w-[1920px] mx-auto px-2 md:px-6 py-6 w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/80 hover:bg-white text-cert text-sm font-medium rounded-[10px] border border-cert/20 shadow-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            허브로 돌아가기
          </Link>
          <AppSwitcher tone="cert" />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/apps/schedule-helper/account"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/80 hover:bg-white text-stone-500 hover:text-cert text-sm font-medium rounded-[10px] border border-stone-200 transition-colors"
          >
            <KeyRound className="w-4 h-4" />
            비밀번호 변경
          </Link>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/80 hover:bg-white text-stone-500 hover:text-rose-600 text-sm font-medium rounded-[10px] border border-stone-200 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </div>

      {/* 그라데이션+이모지 배너 대신 강조색 하나로 차분하게 (2026-08-30 개편) */}
      <div className="bg-cert p-6 md:p-8 rounded-[14px] text-white mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl mb-2">연수 이수증 수거</h1>
          <p className="text-white/80 font-medium text-sm md:text-base">
            이수증 제출부터 QR 서명 수거까지 한 곳에서 관리합니다
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/apps/schedule-helper/accounts"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 text-white text-sm font-semibold rounded-[10px] border border-white/30 transition-colors shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">계정 관리</span>
          </Link>
        )}
      </div>

      <CertificatesTabs isAdmin={isAdmin} />
    </main>
  );
}
