"use client";

import { AlertCircle, CheckCircle2, Lock, Upload, PenLine } from "lucide-react";
import type { OverviewItem } from "./useCertificateOverview";

// 이수증 연수든 서명 연수든 "이 연수, 누가 완료했고 누가 안 했나"를 같은 모양으로 보여주는 카드.
// 수집 방식(파일 제출 / QR 서명)만 라벨과 액션에서 갈립니다.
export default function TrainingProgressCard({
  item,
  selected,
  onSelect,
  onAction,
}: {
  item: OverviewItem;
  selected: boolean;
  onSelect: () => void;
  /** 내가 아직 완료하지 않았을 때 카드에 뜨는 액션(제출하기 / 서명하러 가기) */
  onAction?: () => void;
}) {
  const isSign = item.category === "sign";
  const doneWord = isSign ? "서명" : "제출";
  const pct = item.total > 0 ? Math.round((item.doneCount / item.total) * 100) : 0;
  const complete = item.total > 0 && item.missingCount === 0;

  return (
    <div
      className={`bg-white rounded-2xl border transition-all ${
        selected ? "border-teal-500 ring-2 ring-teal-500/20" : "border-slate-200 hover:border-teal-300"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left p-4 flex flex-col gap-2.5"
        aria-current={selected}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
              <span className="break-keep">{item.title}</span>
              {item.session?.locked && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                  <Lock className="w-3 h-3" /> 마감
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              등록 {item.registeredByName} · 명단 {item.hasOwnRoster ? "전용" : "전체 기본"} {item.total}명
            </div>
          </div>

          {complete ? (
            <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" /> 완료
            </span>
          ) : isSign && item.session && !item.session.locked ? (
            <span className="shrink-0 text-[11px] font-bold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full tabular-nums">
              진행 중 · {item.missingCount}명 남음
            </span>
          ) : (
            <span className="shrink-0 text-[11px] font-bold bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full tabular-nums">
              미{doneWord} {item.missingCount}명
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${complete ? "bg-emerald-500" : "bg-teal-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-bold text-slate-500 tabular-nums shrink-0">
            {item.doneCount} / {item.total}
          </span>
        </div>
      </button>

      {item.myStatus !== "out" && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-dashed border-slate-200">
          {item.myStatus === "todo" ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600">
                <AlertCircle className="w-3.5 h-3.5" /> 내가 미{doneWord}
              </span>
              {onAction && (
                <button
                  type="button"
                  onClick={onAction}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  {isSign ? <PenLine className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
                  {isSign ? "서명하러 가기" : "지금 제출"}
                </button>
              )}
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" /> 내 {doneWord} 완료
            </span>
          )}
        </div>
      )}
    </div>
  );
}
