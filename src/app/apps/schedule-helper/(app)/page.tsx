"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSchedule } from "@/features/schedule-helper/lib/ScheduleContext";
import { useSession, signOut } from "@/lib/auth-client";
import { ArrowLeft, ArrowLeftRight, Users, Ban, Loader2, Upload, LogOut, UserCog, KeyRound, Copy, Check, UserPlus } from "lucide-react";
import SwapTab from "@/features/schedule-helper/components/SwapTab";
import MeetingTab from "@/features/schedule-helper/components/MeetingTab";
import BlockTab from "@/features/schedule-helper/components/BlockTab";
import UploadPanel from "@/features/schedule-helper/components/UploadPanel";

export default function ScheduleHelperPage() {
  const router = useRouter();
  const { data, loading, error } = useSchedule();
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<"swap" | "meeting" | "block">("swap");
  const [showUpload, setShowUpload] = useState(false);
  const [showJoinCode, setShowJoinCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const isAdmin = session?.user?.role === "ADMIN";

  const handleLogout = async () => {
    await signOut();
    router.push("/apps/schedule-helper/login?next=" + encodeURIComponent("/apps/schedule-helper"));
  };

  const handleCopyJoinCode = async () => {
    if (!data?.joinCode) return;
    await navigator.clipboard.writeText(data.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

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
      {/* 상단 바 */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/80 hover:bg-white text-teal-700 text-sm font-medium rounded-xl border border-teal-100 shadow-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          허브로 돌아가기
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/apps/schedule-helper/account"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/80 hover:bg-white text-slate-500 hover:text-teal-600 text-sm font-medium rounded-xl border border-slate-200 shadow-sm transition-colors"
          >
            <KeyRound className="w-4 h-4" />
            비밀번호 변경
          </Link>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/80 hover:bg-white text-slate-500 hover:text-rose-600 text-sm font-medium rounded-xl border border-slate-200 shadow-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-500 p-6 md:p-8 rounded-3xl shadow-lg text-white mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2 flex items-center gap-2">
            <span>🗓️</span> 수업교체 도우미
          </h1>
          <p className="text-emerald-50 font-medium text-sm md:text-base">
            관리자가 등록한 시간표와 교사 목록 설정이 함께 적용됩니다
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          {isAdmin && (
            <>
              <Link
                href="/apps/schedule-helper/teachers"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 text-white text-sm font-semibold rounded-xl border border-white/30 transition-colors"
              >
                <UserCog className="w-4 h-4" />
                <span className="hidden sm:inline">교사 목록 관리</span>
              </Link>
              <Link
                href="/apps/schedule-helper/accounts"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 text-white text-sm font-semibold rounded-xl border border-white/30 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">계정 관리</span>
              </Link>
              <button
                onClick={() => setShowUpload((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 text-white text-sm font-semibold rounded-xl border border-white/30 transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">시간표 업로드</span>
              </button>
              <button
                onClick={() => setShowJoinCode((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 text-white text-sm font-semibold rounded-xl border border-white/30 transition-colors"
              >
                <KeyRound className="w-4 h-4" />
                <span className="hidden sm:inline">초대 코드</span>
              </button>
            </>
          )}
        </div>
      </div>

      {isAdmin && showJoinCode && (
        <div className="mb-8 bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-teal-700 mb-1 flex items-center gap-2">
            <KeyRound className="w-5 h-5" /> 학교 초대 코드
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            선생님들이 &quot;코드로 가입&quot;할 때 필요한 코드입니다. 공유해서 셀프 가입을 안내해주세요.
          </p>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold tracking-[0.2em] text-teal-800 bg-teal-50 border border-teal-200 rounded-xl px-5 py-2.5">
              {data?.joinCode ?? "-"}
            </span>
            <button
              onClick={handleCopyJoinCode}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "복사됨" : "복사"}
            </button>
          </div>
        </div>
      )}

      {isAdmin && showUpload && (
        <div className="mb-8">
          <UploadPanel />
        </div>
      )}

      {data.teachers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-10 text-center">
          <p className="text-lg font-semibold text-slate-700 mb-2">아직 업로드된 시간표가 없습니다.</p>
          {isAdmin ? (
            <div className="max-w-md mx-auto mt-6 text-left">
              <UploadPanel compact />
            </div>
          ) : (
            <p className="text-sm text-slate-500">학교 관리자에게 시간표 업로드를 요청해 주세요.</p>
          )}
        </div>
      ) : (
        <>
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
        </>
      )}
    </main>
  );
}
