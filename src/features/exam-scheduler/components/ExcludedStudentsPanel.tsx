'use client';

import { useMemo, useState } from 'react';
import { Search, UserMinus, UserPlus } from 'lucide-react';
import { formatStudentLabel, makeStudentKey } from '@/features/exam-scheduler/lib/domain/normalize';
import { distinctStudents } from '@/features/exam-scheduler/lib/scheduling/study';
import { useSchedulerStore } from '@/features/exam-scheduler/lib/store/schedulerStore';
import { GroupTabs } from './GroupTabs';

/** 검색 결과를 한 번에 보여줄 최대 인원. 전교생을 다 그리면 느려집니다. */
const SEARCH_LIMIT = 30;

/**
 * 제외 학생 관리.
 *
 * 전학·장기결석 등으로 시험을 보지 않는 학생을 빼 둡니다.
 * 제외한 학생은 **시험실 배정과 자습 배정 양쪽에서 모두** 빠지므로,
 * 결과 엑셀 어디에도 나오지 않습니다.
 */
export function ExcludedStudentsPanel() {
  const groups = useSchedulerStore((s) => s.groups);
  const excludedStudents = useSchedulerStore((s) => s.excludedStudents);
  const excludeStudent = useSchedulerStore((s) => s.excludeStudent);
  const unexcludeStudent = useSchedulerStore((s) => s.unexcludeStudent);

  const [activeId, setActiveId] = useState(groups[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [reason, setReason] = useState('');

  const group = groups.find((g) => g.id === activeId) ?? groups[0];

  const excludedHere = useMemo(
    () => (group ? excludedStudents.filter((e) => e.groupId === group.id) : []),
    [excludedStudents, group],
  );

  const matches = useMemo(() => {
    if (!group) return [];

    const excludedKeys = new Set(
      excludedHere.map((e) => makeStudentKey(e.className, e.number, e.name)),
    );
    const students = distinctStudents(group, excludedKeys);

    const needle = query.trim();
    if (!needle) return students.slice(0, SEARCH_LIMIT);

    return students
      .filter((s) =>
        formatStudentLabel(s.className, s.number, s.name).includes(needle) ||
        s.name.includes(needle),
      )
      .slice(0, SEARCH_LIMIT);
  }, [group, query, excludedHere]);

  if (!group) return null;

  const totalStudents = distinctStudents(group).length;

  return (
    <section className="space-y-4 rounded-xl border border-line bg-surface-muted p-4">
      <header>
        <h3 className="text-sm font-semibold">제외 학생 관리</h3>
        <p className="mt-1 text-xs text-ink-muted">
          전학·장기결석 등으로 시험을 보지 않는 학생을 빼 둡니다. 제외한 학생은{' '}
          <strong>시험실 배정과 자습 배정 모두에서</strong> 빠져 결과 엑셀에 나오지
          않습니다.
        </p>
      </header>

      <GroupTabs groups={groups} activeId={group.id} onChange={setActiveId} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-surface">
          <div className="space-y-2 border-b border-line p-3">
            <label className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5">
              <Search className="size-4 shrink-0 text-ink-muted" aria-hidden />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이름 또는 반·번호로 찾기"
                aria-label="학생 검색"
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="사유 (예: 전학, 장기결석) — 선택"
              aria-label="제외 사유"
              className="w-full rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-brand"
            />
          </div>

          <ul className="max-h-72 overflow-y-auto p-2 text-sm">
            {matches.map((student) => (
              <li
                key={makeStudentKey(student.className, student.number, student.name)}
                className="flex items-center justify-between rounded px-2 py-1 hover:bg-surface-muted"
              >
                <span>{formatStudentLabel(student.className, student.number, student.name)}</span>
                <button
                  type="button"
                  onClick={() =>
                    excludeStudent({
                      groupId: group.id,
                      className: student.className,
                      number: student.number,
                      name: student.name,
                      reason: reason.trim(),
                    })
                  }
                  className="inline-flex items-center gap-1 rounded border border-line px-2 py-0.5 text-xs transition-colors hover:border-red-400 hover:text-red-600"
                >
                  <UserMinus className="size-3.5" aria-hidden />
                  제외
                </button>
              </li>
            ))}
            {matches.length === 0 && (
              <li className="px-2 py-6 text-center text-xs text-ink-muted">
                {query.trim() ? '찾는 학생이 없습니다.' : '학생이 없습니다.'}
              </li>
            )}
          </ul>

          <p className="border-t border-line px-3 py-2 text-xs text-ink-muted">
            {group.name} 재적 {totalStudents - excludedHere.length}명 / 전체{' '}
            {totalStudents}명
            {matches.length === SEARCH_LIMIT && ` · 앞 ${SEARCH_LIMIT}명만 표시`}
          </p>
        </div>

        <div className="rounded-lg border border-line bg-surface">
          <header className="border-b border-line px-3 py-2 text-sm font-medium">
            제외된 학생 {excludedHere.length}명
          </header>

          <ul className="max-h-[19rem] overflow-y-auto p-2 text-sm">
            {excludedHere.map((student) => (
              <li
                key={makeStudentKey(student.className, student.number, student.name)}
                className="flex items-center justify-between rounded px-2 py-1 hover:bg-surface-muted"
              >
                <span>
                  {formatStudentLabel(student.className, student.number, student.name)}
                  {student.reason && (
                    <span className="ml-2 text-xs text-ink-muted">
                      — {student.reason}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    unexcludeStudent(
                      group.id,
                      student.className,
                      student.number,
                      student.name,
                    )
                  }
                  className="inline-flex items-center gap-1 rounded border border-line px-2 py-0.5 text-xs transition-colors hover:border-brand hover:text-brand"
                >
                  <UserPlus className="size-3.5" aria-hidden />
                  해제
                </button>
              </li>
            ))}
            {excludedHere.length === 0 && (
              <li className="px-2 py-6 text-center text-xs text-ink-muted">
                제외된 학생이 없습니다.
              </li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
