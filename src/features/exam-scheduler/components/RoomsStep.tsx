'use client';

import { useMemo, useState } from 'react';
import { Combine, Scissors, Undo2, X } from 'lucide-react';
import { MAX_PER_ROOM } from '@/features/exam-scheduler/lib/domain/constants';
import { normalizeSubjectKey, periodLabel, stripSubjectCode } from '@/features/exam-scheduler/lib/domain/normalize';
import { pastelColorFor } from '@/features/exam-scheduler/lib/domain/subjectColor';
import { buildMergeInfo } from '@/features/exam-scheduler/lib/scheduling/merge';
import { calculateRoomSettings } from '@/features/exam-scheduler/lib/scheduling/roomSettings';
import { excludedKeySet, useSchedulerStore } from '@/features/exam-scheduler/lib/store/schedulerStore';
import type { GradeGroup, RoomSettingRow } from '@/features/exam-scheduler/lib/domain/types';
import { GroupTabs } from './GroupTabs';
import { SplitDialog } from './SplitDialog';

/**
 * 3단계: 과목·강의실별 인원을 보고 시험실을 정합니다.
 *
 * 시험실 칸은 강의실 이름에서 자동으로 채워지며, 그대로 두어도 됩니다.
 * 직접 고쳐 넣으면 그 값이 우선합니다.
 *
 * 왼쪽 시간표에서 과목을 누르면 오른쪽 배정 현황이 그 과목만 남도록 좁혀집니다.
 * 원본: 구 버전 `refreshRoomsView()`의 좌(시간표)·우(배정 현황) 분할 화면.
 */
export function RoomsStep() {
  const groups = useSchedulerStore((s) => s.groups);
  const excludedStudents = useSchedulerStore((s) => s.excludedStudents);
  const updateRoomMapping = useSchedulerStore((s) => s.updateRoomMapping);
  const setMergeMapping = useSchedulerStore((s) => s.setMergeMapping);
  const unmergeSubject = useSchedulerStore((s) => s.unmergeSubject);
  const clearSplitMapping = useSchedulerStore((s) => s.clearSplitMapping);

  const [activeId, setActiveId] = useState(groups[0]?.id ?? '');
  const [splitSubject, setSplitSubject] = useState<string | null>(null);
  // 필터 키는 normalizeSubjectKey 값(비교용), 라벨은 사람이 읽을 표시 문구입니다.
  const [filter, setFilter] = useState<{ key: string; label: string } | null>(null);
  const group = groups.find((g) => g.id === activeId) ?? groups[0];

  function changeGroup(groupId: string) {
    setActiveId(groupId);
    setFilter(null); // 학년을 바꾸면 필터는 의미가 없으므로 초기화합니다.
  }

  function toggleFilter(rawSubject: string) {
    const key = normalizeSubjectKey(rawSubject);
    if (!key) return;
    setFilter((current) => (current?.key === key ? null : { key, label: stripSubjectCode(rawSubject) }));
  }

  const rows = useMemo(() => {
    if (!group) return [];
    return calculateRoomSettings(group, excludedKeySet(excludedStudents, group.id));
  }, [group, excludedStudents]);

  const filteredRows = useMemo(() => {
    if (!filter) return rows;
    return rows.filter((row) => normalizeSubjectKey(row.subject) === filter.key);
  }, [rows, filter]);

  if (!group) return null;

  const splitPending = rows.filter(
    (row) => row.type === 'split_parent' && !group.splitMappings[row.subject],
  ).length;

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-lg font-semibold">시험실 배정</h2>
        <p className="mt-1 text-sm text-ink-muted">
          시험실은 강의실 이름에서 자동으로 채워집니다. 다른 교실을 쓸 때만 고쳐 주세요.
          한 시험실에 {MAX_PER_ROOM}명을 넘으면 분반 대상이 됩니다. 왼쪽 시간표에서 과목을
          누르면 오른쪽 목록이 그 과목만 보이도록 좁혀집니다.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <GroupTabs groups={groups} activeId={group.id} onChange={changeGroup} />
        {filter && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
            과목 필터: {filter.label}
            <button
              type="button"
              onClick={() => setFilter(null)}
              aria-label="과목 필터 해제"
              className="rounded-full p-0.5 hover:bg-brand/10"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        )}
      </div>

      {splitPending > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          아직 나누지 않은 분반 대상 과목이 {splitPending}개 있습니다. 나누기 전까지 해당
          과목 학생에게는 시험실이 배정되지 않습니다.
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line p-10 text-center text-sm text-ink-muted">
          배정할 과목이 없습니다. 2단계에서 시험 시간표를 먼저 채워 주세요.
        </div>
      ) : (
        <div className="grid gap-4 min-[1600px]:grid-cols-2">
          <RoomsTimetablePanel
            group={group}
            filterKey={filter?.key ?? null}
            onToggle={toggleFilter}
            onClear={() => setFilter(null)}
          />

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-ink">
              {group.name} 시험실 배정 현황
            </h3>
            {filteredRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line p-10 text-center text-sm text-ink-muted">
                배정할 시험실 데이터가 없습니다. (선택한 과목으로 필터링됨)
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="grid-table w-full text-sm">
                  <thead>
                    <tr>
                      <th className="min-w-24">과목</th>
                      <th className="min-w-36">강의실</th>
                      <th className="w-16">인원</th>
                      <th className="min-w-28">시험실</th>
                      <th className="min-w-28">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, i) => (
                      <RoomRow
                        key={`${row.subject}-${row.room}-${i}`}
                        row={row}
                        onAssign={(value) =>
                          updateRoomMapping(group.id, `${row.subject}_${row.room}`, value)
                        }
                        onSplit={() => setSplitSubject(row.subject)}
                        onUnsplit={() => clearSplitMapping(group.id, row.subject)}
                        onMerge={() => {
                          const info = buildMergeInfo(group, row.subject);
                          if (info) setMergeMapping(group.id, row.subject, info);
                        }}
                        onUnmerge={() => unmergeSubject(group.id, row.subject)}
                        hasSplit={Boolean(group.splitMappings[row.subject])}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {splitSubject && (
        <SplitDialog
          group={group}
          subject={splitSubject}
          onClose={() => setSplitSubject(null)}
        />
      )}
    </section>
  );
}

