"use client";

import { useEffect, useState } from "react";
import { FileText, Trash2, X, AlertTriangle } from "lucide-react";
import {
  absentDateOf,
  buildDoc,
  buildSheets,
  exchangeDateOf,
  formatDate,
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
}

export default function MakeupTray({ entries, schoolName, onRemove, onClear, onDateOverride }: Props) {
  const [baseDate, setBaseDate] = useState("");
  const [reason, setReason] = useState<string>(MAKEUP_REASONS[0]);
  const [reasonDetail, setReasonDetail] = useState("");

  // 기본값을 오늘로. 렌더 중에 new Date()를 부르면 서버 렌더와 값이 어긋날 수 있어
  // 마운트 후에 채웁니다.
  useEffect(() => {
    Promise.resolve().then(() => setBaseDate(formatDate(new Date())));
  }, []);

  if (entries.length === 0) return null;

  const writerTeacher = entries[0].absentTeacher;
  // 트레이는 한 사람의 결강을 모으는 곳입니다. 시간표에서 다른 교사 칸을 눌러 담으면
  // 한 장에 두 사람이 섞여 결재가 안 되므로 미리 알려줍니다.
  const mixedTeachers = entries.some((e) => e.absentTeacher !== writerTeacher);
  // 사유는 서식에 인쇄된 보기 중 하나를 고르는 것이라 값 자체는 항상 있습니다.
  // "기타"만 괄호 안에 적을 내용을 따로 받습니다.
  const needsDetail = reason === "기타" && !reasonDetail.trim();
  const canSubmit = !!baseDate && !needsDetail && !mixedTeachers;

  // 서식이 하루 한 장이라 결강일이 여러 날이면 그만큼 장이 나옵니다. 미리 알려줍니다.
  const sheetCount = baseDate ? buildSheets(entries, baseDate).length : 0;

  const handleCreate = () => {
    const doc = buildDoc({
      schoolName,
      writerTeacher,
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
    localStorage.setItem(MAKEUP_DOC_KEY, JSON.stringify(doc));
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
        {mixedTeachers && (
          <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-[10px] p-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              여러 선생님의 결강이 섞여 있습니다. 보강원 한 장에는 한 분의 결강만 담아야 합니다. 다른 분의 건은
              빼주세요.
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
              onChange={(e) => setBaseDate(e.target.value)}
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
            {koreanDate(baseDate)} 주간 · {writerTeacher} 선생님
            {sheetCount > 1 && ` · 결강일이 ${sheetCount}일이라 ${sheetCount}장으로 나옵니다`}
          </p>
        )}
      </div>
    </div>
  );
}
