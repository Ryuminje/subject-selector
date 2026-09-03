"use client";

import { useState } from "react";
import { FileText, Trash2, X, Info } from "lucide-react";
import {
  absentDateOf,
  buildDocs,
  exchangeDateOf,
  koreanDate,
} from "@/features/schedule-helper/lib/makeup/buildRows";
import {
  MAKEUP_DOC_KEY,
  MAKEUP_REASONS,
  type MakeupEntry,
} from "@/features/schedule-helper/lib/makeup/types";

interface Props {
  entries: MakeupEntry[];
  schoolName: string;
  onRemove: (id: string) => void;
  onClear: () => void;
  onDateOverride: (id: string, field: "absentDateOverride" | "exchangeDateOverride", value: string) => void;
  /**
   * 결강 주간 기준일. 예전엔 이 컴포넌트가 지역 상태로만 들고 있었는데, SwapTab의 시간표
   * 충돌 판정(그리드 배지·"교체 불가")도 같은 기준일을 알아야 실제 날짜를 계산할 수 있어
   * useMakeupTray 훅으로 끌어올렸습니다. 그래서 여기서는 prop으로만 받습니다.
   */
  baseDate: string;
  onBaseDateChange: (value: string) => void;
}

export default function MakeupTray({ entries, schoolName, onRemove, onClear, onDateOverride, baseDate, onBaseDateChange }: Props) {
  const [reason, setReason] = useState<string>(MAKEUP_REASONS[0]);
  const [reasonDetail, setReasonDetail] = useState("");

  if (entries.length === 0) return null;

  // 여러 선생님이 한꺼번에 출장 가는 경우(수학여행 등)를 한 사람이 트레이 하나에 같이
  // 담아 처리할 수 있어야 해서, 더 이상 한 명으로 제한하지 않습니다 — 서식이 "교 사" 한
  // 명 명의로 찍히는 문서라, buildDocs가 결강 교사별로 문서를 알아서 나눠 만들어 줍니다.
  const distinctTeachers = [...new Set(entries.map((e) => e.absentTeacher))];
  // 사유는 서식에 인쇄된 보기 중 하나를 고르는 것이라 값 자체는 항상 있습니다.
  // "기타"만 괄호 안에 적을 내용을 따로 받습니다.
  const needsDetail = reason === "기타" && !reasonDetail.trim();
  const canSubmit = !!baseDate && !needsDetail;

  // 서식이 "교사 한 명당 하루 한 장"이라, 결강 교사 수 × 결강일 수만큼 장이 나옵니다.
  const sheetCount = baseDate
    ? buildDocs({ schoolName, baseDate, reason, entries }).reduce((sum, doc) => sum + doc.sheets.length, 0)
    : 0;

  const handleCreate = () => {
    const docs = buildDocs({
      schoolName,
      baseDate,
      reason,
      reasonDetail: reasonDetail.trim() || undefined,
      entries,
    });
    // 서버에 저장하지 않는 기능이라 인쇄 페이지로는 브라우저 저장소로 넘깁니다.
    //
    // ⚠️ **sessionStorage를 쓰면 안 됩니다.** sessionStorage는 탭마다 따로이고, 새 탭이
    // 그 사본을 물려받는 건 opener 관계가 있을 때뿐입니다 — 아래 `noopener` 때문에 그 관계가
    // 끊겨서 인쇄 탭에서는 "보강원 데이터가 없습니다"만 나왔습니다(실제로 겪은 버그).
    // localStorage는 같은 출처의 모든 탭이 공유하므로 확실히 넘어갑니다.
    // 넘겨받은 쪽에서 바로 지우므로 사유(병가 등)가 브라우저에 남지 않습니다.
    localStorage.setItem(MAKEUP_DOC_KEY, JSON.stringify(docs));
    window.open("/apps/schedule-helper/makeup/print", "_blank", "noopener");
  };

  return (
    <div className="w-full bg-white rounded-[14px] border border-stone-200 overflow-hidden">
      <div className="bg-swap px-4 py-3 flex items-center justify-between text-white">
        <h2 className="text-sm font-bold flex items-center gap-2">
          <FileText className="w-4 h-4" /> 작성 중인 보강원 ({entries.length}건)
        </h2>
        <button onClick={onClear} className="hover:bg-white/15 p-1 rounded-full transition-colors" title="모두 비우기">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto">
        {distinctTeachers.length > 1 && (
          <div className="flex items-start gap-2 text-xs text-stone-500 bg-stone-50 border border-stone-200 rounded-[10px] p-3">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {distinctTeachers.length}명의 선생님 몫이 함께 담겨 있습니다. 보강원 만들기를 누르면 선생님별로
              문서가 따로 나뉘어 한 번에 만들어집니다.
            </span>
          </div>
        )}

        <div className="space-y-2">
          {entries.map((entry) => (
            <div key={entry.id} className="border border-stone-200 rounded-[10px] p-3 text-xs space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className={
                        entry.kind === "swap"
                          ? "px-1.5 py-0.5 rounded bg-swap/10 text-swap font-bold"
                          : "px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold"
                      }
                    >
                      {entry.kind === "swap" ? "교체" : "보강"}
                    </span>
                    <span className="font-bold text-stone-800 truncate">{entry.partnerTeacher} 선생님</span>
                  </div>
                  <div className="text-stone-600">
                    {/* 여러 선생님이 섞여 있을 때 "누구의 결강 건인지"를 구분할 수 있어야 합니다. */}
                    <span className="font-semibold text-stone-500">{entry.absentTeacher}</span> 결강 ·{" "}
                    {entry.absent.day} {entry.absent.period}교시 · {entry.absent.grade}-{entry.absent.classNum}{" "}
                    {entry.absent.subject}
                  </div>
                </div>
                <button
                  onClick={() => onRemove(entry.id)}
                  className="shrink-0 text-stone-400 hover:text-rose-600 transition-colors"
                  title="빼기"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <label className="flex items-center gap-2">
                <span className="text-stone-500 w-12 shrink-0">결강일</span>
                <input
                  type="date"
                  value={absentDateOf(entry, baseDate)}
                  onChange={(e) => onDateOverride(entry.id, "absentDateOverride", e.target.value)}
                  className="flex-1 min-w-0 border border-stone-200 rounded-lg px-2 py-1"
                />
              </label>

              {entry.exchange && (
                <>
                  <div className="text-stone-600">
                    ↔ 내가 대신: {entry.exchange.day} {entry.exchange.period}교시 · {entry.exchange.grade}-
                    {entry.exchange.classNum} {entry.exchange.subject}
                  </div>
                  <label className="flex items-center gap-2">
                    <span className="text-stone-500 w-12 shrink-0">교체일</span>
                    <input
                      type="date"
                      value={exchangeDateOf(entry, baseDate)}
                      onChange={(e) => onDateOverride(entry.id, "exchangeDateOverride", e.target.value)}
                      className="flex-1 min-w-0 border border-stone-200 rounded-lg px-2 py-1"
                    />
                  </label>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-stone-200 pt-4 space-y-3">
          <label className="block">
            <span className="block text-xs font-semibold text-stone-600 mb-1">결강 주간 기준일</span>
            <input
              type="date"
              value={baseDate}
              onChange={(e) => onBaseDateChange(e.target.value)}
              className="w-full border border-stone-200 rounded-[10px] px-3 py-2 text-sm"
            />
            <span className="block text-[11px] text-stone-400 mt-1">
              위 날짜들은 이 날이 속한 주에서 요일에 맞춰 자동으로 채워집니다. 다르면 직접 고치세요.
            </span>
          </label>

          <label className="block">
            <span className="block text-xs font-semibold text-stone-600 mb-1">결강 사유</span>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-stone-200 rounded-[10px] px-3 py-2 text-sm bg-white"
            >
              {MAKEUP_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          {reason === "기타" && (
            <input
              type="text"
              value={reasonDetail}
              onChange={(e) => setReasonDetail(e.target.value)}
              placeholder="괄호 안에 적을 사유"
              className="w-full border border-stone-200 rounded-[10px] px-3 py-2 text-sm"
            />
          )}
        </div>
      </div>

      <div className="border-t border-stone-100 p-4">
        <button
          onClick={handleCreate}
          disabled={!canSubmit}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-swap hover:opacity-90 disabled:bg-stone-200 disabled:text-stone-400 text-white font-bold rounded-[10px] transition-opacity text-sm"
        >
          <FileText className="w-4 h-4" />
          보강원 만들기
        </button>
        {baseDate && canSubmit && (
          <p className="text-[11px] text-stone-400 mt-2 text-center">
            {koreanDate(baseDate)} 주간 ·{" "}
            {distinctTeachers.length > 1 ? `${distinctTeachers[0]} 선생님 외 ${distinctTeachers.length - 1}명` : `${distinctTeachers[0]} 선생님`}
            {sheetCount > 1 && ` · 총 ${sheetCount}장으로 나옵니다`}
          </p>
        )}
      </div>
    </div>
  );
}
