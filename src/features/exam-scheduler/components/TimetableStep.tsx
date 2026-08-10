'use client';

import { useMemo, useState } from 'react';
import { CalendarPlus, CopyCheck, Minus, Plus } from 'lucide-react';
import { useSchedulerStore } from '@/features/exam-scheduler/lib/store/schedulerStore';
import { periodLabel } from '@/features/exam-scheduler/lib/domain/normalize';
import { parseClipboardGrid } from '@/features/exam-scheduler/lib/domain/pasteGrid';
import { GroupTabs } from './GroupTabs';

/**
 * 2단계: 시험 시간표를 짭니다.
 *
 * 격자의 행은 교시, 열은 시험일입니다. 한 칸에 과목을 여러 개 넣을 때는 `/`로 구분합니다
 * (예: `화학 I/생명과학Ⅰ`). 여기 적은 과목명이 명단의 과목명과 맞아떨어져야
 * 3단계에서 시험실이 잡히므로, 아래 과목 목록에서 골라 넣는 편이 안전합니다.
 *
 * 엑셀에서 여러 칸을 복사해 그대로 붙여넣을 수 있습니다 — 시작 칸을 클릭한 뒤
 * Ctrl+V 하면 복사한 범위가 그 자리를 기준으로 오른쪽·아래로 채워집니다.
 * 붙여넣은 범위가 지금 시간표보다 크면 시험일·교시가 자동으로 늘어납니다.
 */
