"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, FileText, Loader2, Lock, Pencil, Trash2 } from "lucide-react";
import type { OverviewItem } from "./useCertificateOverview";
import type { CertificateHistoryRow } from "./useCertificateHistory";

// 선택한 이수증 연수의 상세 — 진행률, 미제출자, 제출자(이름을 누르면 제출물).
// 예전 "일괄확인"과 "내역조회"가 하던 일을 연수 하나 안에서 한 번에 보여줍니다.
export default function CertificateDetail({
  item,
  onEdit,
  onDelete,
  onRefresh,
}: {
  item: OverviewItem;
  onEdit: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const [rows, setRows] = useState<CertificateHistoryRow[] | null>(null);
  // 부모가 key={item.id}로 렌더하므로 연수를 바꾸면 이 컴포넌트가 새로 마운트됩니다.
  // 덕분에 연수 전환 시 상태를 수동으로 비울 필요가 없습니다.
  const [loadingRows, setLoadingRows] = useState(item.canManage);
  const [openName, setOpenName] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 담당자/관리자만 제출물 목록을 볼 수 있으므로 그 경우에만 조회합니다.
  // (setState는 항상 .then()/.finally() 안에서만 — 이펙트 본문에서 직접 호출 금지)
  useEffect(() => {
    if (!item.canManage) return;
    let alive = true;
    fetch(`/api/schedule-helper/certificates/history?titleQuery=${encodeURIComponent(item.title)}`)
      .then((res) => res.json())
      .then((body) => {
        if (!alive) return;
        const all = (body.certificates ?? []) as CertificateHistoryRow[];
        // titleQuery는 부분 일치라 정확히 이 연수 것만 남깁니다.
        setRows(all.filter((r) => r.trainingTitle === item.title));
      })
      .catch(() => {
        if (alive) setRows([]);
      })
      .finally(() => {
        if (alive) setLoadingRows(false);
      });
    return () => {
      alive = false;
    };
  }, [item.title, item.canManage]);

  const handleDeleteSubmission = async (row: CertificateHistoryRow) => {
    if (!window.confirm(`${row.teacherName} 선생님의 제출 내역을 삭제할까요? 첨부 파일도 함께 삭제되며 되돌릴 수 없습니다.`))
      return;
    setDeletingId(row.id);
    const res = await fetch(`/api/schedule-helper/certificates/${row.id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) {
      setRows((prev) => (prev ? prev.filter((r) => r.id !== row.id) : prev));
      setOpenName(null);
      onRefresh();
    }
  };

  const openRow = openName ? rows?.find((r) => r.teacherName === openName) ?? null : null;

  return (
    <div className="bg-white rounded-[14px] border border-stone-200 p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-lg text-stone-800">{item.title}</h2>
          <p className="text-xs text-stone-400 mt-0.5">
            등록 {item.registeredByName} · 대상 명단 {item.hasOwnRoster ? "전용" : "전체 기본"} {item.total}명
          </p>
        </div>
        {item.canManage && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" /> 연수 편집
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-rose-200 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> 삭제
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 border border-stone-200 rounded-[10px] overflow-hidden">
        <div className="text-center py-3 bg-stone-50">
          <div className="text-[10px] font-bold tracking-wider text-stone-400 uppercase">대상</div>
          <div className="text-2xl font-bold text-stone-700 tabular-nums">{item.total}</div>
        </div>
        <div className="text-center py-3 bg-stone-50 border-x border-stone-200">
          <div className="text-[10px] font-bold tracking-wider text-stone-400 uppercase">제출</div>
          <div className="text-2xl font-bold text-emerald-600 tabular-nums">{item.doneCount}</div>
        </div>
        <div className="text-center py-3 bg-stone-50">
          <div className="text-[10px] font-bold tracking-wider text-stone-400 uppercase">미제출</div>
          <div className={`text-2xl font-bold tabular-nums ${item.missingCount ? "text-rose-600" : "text-stone-400"}`}>
            {item.missingCount}
          </div>
        </div>
      </div>

      {!item.canManage ? (
        <div className="flex items-center gap-2 text-sm text-stone-500 bg-stone-50 border border-stone-200 rounded-[10px] px-4 py-3">
          <Lock className="w-4 h-4 shrink-0 text-stone-400" />
          제출자 명단은 관리자와 이 연수를 등록한 담당 선생님만 볼 수 있습니다.
        </div>
      ) : (
        <>
          {item.missingCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-emerald-600">
              <CheckCircle2 className="w-9 h-9 mb-1.5" />
              <p className="font-bold text-sm">모든 선생님이 제출하셨습니다!</p>
            </div>
          ) : (
            <div>
              <h3 className="text-xs font-bold text-rose-600 mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> 미제출 {item.missingCount}명
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {(item.missing ?? []).map((name) => (
                  <span
                    key={name}
                    className="bg-rose-50 border border-rose-200 text-rose-700 px-2.5 py-1 rounded-lg text-xs font-bold"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {item.doneCount > 0 && (
            <div>
              <h3 className="text-xs font-bold text-emerald-700 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> 제출 완료 {item.doneCount}명
                <span className="font-medium text-stone-400">— 이름을 누르면 제출물이 보입니다</span>
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {(item.done ?? []).map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setOpenName(openName === name ? null : name)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                      openName === name
                        ? "bg-emerald-600 border-emerald-600 text-white"
                        : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loadingRows && (
            <div className="flex justify-center py-3 text-cert">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}

          {openName && !loadingRows && (
            <div className="border border-stone-200 rounded-[10px] p-4 bg-stone-50">
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <h3 className="text-sm font-bold text-stone-700 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-cert" /> {openName} 선생님 제출물
                </h3>
                {openRow && (
                  <div className="flex gap-2">
                    <a
                      href={`/api/schedule-helper/certificates/${openRow.id}/file`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs px-3 py-1.5 bg-cert hover:opacity-90 text-white font-bold rounded-lg transition-opacity"
                    >
                      파일 열기
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDeleteSubmission(openRow)}
                      disabled={deletingId === openRow.id}
                      className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-rose-200 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-60 transition-colors"
                    >
                      {deletingId === openRow.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      삭제
                    </button>
                  </div>
                )}
              </div>
              {openRow ? (
                <dl className="grid grid-cols-[auto_1fr] gap-y-1.5 gap-x-4 text-sm">
                  <dt className="text-xs font-bold text-stone-400">이수번호</dt>
                  <dd className="font-bold text-stone-700 tabular-nums">{openRow.number || "—"}</dd>
                  <dt className="text-xs font-bold text-stone-400">이수기관</dt>
                  <dd className="font-bold text-stone-700">{openRow.institution || "—"}</dd>
                  <dt className="text-xs font-bold text-stone-400">이수날짜</dt>
                  <dd className="font-bold text-stone-700 tabular-nums">{openRow.certDate || "—"}</dd>
                  <dt className="text-xs font-bold text-stone-400">첨부파일</dt>
                  <dd className="font-bold text-stone-700 break-all">{openRow.fileName}</dd>
                </dl>
              ) : (
                <p className="text-sm text-stone-400">제출물 정보를 찾지 못했습니다.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