interface RoomsTimetablePanelProps {
  group: GradeGroup;
  filterKey: string | null;
  onToggle: (rawSubject: string) => void;
  onClear: () => void;
}

/** 왼쪽 패널: 읽기 전용 시간표. 칸마다 과목 버튼이 있어 눌러서 필터를 걸 수 있습니다. */
function RoomsTimetablePanel({ group, filterKey, onToggle, onClear }: RoomsTimetablePanelProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">시간표 기반 과목 필터</h3>
        {filterKey && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-line px-2.5 py-1 text-xs transition-colors hover:bg-surface-muted"
          >
            전체 과목 보기
          </button>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="grid-table w-full text-xs">
          <thead>
            <tr>
              <th className="min-w-14">교시</th>
              {group.dates.map((date, day) => (
                <th key={day} className="min-w-24">
                  {date || `${day + 1}일차`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {group.timetable.map((row, period) => (
              <tr key={period}>
                <th>{periodLabel(period)}</th>
                {row.map((cell, day) => {
                  const subjects = cell
                    .split('/')
                    .map((s) => s.trim())
                    .filter(Boolean);
                  return (
                    <td key={day} className="p-1 align-top">
                      {subjects.length === 0 ? (
                        <span className="block py-2 text-center text-ink-muted/40">-</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {subjects.map((subject, i) => {
                            const key = normalizeSubjectKey(subject);
                            const isSelected = filterKey !== null && filterKey === key;
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => onToggle(subject)}
                                style={isSelected ? undefined : { backgroundColor: pastelColorFor(key) }}
                                className={[
                                  'w-full rounded-lg px-2 py-1.5 text-center font-medium transition-all',
                                  isSelected
                                    ? 'bg-brand text-white shadow-sm ring-2 ring-brand/30'
                                    : 'text-ink hover:opacity-80',
                                ].join(' ')}
                              >
                                {subject}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface RoomRowProps {
  row: RoomSettingRow;
  hasSplit: boolean;
  onAssign: (value: string) => void;
  onSplit: () => void;
  onUnsplit: () => void;
  onMerge: () => void;
  onUnmerge: () => void;
}

function RoomRow({
  row,
  hasSplit,
  onAssign,
  onSplit,
  onUnsplit,
  onMerge,
  onUnmerge,
}: RoomRowProps) {
  const isHeader = row.type === 'split_parent' || row.type === 'merge_recommend';
  const isChild = row.type === 'split_child' || row.type === 'merge_child';

  return (
    <tr className={isHeader ? 'bg-brand-soft/50' : undefined}>
      <td className={isChild ? 'text-ink-muted' : 'font-medium'}>
        {isChild ? '' : row.subject}
      </td>
      <td className={isChild ? 'pl-6 text-left' : undefined}>
        {isChild && <span className="mr-1 text-ink-muted">└</span>}
        {row.room}
        {row.originalRooms && (
          <span className="ml-2 text-xs text-ink-muted">
            ({row.originalRooms.join(', ')})
          </span>
        )}
      </td>
      <td className="tabular-nums">{row.count}</td>
      <td className="p-0">
        {isHeader ? (
          <span className="text-ink-muted">—</span>
        ) : (
          <input
            type="text"
            value={row.assignedRoom ?? ''}
            onChange={(e) => onAssign(e.target.value)}
            aria-label={`${row.subject} ${row.room} 시험실`}
            className="w-full bg-transparent px-2 py-1.5 text-center outline-none focus:bg-brand-soft"
          />
        )}
      </td>
      <td>
        {row.type === 'split_parent' && (
          <span className="flex justify-center gap-1">
            <RowButton icon={<Scissors className="size-3.5" />} onClick={onSplit}>
              {hasSplit ? '분반 수정' : '분반 나누기'}
            </RowButton>
            {hasSplit && (
              <RowButton icon={<Undo2 className="size-3.5" />} onClick={onUnsplit}>
                해제
              </RowButton>
            )}
          </span>
        )}
        {row.type === 'merge_recommend' && (
          <RowButton icon={<Combine className="size-3.5" />} onClick={onMerge}>
            합반하기
          </RowButton>
        )}
        {row.type === 'merged' && (
          <RowButton icon={<Undo2 className="size-3.5" />} onClick={onUnmerge}>
            합반 해제
          </RowButton>
        )}
      </td>
    </tr>
  );
}

function RowButton({
  icon,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded border border-line bg-surface px-2 py-1 text-xs transition-colors hover:border-brand hover:text-brand"
    >
      {icon}
      {children}
    </button>
  );
}
