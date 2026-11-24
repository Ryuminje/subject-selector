"use client";

import { useMemo, useState } from "react";
import { X, GraduationCap, AlertTriangle, Database } from "lucide-react";
import {
  findDuplicateIds,
  isStudentId,
  reviewPromotion,
  type PromotionDecision,
  type PromotionReview,
  type RawRow,
  type ReviewRow,
} from "../lib/promotion";
import { useYearData } from "../../year-data/YearDataContext";
import { OPEN_BASE_DATA_EVENT } from "../../year-data/components/BaseDataNotice";

interface PromotionModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 이 학년의 현재 학생 원본 행 */
  rawRows: RawRow[];
  onApply: (decisions: PromotionDecision[]) => void;
}

// 진급 명단은 「기초자료」 탭 3단계에서 한 번 올려 두고 여기서는 그 명단으로 점검·적용만 합니다.
export function PromotionModal({ isOpen, onClose, rawRows, onApply }: PromotionModalProps) {
  const { promotionEntries } = useYearData();
  // 점검 화면에서 고친 값(진급학번·삭제). 키는 진급 전 학번.
  const [edits, setEdits] = useState<Record<string, { newId: string; remove: boolean }>>({});

  const review: PromotionReview | null = useMemo(
    () => (promotionEntries.length > 0 ? reviewPromotion(rawRows, promotionEntries) : null),
    [promotionEntries, rawRows],
  );

  if (!isOpen) return null;

  const close = () => { setEdits({}); onClose(); };
  const openBaseData = () => { close(); window.dispatchEvent(new Event(OPEN_BASE_DATA_EVENT)); };

  // 현재 값 = 점검 결과 + 사용자가 고친 값
  const rows: ReviewRow[] = (review?.rows ?? []).map(r => ({ ...r, ...(edits[r.key] ?? {}) }));
  const matched = rows.filter(r => r.status === "match");
  const attention = rows.filter(r => r.status !== "match");
  const dups = findDuplicateIds(rows);
  const badIds = rows.filter(r => !r.remove && r.newId.trim() && !isStudentId(r.newId.trim()));
  const canApply = !!review && rows.length > 0 && dups.size === 0 && badIds.length === 0;

  const setEdit = (key: string, patch: Partial<{ newId: string; remove: boolean }>) => {
    const base = rows.find(r => r.key === key)!;
    setEdits(prev => ({ ...prev, [key]: { ...(prev[key] ?? { newId: base.newId, remove: base.remove }), ...patch } }));
  };

  const apply = () => {
    onApply(rows.map(r => ({ key: r.key, newId: r.newId.trim(), remove: r.remove })));
    close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
          <h3 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-emerald-700" /> 진급 학번 적용
          </h3>
          <button onClick={close} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500" aria-label="닫기"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 overflow-auto space-y-5">
          {!review ? (
            <>
              <p className="text-sm text-stone-600">
                진급 학번 명단이 아직 없습니다. 「기초자료」 탭 3단계에서 <b>이전학번 · 이름 · 진급학번</b> 명단을 한 번 올려 두면,
                여기서 그 명단으로 점검하고 적용할 수 있습니다. 적용하면 2단계 표, 반편성, 타임 배정이 모두 진급학번 기준으로 바뀝니다.
              </p>
              <div className="flex justify-end">
                <button
                  onClick={openBaseData}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                >
                  <Database className="w-4 h-4" /> 기초자료 탭 열기
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">일치 {matched.length}명</span>
                <span className="px-3 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">확인 필요 {attention.length}명</span>
                <span className="px-3 py-1 rounded-lg bg-stone-50 text-stone-700 border border-stone-200">
                  명단에만 있는 학생 {review.unusedEntries.length}명
                </span>
                <span className="px-3 py-1 text-stone-500">기초자료 탭의 명단 {promotionEntries.length}명 기준</span>
              </div>

              {attention.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-stone-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    아래 학생은 확인이 필요합니다. 진급학번을 직접 입력하거나, 삭제할 학생은 체크하세요. 비워 두면 옛 학번 그대로 둡니다.
                  </p>
                  <div className="border border-stone-200 rounded-xl overflow-auto max-h-[40vh]">
                    <table className="w-full text-sm">
                      <thead className="bg-stone-50 text-stone-600 text-xs">
                        <tr>
                          <th className="px-3 py-2 text-left">구분</th>
                          <th className="px-3 py-2 text-left">이전학번</th>
                          <th className="px-3 py-2 text-left">이름</th>
                          <th className="px-3 py-2 text-left">진급학번</th>
                          <th className="px-3 py-2 text-center">삭제</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attention.map(r => (
                          <tr key={r.key} className={`border-t border-stone-200 ${r.remove ? "opacity-50" : ""}`}>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {r.status === "missing"
                                ? <span className="text-amber-700">명단에 없음</span>
                                : <span className="text-rose-700">이름 다름 (명단: {r.listName})</span>}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">{r.key || <span className="text-stone-400">(학번 없음)</span>}</td>
                            <td className="px-3 py-2">
                              <div className="whitespace-nowrap font-medium">{r.name || <span className="text-stone-400">(이름 없음)</span>}</div>
                              <div className="text-xs text-stone-500">{r.info}</div>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                value={r.newId}
                                disabled={r.remove}
                                onChange={e => setEdit(r.key, { newId: e.target.value })}
                                placeholder="옛 학번 유지"
                                className="w-32 px-2 py-1 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-100"
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <input type="checkbox" checked={r.remove} onChange={e => setEdit(r.key, { remove: e.target.checked })} className="w-4 h-4 accent-rose-600" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {review.unusedEntries.length > 0 && (
                <details className="text-sm text-stone-600">
                  <summary className="cursor-pointer">설문에 없는 명단 {review.unusedEntries.length}명 보기 (적용에는 쓰이지 않음)</summary>
                  <div className="mt-2 max-h-32 overflow-auto text-xs text-stone-500">
                    {review.unusedEntries.map(e => `${e.oldId} ${e.name} → ${e.newId}`).join(" · ")}
                  </div>
                </details>
              )}

              {dups.size > 0 && (
                <p className="text-sm text-rose-700 font-medium">
                  진급학번이 겹칩니다: {[...dups].map(([id, names]) => `${id} (${names.join(", ")})`).join(" / ")} — 고친 뒤에 적용할 수 있습니다.
                </p>
              )}
              {badIds.length > 0 && (
                <p className="text-sm text-rose-700 font-medium">
                  진급학번은 숫자 4자리 이상이어야 합니다: {badIds.map(r => r.name || r.key).join(", ")}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex justify-between gap-2 px-6 py-4 border-t border-stone-200">
          <button onClick={close} className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-50">
            취소
          </button>
          {review && (
            <button onClick={apply} disabled={!canApply} className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-50">
              {rows.filter(r => !r.remove).length}명 적용
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
