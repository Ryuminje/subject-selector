"use client";

import { useState } from "react";
import { ClipboardCheck, QrCode, Settings } from "lucide-react";
import CertificateBoard from "./CertificateBoard";
import SignBoard from "./SignBoard";
import CommonSettings from "./CommonSettings";
import { useCertificateOverview } from "./useCertificateOverview";

type Tab = "certificate" | "sign" | "settings";

// 탭은 "무슨 일을 하는가" 기준으로 셋뿐입니다.
// 이수증 수거 / QR 서명은 같은 카드·진행률 언어를 쓰고 수집 방식만 다르며,
// 두 곳이 함께 쓰는 설정(명단 프리셋 등)만 공통 설정으로 뺐습니다.
export default function CertificatesTabs({ isAdmin }: { isAdmin: boolean }) {
  const [activeTab, setActiveTab] = useState<Tab>("certificate");
  const { items, loading, error, reload, byCategory } = useCertificateOverview();

  const certItems = byCategory("certificate");
  const signItems = byCategory("sign");
  const certMissing = certItems.reduce((acc, i) => acc + i.missingCount, 0);
  const signMissing = signItems.reduce((acc, i) => acc + i.missingCount, 0);

  // 2026-08-30 개편: 탭 3개가 각자 다른 색이던 것을 앱의 단일 강조색(cert)으로 통일.
  const tabClass = (tab: Tab) =>
    `flex items-center gap-2 px-4 py-3 rounded-[10px] font-semibold transition-colors flex-1 md:flex-none justify-center whitespace-nowrap ${
      activeTab === tab ? "bg-cert/10 text-cert" : "text-stone-500 hover:bg-stone-50 hover:text-cert"
    }`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 mb-2 bg-white p-1.5 rounded-[14px] border border-stone-200">
        <button onClick={() => setActiveTab("certificate")} className={tabClass("certificate")}>
          <ClipboardCheck className="w-5 h-5" />
          이수증 수거
          {certMissing > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 tabular-nums">
              {certMissing}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab("sign")} className={tabClass("sign")}>
          <QrCode className="w-5 h-5" />
          QR 서명
          {signMissing > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 tabular-nums">
              {signMissing}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab("settings")} className={tabClass("settings")}>
          <Settings className="w-5 h-5" />
          공통 설정
        </button>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === "certificate" && (
          <CertificateBoard isAdmin={isAdmin} items={certItems} loading={loading && !items} onRefresh={reload} />
        )}
        {activeTab === "sign" && (
          <SignBoard isAdmin={isAdmin} items={signItems} loading={loading && !items} onRefresh={reload} />
        )}
        {activeTab === "settings" && <CommonSettings isAdmin={isAdmin} />}
      </div>
    </div>
  );
}
