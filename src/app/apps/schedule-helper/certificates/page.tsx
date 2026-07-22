"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { ArrowLeft, LogOut, Loader2 } from "lucide-react";
import CertificatesTabs from "@/features/schedule-helper/components/certificates/CertificatesTabs";

export default function CertificatesPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const handleLogout = async () => {
    await signOut();
    router.push("/apps/schedule-helper/login");
  };

  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-teal-700">
        <Loader2 className="w-12 h-12 animate-spin mb-4" />
        <p className="text-lg font-semibold">불러오는 중...</p>
      </div>
    );
  }

  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <main className="max-w-5xl mx-auto px-2 md:px-6 py-6 w-full">
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/80 hover:bg-white text-teal-700 text-sm font-medium rounded-xl border border-teal-100 shadow-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          허브로 돌아가기
        </Link>
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/80 hover:bg-white text-slate-500 hover:text-rose-600 text-sm font-medium rounded-xl border border-slate-200 shadow-sm transition-colors"
        >
          <LogOut className="w-4 h-4" />
          로그아웃
        </button>
      </div>

      <div className="bg-gradient-to-br from-emerald-600 to-teal-500 p-6 md:p-8 rounded-3xl shadow-lg text-white mb-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2 flex items-center gap-2">
          <span>📜</span> 연수 이수증 수거
        </h1>
        <p className="text-emerald-50 font-medium text-sm md:text-base">
          이수증 제출부터 QR 서명 수거까지 한 곳에서 관리합니다
        </p>
      </div>

      <CertificatesTabs isAdmin={isAdmin} />
    </main>
  );
}
