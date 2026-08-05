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

  const tabClass = (tab: Tab, active: string) =>
    `flex items-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all flex-1 md:flex-none justify-center ${
      activeTab === tab ? active : "text-slate-500 hover:bg-slate-50 hover:text-teal-600"
    }`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 md:gap-4 mb-2 bg-white p-2 rounded-2xl shadow-sm border border-emerald-100">
        <button onClick={() => setActiveTab("certificate")} className={tabClass("certificate", "bg-emerald-100 text-emerald-800 shadow-sm")}>
          <ClipboardCheck className="w-5 h-5" />
          이수증 수거
          {certMissing > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 tabular-nums">
              {certMissing}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab("sign")} className={tabClass("sign", "bg-amber-100 text-amber-800 shadow-sm")}>
          <QrCode className="w-5 h-5" />
          QR 서명
          {signMissing > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 tabular-nums">
              {signMissing}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab("settings")} className={tabClass("settings", "bg-teal-100 text-teal-800 shadow-sm")}>
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
