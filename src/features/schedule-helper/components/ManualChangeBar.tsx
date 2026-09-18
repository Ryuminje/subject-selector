"use client";

import { useState } from "react";
import { ArrowRightLeft, PencilLine, Trash2, UserPlus, X } from "lucide-react";
import { affectsWeek, type ManualChange, type ManualSlot } from "@/features/schedule-helper/lib/manualChanges";
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
  /** 결강일·교체일 수정. 실패 문구를 돌려줍니다(요일이 다른 날짜 등). */
  onUpdateDate: (id: string, dates: { absentDate?: string; exchangeDate?: string }) => Promise<string | null>;
  error: string | null;
}

/** 기록의 한 칸 — 날짜를 바로 고칠 수 있는 입력칸 + 요일·교시. 요일은 시간표 칸이 정하므로 고정입니다. */
function SlotDate({ slot, onChange, title }: { slot: ManualSlot; onChange: (date: string) => void; title: string }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <input
        type="date"
        value={slot.date}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        title={title}
        className="border border-indigo-200 rounded px-1 py-0.5 text-[11px] w-[112px] bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
      />
      <span className="text-stone-500">({slot.day}) {slot.period}교시</span>
    </span>
  );
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
  onUpdateDate,
  error,
}: Props) {
  const [dateError, setDateError] = useState<string | null>(null);
  // "week" = 결강 주간 기준일이 속한 주, 아니면 "YYYY-MM" 달 하나.
  const [view, setView] = useState<string>("week");
  const monthsOf = (c: ManualChange) =>
    new Set([c.absent.date.slice(0, 7), ...(c.exchange ? [c.exchange.date.slice(0, 7)] : [])]);
  const thisWeek = changes.filter((c) => affectsWeek(c, baseDate));
  const months = [...new Set(changes.flatMap((c) => [...monthsOf(c)]))].sort();
  const monthLabel = (ym: string) => {
    const [y, m] = ym.split("-");
    return y === baseDate.slice(0, 4) ? `${Number(m)}월` : `${y}년 ${Number(m)}월`;
  };
  const byDate = (a: ManualChange, b: ManualChange) => a.absent.date.localeCompare(b.absent.date) || a.absent.period - b.absent.period;
  // 고른 달이 (날짜 수정·삭제로) 더는 기록이 없으면 이번 주로 돌아갑니다.
  const activeView = view !== "week" && !months.includes(view) ? "week" : view;
  const listed = (activeView === "week" ? thisWeek : changes.filter((c) => monthsOf(c).has(activeView))).slice().sort(byDate);

  const changeDate = async (id: string, dates: { absentDate?: string; exchangeDate?: string }) => {
    setDateError(await onUpdateDate(id, dates));
  };

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
      {dateError && <p className="mt-2 text-[11px] font-bold text-rose-600">{dateError}</p>}

      {changes.length > 0 && (
        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap text-[11px]">
          {[{ key: "week", label: "이번 주", count: thisWeek.length }, ...months.map((m) => ({ key: m, label: monthLabel(m), count: changes.filter((c) => monthsOf(c).has(m)).length }))].map((chip) => (
            <button
              key={chip.key}
              onClick={() => setView(chip.key)}
              className={cn(
                "px-2 py-0.5 rounded-full border font-bold transition-colors",
                activeView === chip.key
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "bg-white border-stone-200 text-stone-600 hover:bg-stone-100"
              )}
            >
              {chip.label} <span className="opacity-70">{chip.count}</span>
            </button>
          ))}
        </div>
      )}
      {changes.length > 0 && listed.length === 0 && (
        <p className="mt-2 text-[11px] text-stone-400">이번 주에 걸린 기록이 없습니다.</p>
      )}

      {listed.length > 0 && (
        <ul className="mt-2.5 space-y-1">
          {listed.map((c) => (
            <li
              key={c.id}
              className={cn(
                "flex items-center gap-2 text-[11px] border rounded-lg px-2 py-1.5",
                affectsWeek(c, baseDate) ? "bg-white border-indigo-200" : "bg-stone-100 border-stone-200"
              )}
            >
              {c.kind === "swap" ? (
                <ArrowRightLeft className="w-3 h-3 text-indigo-500 shrink-0" />
              ) : (
                <UserPlus className="w-3 h-3 text-indigo-500 shrink-0" />
              )}
              <span className="flex-1 min-w-0 flex items-center gap-x-1.5 gap-y-1 flex-wrap text-stone-700">
                {c.kind === "sub" ? (
                  <>
                    <SlotDate slot={c.absent} title="결강일" onChange={(d) => changeDate(c.id, { absentDate: d })} />
                    <span>
                      <b>{c.absentTeacher}</b> → <b>{c.partnerTeacher}</b> 보강
                    </span>
                  </>
                ) : (
                  <>
                    <b>{c.absentTeacher}</b>
                    <SlotDate slot={c.absent} title="결강일" onChange={(d) => changeDate(c.id, { absentDate: d })} />
                    <span className="text-indigo-400">↔</span>
                    <b>{c.partnerTeacher}</b>
                    <SlotDate slot={c.exchange!} title="교체일" onChange={(d) => changeDate(c.id, { exchangeDate: d })} />
                  </>
                )}
                {activeView !== "week" && affectsWeek(c, baseDate) && <span className="text-indigo-500 font-bold">(이번 주)</span>}
              </span>
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

      {activeView !== "week" && (
        <p className="mt-1.5 text-[10px] text-stone-400">기록은 마지막 날짜로부터 60일이 지나면 자동으로 정리됩니다.</p>
      )}
    </div>
  );
}
