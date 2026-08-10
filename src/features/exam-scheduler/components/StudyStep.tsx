'use client';

import { useMemo, useState } from 'react';
import { CircleAlert, DoorOpen, Undo2, Wand2 } from 'lucide-react';
import { DEFAULT_TOTAL_CLASSES, MAX_PER_ROOM } from '@/features/exam-scheduler/lib/domain/constants';
import { formatStudentLabel, periodLabel } from '@/features/exam-scheduler/lib/domain/normalize';
import { autoAllocateStudy, getStudySlotData } from '@/features/exam-scheduler/lib/scheduling/study';
import { excludedKeySet, useSchedulerStore } from '@/features/exam-scheduler/lib/store/schedulerStore';
import type { ClassOverflowWarning, StudyAssignment } from '@/features/exam-scheduler/lib/domain/types';
import { GroupTabs } from './GroupTabs';

/**
 * 4단계: 시험이 없는 교시의 학생을 빈 교실로 보냅니다.
 *
 * 보통은 "전체 자동 배정"으로 한 번에 끝내고, 어색한 교시만 손으로 고칩니다.
 */
export function StudyStep() {
  const groups = useSchedulerStore((s) => s.groups);
  const excludedStudents = useSchedulerStore((s) => s.excludedStudents);
  const setStudyAssignments = useSchedulerStore((s) => s.setStudyAssignments);
  const replaceAllStudyAssignments = useSchedulerStore(
    (s) => s.replaceAllStudyAssignments,
  );

  const [activeId, setActiveId] = useState(groups[0]?.id ?? '');
  const [totalClasses, setTotalClasses] = useState(DEFAULT_TOTAL_CLASSES);
  const [dateIndex, setDateIndex] = useState(0);
  const [periodIndex, setPeriodIndex] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetRoom, setTargetRoom] = useState('');
  const [warnings, setWarnings] = useState<ClassOverflowWarning[] | null>(null);

  const group = groups.find((g) => g.id === activeId) ?? groups[0];

  const date = group?.dates[dateIndex] ?? '';
  const period = periodLabel(periodIndex);

  const slot = useMemo(() => {
    if (!group || !date) return null;
    return getStudySlotData(
      group,
      date,
      period,
      totalClasses,
      excludedKeySet(excludedStudents, group.id),
    );
  }, [group, date, period, totalClasses, excludedStudents]);

  if (!group) return null;

  const hasDates = group.dates.some((d) => d.trim());

  function runAutoAllocate() {
    const excludedByGroup = Object.fromEntries(
      groups.map((g) => [g.id, excludedKeySet(excludedStudents, g.id)]),
    );
    const result = autoAllocateStudy(groups, totalClasses, excludedByGroup);
    replaceAllStudyAssignments(result.assignmentsByGroupId);
    setWarnings(result.warnings);
    setSelected(new Set());
  }

  /** 고른 학생을 지정한 교실로 보냅니다. */
  function assignSelected() {
    if (!slot || !targetRoom.trim() || selected.size === 0) return;

    const added: StudyAssignment[] = slot.unassigned
      .filter((s) => selected.has(studentId(s)))
      .map((s) => ({ ...s, room: targetRoom.trim(), timeSlot: `${date} ${period}` }));

    setStudyAssignments(group!.id, date, period, [...slot.assigned, ...added]);
    setSelected(new Set());
  }

  /** 한 교실의 배정을 통째로 되돌립니다. */
  function unassignRoom(room: string) {
    if (!slot) return;
    setStudyAssignments(
      group!.id,
      date,
      period,
      slot.assigned.filter((a) => a.room !== room),
    );
  }

  const byRoom = new Map<string, StudyAssignment[]>();
  for (const a of slot?.assigned ?? []) {
    const bucket = byRoom.get(a.room);
    if (bucket) bucket.push(a);
    else byRoom.set(a.room, [a]);
  }

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-lg font-semibold">자습 배정</h2>
        <p className="mt-1 text-sm text-ink-muted">
          그 교시에 시험이 없는 학생을, 시험에 쓰이지 않는 교실로 보냅니다. 시간표 칸에{' '}
          <code className="rounded bg-surface-muted px-1 py-0.5 text-xs">자습</code> 이라
          적어 두면 전원이 자기 학반으로 갑니다.
        </p>
      </header>

      <GroupTabs groups={groups} activeId={group.id} onChange={setActiveId} />

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-ink-muted">시험일</span>
          <select
            value={dateIndex}
            onChange={(e) => setDateIndex(Number(e.target.value))}
            className="rounded-lg border border-line bg-surface px-3 py-2"
          >
            {group.dates.map((d, i) => (
              <option key={i} value={i}>
                {d || `${i + 1}일차 (날짜 미정)`}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-ink-muted">교시</span>
          <select
            value={periodIndex}
            onChange={(e) => setPeriodIndex(Number(e.target.value))}
            className="rounded-lg border border-line bg-surface px-3 py-2"
          >
            {Array.from({ length: group.numPeriods }, (_, i) => (
              <option key={i} value={i}>
                {periodLabel(i)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-ink-muted">학급 수</span>
          <input
            type="number"
            min={1}
            max={20}
            value={totalClasses}
            onChange={(e) => setTotalClasses(Math.max(1, Number(e.target.value) || 1))}
            title="자습에 쓸 수 있는 교실 후보를 만드는 데 씁니다"
            className="w-24 rounded-lg border border-line bg-surface px-3 py-2"
          />
        </label>

        <button
          type="button"
          onClick={runAutoAllocate}
          disabled={!hasDates}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand/90 disabled:opacity-40"
        >
          <Wand2 className="size-4" aria-hidden />
          전체 자동 배정
        </button>
      </div>

      {!hasDates && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          시험일이 아직 정해지지 않았습니다. 2단계에서 날짜를 먼저 넣어 주세요.
        </div>
      )}

      {warnings !== null && (
        <div
          className={[
            'rounded-lg border p-4 text-sm',
            warnings.length > 0
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : 'border-line bg-surface-muted text-ink-muted',
          ].join(' ')}
        >
          {warnings.length === 0 ? (
            '자동 배정을 마쳤습니다. 학급 수를 넘는 교실은 만들어지지 않았습니다.'
          ) : (
            <>
              <p className="flex items-center gap-2 font-medium">
                <CircleAlert className="size-4" aria-hidden />
                실재하지 않는 교실이 {warnings.length}곳 만들어졌습니다
              </p>
              <p className="mt-1">
                빈 교실이 모자라 학급 번호를 이어 붙였습니다. 아래 교시를 열어 실제 쓸 수
                있는 교실로 고쳐 주세요.
              </p>
              <ul className="mt-2 space-y-1">
                {warnings.map((w, i) => (
                  <li key={i}>
                    · {w.groupName} {w.date} {w.period} → {w.exceededClass}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {slot && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-line">
            <header className="flex items-center justify-between border-b border-line px-4 py-3">
              <h3 className="text-sm font-semibold">
                미배정 {slot.unassigned.length}명
              </h3>
              {slot.unassigned.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setSelected(
                      selected.size === slot.unassigned.length
                        ? new Set()
                        : new Set(slot.unassigned.map(studentId)),
                    )
                  }
                  className="text-xs text-ink-muted underline-offset-2 hover:text-brand hover:underline"
                >
                  전체 선택
                </button>
              )}
            </header>

            <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-muted px-4 py-2 text-sm">
              <DoorOpen className="size-4 text-ink-muted" aria-hidden />
              <span className="text-ink-muted">빈 교실</span>
              {slot.emptyRooms.length === 0 ? (
                <span className="text-amber-800">없음 (모두 시험 중)</span>
              ) : (
                slot.emptyRooms.map((room) => (
                  <button
                    key={room}
                    type="button"
                    onClick={() => setTargetRoom(room)}
                    className="rounded-full border border-line bg-surface px-2 py-0.5 text-xs transition-colors hover:border-brand hover:text-brand"
                  >
                    {room}
                  </button>
                ))
              )}
            </div>

            <ul className="max-h-72 overflow-y-auto p-2 text-sm">
              {slot.unassigned.map((student) => {
                const id = studentId(student);
                return (
                  <li key={id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-surface-muted">
                      <input
                        type="checkbox"
                        checked={selected.has(id)}
                        onChange={() =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(id)) next.delete(id);
                            else next.add(id);
                            return next;
                          })
                        }
                        className="size-3.5 accent-[var(--color-brand)]"
                      />
                      {formatStudentLabel(student.className, student.number, student.name)}
                    </label>
                  </li>
                );
              })}
              {slot.unassigned.length === 0 && (
                <li className="px-2 py-6 text-center text-ink-muted">
                  모두 배정되었습니다.
                </li>
              )}
            </ul>

            <footer className="flex items-center gap-2 border-t border-line p-3">
              <input
                type="text"
                value={targetRoom}
                onChange={(e) => setTargetRoom(e.target.value)}
                placeholder="교실 (예: 2-7)"
                aria-label="배정할 교실"
                className="flex-1 rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-brand"
              />
              <button
                type="button"
                onClick={assignSelected}
                disabled={selected.size === 0 || !targetRoom.trim()}
                className="rounded-lg bg-brand px-3 py-1.5 text-sm text-white transition-colors hover:bg-brand/90 disabled:opacity-40"
              >
                {selected.size > 0 ? `${selected.size}명 배정` : '배정'}
              </button>
            </footer>
          </div>

          <div className="rounded-xl border border-line">
            <header className="border-b border-line px-4 py-3">
              <h3 className="text-sm font-semibold">배정됨 {slot.assigned.length}명</h3>
            </header>

            <div className="max-h-[26rem] overflow-y-auto p-3">
              {byRoom.size === 0 ? (
                <p className="py-6 text-center text-sm text-ink-muted">
                  아직 배정된 학생이 없습니다.
                </p>
              ) : (
                [...byRoom.entries()]
                  .sort(([a], [b]) => (a < b ? -1 : 1))
                  .map(([room, students]) => (
                    <div key={room} className="mb-3 rounded-lg border border-line">
                      <div className="flex items-center justify-between border-b border-line bg-surface-muted px-3 py-1.5 text-sm">
                        <span className="font-medium">
                          {room}
                          <span
                            className={
                              students.length > MAX_PER_ROOM
                                ? 'ml-2 text-xs font-semibold text-amber-800'
                                : 'ml-2 text-xs font-normal text-ink-muted'
                            }
                          >
                            {students.length}명
                            {students.length > MAX_PER_ROOM && ` (${MAX_PER_ROOM}명 초과)`}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => unassignRoom(room)}
                          className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-brand"
                        >
                          <Undo2 className="size-3.5" aria-hidden />
                          해제
                        </button>
                      </div>
                      <ul className="grid grid-cols-2 gap-x-3 p-2 text-sm sm:grid-cols-3">
                        {students.map((a, i) => (
                          <li key={i} className="truncate text-ink-muted">
                            {formatStudentLabel(a.className, a.number, a.name)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function studentId(student: { className: string; number: string; name: string }) {
  return `${student.className}|${student.number}|${student.name}`;
}
