"use client";

import { AlertCircle, CheckCircle2, Loader2, Lock, Pencil, QrCode, Trash2 } from "lucide-react";
import type { OverviewItem } from "./useCertificateOverview";
import SignSessionMini from "./SignSessionMini";

// 선택한 서명 연수의 상세 — 이수증 상세와 같은 모양(진행률 + 미완료/완료 명단)이고,
// 수집 도구인 QR 세션 열기/이어보기만 다릅니다.
export default function SignDetail({
  item,
  creating,
  onOpenSession,
  onEdit,
  onDelete,
}: {
  item: OverviewItem;
  creating: boolean;
  onOpenSession: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{item.title}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            등록 {item.registeredByName} · 대상 명단 {item.hasOwnRoster ? "전용" : "전체 기본"} {item.total}명
          </p>
        </div>
        {item.canManage && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
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

      <div className="grid grid-cols-3 border border-slate-200 rounded-2xl overflow-hidden">
        <div className="text-center py-3 bg-slate-50">
          <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">대상</div>
          <div className="text-2xl font-bold text-slate-700 tabular-nums">{item.total}</div>
        </div>
        <div className="text-center py-3 bg-slate-50 border-x border-slate-200">
          <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">서명</div>
          <div className="text-2xl font-bold text-emerald-600 tabular-nums">{item.doneCount}</div>
        </div>
        <div className="text-center py-3 bg-slate-50">
          <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">미서명</div>
          <div className={`text-2xl font-bold tabular-nums ${item.missingCount ? "text-rose-600" : "text-slate-400"}`}>
            {item.missingCount}
          </div>
        </div>
      </div>

      {/* 수집 도구 — QR 세션 */}
      <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-3">
        {item.session ? (
          <>
            <div className="text-xs font-medium text-slate-400">
              {new Date(item.session.createdAt).toLocaleDateString("ko-KR")} 개설
            </div>
            <SignSessionMini sessionId={item.session.id} trainingTitle={item.title} />
          </>
        ) : item.canManage ? (
          <>
            <p className="text-xs text-slate-500">
              아직 QR 세션을 열지 않았습니다. 세션을 열면 이 연수의 참여 명단으로 서명을 받습니다.
            </p>
            <button
              type="button"
              onClick={onOpenSession}
              disabled={creating}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-60 transition-colors text-sm"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
              QR 세션 열기
            </button>
          </>
        ) : (
          <p className="text-xs text-slate-500">
            아직 QR 세션이 열리지 않았습니다. 관리자 또는 이 연수를 등록한 담당 선생님이 세션을 열면 서명할 수
            있습니다.
          </p>
        )}
      </div>

      {!item.canManage ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <Lock className="w-4 h-4 shrink-0 text-slate-400" />
          서명자 명단은 관리자와 이 연수를 등록한 담당 선생님만 볼 수 있습니다.
        </div>
      ) : (
        <>
          {item.missingCount === 0 && item.total > 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-emerald-600">
              <CheckCircle2 className="w-9 h-9 mb-1.5" />
              <p className="font-bold text-sm">모든 선생님이 서명하셨습니다!</p>
            </div>
          ) : (
            <div>
              <h3 className="text-xs font-bold text-rose-600 mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> 미서명 {item.missingCount}명
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
                <CheckCircle2 className="w-3.5 h-3.5" /> 서명 완료 {item.doneCount}명
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {(item.done ?? []).map((name) => (
                  <span
                    key={name}
                    className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-lg text-xs font-bold"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
