"use client";

import { ArrowRightLeft, PencilLine, Trash2, UserPlus, X } from "lucide-react";
import { koreanDate } from "@/features/schedule-helper/lib/makeup/buildRows";
import { affectsWeek, type ManualChange } from "@/features/schedule-helper/lib/manualChanges";
import { cn } from "@/features/schedule-helper/lib/utils";

interface Props {
  /** 기록 모드가 켜져 있는가 */
  recording: boolean;
  onToggleRecording: () => void;
  /** 첫 번째로 고른 칸 (없으면 아직 아무것도 안 고름) */
  pending: { teacher: string; day: string; period: number; subject: string } | null;
  onCancelPending: () => void;
  changes: ManualChange[];
  baseDate: string;
  onRemove: (id: string) => void;
  error: string | null;
}

function describe(change: ManualChange): string {
  const slot = (s: { date: string; period: number }) => `${koreanDate(s.date)} ${s.period}교시`;
  if (change.kind === "sub") {
    return `${slot(change.absent)} ${change.absentTeacher} → ${change.partnerTeacher} 보강`;
  }
  return `${change.absentTeacher} ${slot(change.absent)} ↔ ${change.partnerTeacher} ${slot(change.exchange!)}`;
}

/**
 * "이미 이뤄진 교체" 입력 막대.
 *
 * 이 도구를 거치지 않고 선생님들끼리 바꾼 건 시간표에도 트레이에도 없어서, 그대로 두면
 * 이미 수업이 있는 사람을 공강이라고 추천하게 됩니다. 여기서 두 칸을 눌러 기록하면
 * 그 주 시간표가 실제 모습으로 바뀌고 검색도 그걸 기준으로 돕니다.
 */
export default function ManualChangeBar({
  recording,
  onToggleRecording,
  pending,
  onCancelPending,
  changes,
  baseDate,
  onRemove,
  error,
}: Props) {
  const thisWeek = changes.filter((c) => affectsWeek(c, baseDate));

  return (
    <div className="border-b border-stone-200 bg-stone-50 px-4 py-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-stone-700 flex items-center gap-1.5">
            <PencilLine className="w-4 h-4" /> 이미 이뤄진 교체 기록
          </h3>
          <p className="text-[11px] text-stone-500 mt-0.5">
            다른 선생님들끼리 이 도구 없이 바꾼 수업을 입력하면, 그 주 시간표에 반영되어 교체 상대를 정확히 찾습니다.
          </p>
        </div>
        <button
          onClick={onToggleRecording}
          className={cn(
            "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors border",
            recording
              ? "bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-600"
              : "bg-white hover:bg-stone-100 text-stone-600 border-stone-200"
          )}
        >
          {recording ? <X className="w-3.5 h-3.5" /> : <PencilLine className="w-3.5 h-3.5" />}
          {recording ? "기록 그만두기" : "기록하기"}
        </button>
      </div>

      {recording && (
        <div className="mt-2.5 rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2 text-[11px] text-indigo-900">
          {pending ? (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span>
                <b>{pending.teacher}</b> 선생님 {pending.day} {pending.period}교시 {pending.subject} 를 골랐습니다. 이제{" "}
                <b>맞바꾼 상대 수업 칸</b>(교체) 또는 <b>대신 들어간 선생님의 같은 시간 빈 칸</b>(보강)을 누르세요.
              </span>
              <button onClick={onCancelPending} className="shrink-0 font-bold text-indigo-600 hover:underline">
                취소
              </button>
            </div>
          ) : (
            <span>
              먼저 <b>원래 그 수업을 맡았던 선생님의 수업 칸</b>을 누르세요. 결강 주간 기준일이 속한 주로 기록됩니다.
            </span>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-[11px] font-bold text-rose-600">{error}</p>}

      {thisWeek.length > 0 && (
        <ul className="mt-2.5 space-y-1">
          {thisWeek.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-2 text-[11px] bg-white border border-indigo-200 rounded-lg px-2 py-1.5"
            >
              {c.kind === "swap" ? (
                <ArrowRightLeft className="w-3 h-3 text-indigo-500 shrink-0" />
              ) : (
                <UserPlus className="w-3 h-3 text-indigo-500 shrink-0" />
              )}
              <span className="flex-1 min-w-0 truncate text-stone-700">{describe(c)}</span>
              <button
                onClick={() => onRemove(c.id)}
                title="이 기록을 지웁니다 (시간표가 원래대로 돌아갑니다)"
                className="shrink-0 p-1 rounded text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
