"use client";

import { useState } from "react";
import { Send, History, ClipboardCheck, QrCode } from "lucide-react";
import SubmitTab from "./SubmitTab";
import HistoryTab from "./HistoryTab";
import BulkCheckTab from "./BulkCheckTab";
import SignTab from "./SignTab";

type Tab = "submit" | "history" | "bulk" | "sign";

export default function CertificatesTabs({ isAdmin }: { isAdmin: boolean }) {
  const [activeTab, setActiveTab] = useState<Tab>("submit");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 md:gap-4 mb-2 bg-white p-2 rounded-2xl shadow-sm border border-emerald-100">
        <button
          onClick={() => setActiveTab("submit")}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all flex-1 md:flex-none justify-center ${
            activeTab === "submit"
              ? "bg-emerald-100 text-emerald-800 shadow-sm"
              : "text-slate-500 hover:bg-slate-50 hover:text-emerald-600"
          }`}
        >
          <Send className="w-5 h-5" />
          제출하기
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all flex-1 md:flex-none justify-center ${
            activeTab === "history"
              ? "bg-teal-100 text-teal-800 shadow-sm"
              : "text-slate-500 hover:bg-slate-50 hover:text-teal-600"
          }`}
        >
          <History className="w-5 h-5" />
          내역조회
        </button>
        <button
          onClick={() => setActiveTab("bulk")}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all flex-1 md:flex-none justify-center ${
            activeTab === "bulk"
              ? "bg-rose-100 text-rose-800 shadow-sm"
              : "text-slate-500 hover:bg-slate-50 hover:text-rose-600"
          }`}
        >
          <ClipboardCheck className="w-5 h-5" />
          일괄확인
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab("sign")}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all flex-1 md:flex-none justify-center ${
              activeTab === "sign"
                ? "bg-amber-100 text-amber-800 shadow-sm"
                : "text-slate-500 hover:bg-slate-50 hover:text-amber-600"
            }`}
          >
            <QrCode className="w-5 h-5" />
            서명받기
          </button>
        )}
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === "submit" && <SubmitTab isAdmin={isAdmin} />}
        {activeTab === "history" && <HistoryTab isAdmin={isAdmin} />}
        {activeTab === "bulk" && <BulkCheckTab isAdmin={isAdmin} />}
        {activeTab === "sign" && isAdmin && <SignTab />}
      </div>
    </div>
  );
}
