"use client";

import Link from "next/link";
import { useState } from "react";
import { useSchedule } from "@/features/schedule-helper/lib/ScheduleContext";
import { SHEET_EDIT_URL } from "@/features/schedule-helper/lib/sheetData";
import { ArrowLeft, ArrowLeftRight, Users, Ban, Loader2, ExternalLink } from "lucide-react";
import SwapTab from "@/features/schedule-helper/components/SwapTab";
import MeetingTab from "@/features/schedule-helper/components/MeetingTab";
import BlockTab from "@/features/schedule-helper/components/BlockTab";

export default function ScheduleHelperPage() {
  const { data, loading, error } = useSchedule();
  const [activeTab, setActiveTab] = useState<"swap" | "meeting" | "block">("swap");

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-teal-700">
        <Loader2 className="w-12 h-12 animate-spin mb-4" />
        <p className="text-lg font-semibold">시간표 로딩 중...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-red-600">
        <p className="text-lg font-semibold">데이터를 불러오는 중 오류가 발생했습니다.</p>
        <p className="text-sm mt-2">{error}</p>
      </div>
    );
  }

  return (
    <main className="max-w-[1920px] mx-auto px-2 md:px-6 py-6 w-full">
      {/* 허브로 돌아가기 */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 mb-4 px-3 py-1.5 bg-white/80 hover:bg-white text-teal-700 text-sm font-medium rounded-xl border border-teal-100 shadow-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        허브로 돌아가기
      </Link>

      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-500 p-6 md:p-8 rounded-3xl shadow-lg text-white mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2 flex items-center gap-2">
            <span>🗓️</span> 명신고등학교 수업교체 도우미
          </h1>
          <p className="text-emerald-50 font-medium text-sm md:text-base">
            설정 시트의 고정 데이터와 앱 내 임시 설정이 함께 적용됩니다
          </p>
        </div>
        <a
          href={SHEET_EDIT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 text-white text-sm font-semibold rounded-xl border border-white/30 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          <span className="hidden sm:inline">원본 구글 시트 열기</span>
        </a>
      </div>

      {/* Tabs Nav */}
      <div className="flex flex-wrap gap-2 md:gap-4 mb-6 bg-white p-2 rounded-2xl shadow-sm border border-emerald-100">
        <button
          onClick={() => setActiveTab("swap")}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all flex-1 md:flex-none justify-center ${
            activeTab === "swap"
              ? "bg-emerald-100 text-emerald-800 shadow-sm"
              : "text-slate-500 hover:bg-slate-50 hover:text-emerald-600"
          }`}
        >
          <ArrowLeftRight className="w-5 h-5" />
          <span className="hidden md:inline">교체 시간표 찾기</span>
          <span className="md:hidden">교체 찾기</span>
        </button>
        <button
          onClick={() => setActiveTab("meeting")}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all flex-1 md:flex-none justify-center ${
            activeTab === "meeting"
              ? "bg-teal-100 text-teal-800 shadow-sm"
              : "text-slate-500 hover:bg-slate-50 hover:text-teal-600"
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="hidden md:inline">협의회 시간 찾기</span>
          <span className="md:hidden">협의회 찾기</span>
        </button>
        <button
          onClick={() => setActiveTab("block")}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all flex-1 md:flex-none justify-center ${
            activeTab === "block"
              ? "bg-rose-100 text-rose-800 shadow-sm"
              : "text-slate-500 hover:bg-slate-50 hover:text-rose-600"
          }`}
        >
          <Ban className="w-5 h-5" />
          <span className="hidden md:inline">교체 불가 설정</span>
          <span className="md:hidden">불가 설정</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === "swap" && <SwapTab />}
        {activeTab === "meeting" && <MeetingTab />}
        {activeTab === "block" && <BlockTab />}
      </div>
    </main>
  );
}
