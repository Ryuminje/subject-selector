"use client";

// PDF 다듬이 — 파일을 한 번 올리고, 미리보기를 보며 원하는 기능만 골라 한 번에 적용하는 한 화면짜리 앱.
// 다른 쌤스 헬퍼 앱(연수 이수증 수거 등)과 같은 뼈대입니다: 맨 위 줄(허브로 돌아가기·앱 전환·계정) + 강조색 배너.

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import AppSwitcher from "@/features/schedule-helper/components/AppSwitcher";
import { Workbench } from "./components/Workbench";

export function PdfToolsApp() {
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    router.push("/apps/schedule-helper/login?next=" + encodeURIComponent("/apps/schedule-helper/pdf"));
  };

  return (
    <main className="max-w-[1920px] mx-auto px-2 md:px-6 py-6 w-full">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/80 hover:bg-white text-pdf text-sm font-medium rounded-[10px] border border-pdf/20 shadow-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            허브로 돌아가기
          </Link>
          <AppSwitcher tone="pdf" />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/apps/schedule-helper/account"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/80 hover:bg-white text-stone-500 hover:text-pdf text-sm font-medium rounded-[10px] border border-stone-200 transition-colors"
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

      <div className="bg-pdf p-6 md:p-8 rounded-[14px] text-white mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl mb-2">PDF 다듬이</h1>
          <p className="text-white/80 font-medium text-sm md:text-base">
            PDF를 한 번 올려 합치고, 나누고, 용량을 줄이고, 암호를 풀어요. 필요한 기능만 골라 한 번에 적용합니다
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/15 text-white text-sm font-semibold rounded-[10px] border border-white/30 shrink-0">
          <ShieldCheck className="w-4 h-4" />
          서버 전송 없음 · 이 브라우저에서만 처리
        </span>
      </div>

      <Workbench />
    </main>
  );
}
