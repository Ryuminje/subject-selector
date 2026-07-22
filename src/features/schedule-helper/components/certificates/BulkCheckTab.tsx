"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { ClipboardCheck, Search, Loader2, AlertCircle, CheckCircle2, ListChecks, X } from "lucide-react";
import { useBulkCheck } from "./useBulkCheck";

interface TrainingTitleOption {
  id: string;
  title: string;
  registeredByName: string;
}

export default function BulkCheckTab({ isAdmin }: { isAdmin: boolean }) {
  const { data: session } = useSession();
  const [title, setTitle] = useState("");
  const [myTitles, setMyTitles] = useState<TrainingTitleOption[]>([]);
  const { result, loading, error, check } = useBulkCheck();

  useEffect(() => {
    fetch("/api/schedule-helper/certificates/training-titles")
      .then((res) => res.json())
      .then((body) => setMyTitles(body.titles ?? []))
      .catch(() => {});
  }, []);

  const visibleTitles = isAdmin
    ? myTitles
    : myTitles.filter((t) => t.registeredByName === session?.user?.name);

  const handlePick = (t: string) => {
    setTitle(t);
    check(t);
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/schedule-helper/certificates/training-titles/${id}`, { method: "DELETE" });
    if (res.ok) {
      setMyTitles((prev) => prev.filter((t) => t.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-teal-700 mb-4 flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5" /> 미제출자 일괄 확인
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          {isAdmin ? "관리자는 모든 연수의 제출 현황을 확인할 수 있습니다." : "본인이 등록한 연수만 제출 현황을 확인할 수 있습니다."}
        </p>

        {visibleTitles.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
              <ListChecks className="w-3.5 h-3.5" /> {isAdmin ? "등록된 연수" : "내가 등록한 연수"}
            </div>
            <div className="flex flex-wrap gap-2">
              {visibleTitles.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1.5 bg-teal-50 border border-teal-200 text-teal-800 pl-3 pr-1.5 py-1.5 rounded-full text-xs font-semibold"
                >
                  <button onClick={() => handlePick(t.title)} className="hover:underline">
                    {t.title}
                    {isAdmin && <span className="text-teal-500 font-normal"> · {t.registeredByName}</span>}
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    title="연수 삭제"
                    className="hover:bg-teal-200 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <label className="text-sm font-bold text-slate-700 mb-1.5 block">확인할 연수 제목</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && check(title)}
            placeholder="연수 제목을 입력하세요"
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
          />
          <button
            onClick={() => check(title)}
            disabled={loading || !title.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            확인
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">교사 명단과 대조하여 미제출자/제출자를 함께 보여줍니다.</p>
        {error && <p className="text-sm text-rose-600 mt-2">{error}</p>}
      </div>

      {result && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <div className="grid grid-cols-3 gap-4 mb-6 bg-rose-50/50 border border-rose-100 rounded-2xl p-4">
            <div className="text-center">
              <div className="text-xs text-slate-500 mb-1">전체</div>
              <div className="text-2xl font-bold text-slate-700">{result.totalCount}</div>
            </div>
            <div className="text-center border-x border-rose-100">
              <div className="text-xs text-slate-500 mb-1">제출</div>
              <div className="text-2xl font-bold text-emerald-600">{result.submittedCount}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-500 mb-1">미제출</div>
              <div className="text-2xl font-bold text-rose-600">{result.unsubmitted.length}</div>
            </div>
          </div>

          {result.unsubmitted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-emerald-600">
              <CheckCircle2 className="w-10 h-10 mb-2" />
              <p className="font-bold">모든 선생님이 제출하셨습니다!</p>
            </div>
          ) : (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-rose-600 mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> 미제출 선생님 ({result.unsubmitted.length}명)
              </h3>
              <div className="flex flex-wrap gap-2">
                {result.unsubmitted.map((name) => (
                  <span
                    key={name}
                    className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-1.5 rounded-xl text-sm font-bold"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.submitted.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-emerald-700 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> 제출 완료 선생님 ({result.submitted.length}명)
              </h3>
              <div className="flex flex-wrap gap-2">
                {result.submitted.map((name) => (
                  <span
                    key={name}
                    className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-xl text-sm font-bold"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
