"use client";

import { useState } from "react";
import { History, Search, FileText, Loader2 } from "lucide-react";
import { useCertificateHistory } from "./useCertificateHistory";

export default function HistoryTab({ isAdmin }: { isAdmin: boolean }) {
  const { rows, loading, error, search } = useCertificateHistory(isAdmin);
  const [nameQuery, setNameQuery] = useState("");
  const [titleQuery, setTitleQuery] = useState("");

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-teal-700 mb-4 flex items-center gap-2">
            <History className="w-5 h-5" /> 제출 내역 조회
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-bold text-slate-700 mb-1.5 block">성명으로 조회 (정확히 입력)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nameQuery}
                  onChange={(e) => setNameQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && search({ teacherName: nameQuery.trim() })}
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                />
                <button
                  onClick={() => search({ teacherName: nameQuery.trim() })}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-600 hover:bg-slate-500 text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
                >
                  <Search className="w-4 h-4" /> 조회
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-bold text-slate-700 mb-1.5 block">연수 제목으로 조회 (포함 검색)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={titleQuery}
                  onChange={(e) => setTitleQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && search({ titleQuery: titleQuery.trim() })}
                  placeholder="예) 청렴"
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                />
                <button
                  onClick={() => search({ titleQuery: titleQuery.trim() })}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-600 hover:bg-slate-500 text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
                >
                  <Search className="w-4 h-4" /> 조회
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-teal-700 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" /> {isAdmin ? "조회 결과" : "내 제출 내역"}
          {rows && <span className="text-sm font-medium text-slate-500 ml-1">({rows.length}건)</span>}
        </h2>

        {loading ? (
          <div className="flex justify-center py-12 text-teal-600">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : !rows || rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FileText className="w-16 h-16 mb-4 opacity-20" />
            <p className="font-semibold text-slate-500">{isAdmin ? "검색 결과가 없습니다." : "제출한 이수증이 없습니다."}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rows.map((row) => (
              <a
                key={row.id}
                href={`/api/schedule-helper/certificates/${row.id}/file`}
                target="_blank"
                rel="noreferrer"
                className="block p-4 bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-xl transition-colors"
              >
                <div className="font-bold text-slate-800 mb-1">{row.trainingTitle}</div>
                <div className="text-sm text-slate-600">
                  {row.teacherName} 선생님 · {new Date(row.createdAt).toLocaleDateString("ko-KR")}
                </div>
                {(row.institution || row.certDate || row.number) && (
                  <div className="text-xs text-slate-500 mt-1.5">
                    {[row.institution, row.certDate && `이수일: ${row.certDate}`, row.number && `이수번호: ${row.number}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
