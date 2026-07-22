"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SessionProgressPanel from "@/features/schedule-helper/components/certificates/SessionProgressPanel";

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <main className="max-w-2xl mx-auto px-2 md:px-6 py-6 w-full">
      <Link
        href="/apps/schedule-helper/certificates"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/80 hover:bg-white text-teal-700 text-sm font-medium rounded-xl border border-teal-100 shadow-sm transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        이수증 수거로 돌아가기
      </Link>

      <SessionProgressPanel sessionId={id} />
    </main>
  );
}