export function TimetableStep() {
  const groups = useSchedulerStore((s) => s.groups);
  const updateTimetableCell = useSchedulerStore((s) => s.updateTimetableCell);
  const pasteTimetableBlock = useSchedulerStore((s) => s.pasteTimetableBlock);
  const updateDate = useSchedulerStore((s) => s.updateDate);
  const updatePeriodTime = useSchedulerStore((s) => s.updatePeriodTime);
  const resizeTimetable = useSchedulerStore((s) => s.resizeTimetable);
  const autoFillDates = useSchedulerStore((s) => s.autoFillDates);
  const syncDates = useSchedulerStore((s) => s.syncDatesFromFirstGroup);
  const syncPeriodTimes = useSchedulerStore((s) => s.syncPeriodTimesFromFirstGroup);

  const [activeId, setActiveId] = useState(groups[0]?.id ?? '');
  const group = groups.find((g) => g.id === activeId) ?? groups[0];

  // 명단에 실제로 있는 과목만 추천합니다. 오타로 매칭이 깨지는 것을 막기 위함입니다.
  const subjects = useMemo(() => {
    if (!group) return [];
    return [...new Set(group.records.map((r) => r.subject))].filter(Boolean).sort();
  }, [group]);

  if (!group) return null;

  const listId = `subjects-${group.id}`;

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-lg font-semibold">시험 시간표</h2>
        <p className="mt-1 text-sm text-ink-muted">
          행은 교시, 열은 시험일입니다. 한 칸에 여러 과목을 넣을 때는{' '}
          <code className="rounded bg-surface-muted px-1 py-0.5 text-xs">/</code> 로
          구분하세요. 시험이 없는 칸은 비워 둡니다. 엑셀에서 여러 칸을 복사해 시작 칸에
          그대로 붙여넣을 수 있습니다.
        </p>
      </header>

      <GroupTabs groups={groups} activeId={group.id} onChange={setActiveId} />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => autoFillDates(group.id)}
          disabled={!group.dates[0]}
          title="첫 시험일을 기준으로 주말을 건너뛰며 나머지 날짜를 채웁니다"
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm transition-colors hover:bg-surface-muted disabled:opacity-40"
        >
          <CalendarPlus className="size-4" aria-hidden />
          날짜 자동 채우기
        </button>

        {groups.length > 1 && (
          <>
            <button
              type="button"
              onClick={syncDates}
              title={`${groups[0].name}의 날짜를 나머지 학년에 복사합니다`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm transition-colors hover:bg-surface-muted"
            >
              <CopyCheck className="size-4" aria-hidden />
              전 학년 날짜 맞추기
            </button>
            <button
              type="button"
              onClick={syncPeriodTimes}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm transition-colors hover:bg-surface-muted"
            >
              <CopyCheck className="size-4" aria-hidden />
              전 학년 교시 시각 맞추기
            </button>
          </>
        )}

        <span className="ml-auto flex items-center gap-3 text-sm text-ink-muted">
          <Stepper
            label="시험일"
            value={group.numDays}
            onDecrease={() => resizeTimetable(group.id, 0, -1)}
            onIncrease={() => resizeTimetable(group.id, 0, 1)}
          />
          <Stepper
            label="교시"
            value={group.numPeriods}
            onDecrease={() => resizeTimetable(group.id, -1, 0)}
            onIncrease={() => resizeTimetable(group.id, 1, 0)}
          />
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="grid-table w-full text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-32">교시 \ 시험일</th>
              {group.dates.map((date, day) => (
                <th key={day} className="min-w-40">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => updateDate(group.id, day, e.target.value)}
                    aria-label={`${day + 1}일차 시험일`}
                    className="w-full bg-transparent text-center outline-none focus:bg-white"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {group.timetable.map((row, period) => (
              <tr key={period}>
                <th className="sticky left-0 z-10">
                  <div className="font-semibold">{periodLabel(period)}</div>
                  <input
                    type="text"
                    value={group.periodTimes[period] ?? ''}
                    placeholder="09:00~09:50"
                    onChange={(e) => updatePeriodTime(group.id, period, e.target.value)}
                    aria-label={`${periodLabel(period)} 시각`}
                    className="mt-0.5 w-full bg-transparent text-center text-xs font-normal text-ink-muted outline-none placeholder:text-ink-muted/50 focus:bg-white"
                  />
                </th>
                {row.map((cell, day) => (
                  <td key={day} className="p-0">
                    <input
                      type="text"
                      list={listId}
                      value={cell}
                      onChange={(e) =>
                        updateTimetableCell(group.id, period, day, e.target.value)
                      }
                      onPaste={(e) => {
                        const text = e.clipboardData.getData('text/plain');
                        if (!text) return;
                        e.preventDefault();
                        pasteTimetableBlock(
                          group.id,
                          period,
                          day,
                          parseClipboardGrid(text),
                        );
                      }}
                      aria-label={`${periodLabel(period)} ${day + 1}일차 과목`}
                      className="w-full bg-transparent px-2 py-1.5 text-center outline-none focus:bg-brand-soft"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <datalist id={listId}>
        {subjects.map((subject) => (
          <option key={subject} value={subject} />
        ))}
      </datalist>

      <details className="rounded-lg border border-line bg-surface-muted p-4 text-sm">
        <summary className="cursor-pointer font-medium">
          {group.name} 명단의 과목 {subjects.length}개
        </summary>
        <p className="mt-2 text-ink-muted">
          시간표에 적은 과목명이 아래 이름과 맞아떨어져야 시험실이 배정됩니다. 괄호 안 학점,
          공백, 전각 로마숫자(Ⅰ)는 자동으로 걸러지니 신경 쓰지 않아도 됩니다.
        </p>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {subjects.map((subject) => (
            <li
              key={subject}
              className="rounded-full bg-surface px-2.5 py-1 text-xs text-ink-muted"
            >
              {subject}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

interface StepperProps {
  label: string;
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
}

function Stepper({ label, value, onDecrease, onIncrease }: StepperProps) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <button
        type="button"
        onClick={onDecrease}
        disabled={value <= 1}
        aria-label={`${label} 줄이기`}
        className="rounded border border-line p-1 transition-colors hover:bg-surface-muted disabled:opacity-30"
      >
        <Minus className="size-3.5" aria-hidden />
      </button>
      <span className="w-5 text-center font-medium text-ink">{value}</span>
      <button
        type="button"
        onClick={onIncrease}
        aria-label={`${label} 늘리기`}
        className="rounded border border-line p-1 transition-colors hover:bg-surface-muted"
      >
        <Plus className="size-3.5" aria-hidden />
      </button>
    </span>
  );
}
