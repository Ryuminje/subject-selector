'use client';

import { useMemo, useState } from 'react';
import { CircleAlert, DoorOpen, FileDown, Users, X } from 'lucide-react';
import { buildResults } from '@/features/exam-scheduler/lib/scheduling/buildResults';
import { downloadResultsExcel } from '@/features/exam-scheduler/lib/excel/exportResults';
import { downloadClassSchedules } from '@/features/exam-scheduler/lib/excel/exportClassSchedules';
import { downloadStudyList } from '@/features/exam-scheduler/lib/excel/exportStudyList';
import { downloadEnvelope } from '@/features/exam-scheduler/lib/excel/exportEnvelope';
import { downloadIndividualTimetable } from '@/features/exam-scheduler/lib/excel/exportIndividual';
import { normalizeSubjectKey, splitTimetableCell } from '@/features/exam-scheduler/lib/domain/normalize';
import { excludedKeySet, useSchedulerStore } from '@/features/exam-scheduler/lib/store/schedulerStore';
import { GroupTabs } from './GroupTabs';

/**
 * 5단계: 시험실 배정 결과를 확인합니다.
 *
 * 표시되는 좌석번호는 실제 출력될 값과 같습니다
 * (`buildResults` — 구 버전 `build_result_df`의 이식본).
 */
export function ResultsStep() {
  const groups = useSchedulerStore((s) => s.groups);
  const excludedStudents = useSchedulerStore((s) => s.excludedStudents);

  const [activeId, setActiveId] = useState(groups[0]?.id ?? '');
  /** 지금 만들고 있는 출력의 이름. 버튼 하나만 '만드는 중'으로 바뀌도록 씁니다. */
  const [busy, setBusy] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const group = groups.find((g) => g.id === activeId) ?? groups[0];

  function changeGroup(groupId: string) {
    setActiveId(groupId);
    // 학년이 바뀌면 시험시간·과목 목록 자체가 달라지므로 필터를 초기화합니다.
    setTimeFilter('');
    setSubjectFilter('');
  }

  /** 출력을 하나 실행합니다. 만들 게 없으면 이유를 알려 줍니다. */
  async function runExport(
    key: string,
    make: () => Promise<boolean>,
    emptyMessage: string,
  ) {
    setBusy(key);
    try {
      if (!(await make())) alert(emptyMessage);
    } finally {
      setBusy(null);
    }
  }

  const excludedKeysByGroup = () =>
    Object.fromEntries(groups.map((g) => [g.id, excludedKeySet(excludedStudents, g.id)]));

  const rows = useMemo(() => {
    if (!group) return [];
    return buildResults(group, excludedKeySet(excludedStudents, group.id));
  }, [group, excludedStudents]);

  /** 명단에는 있는데 시간표에 안 적힌 과목. 대개 시간표를 덜 채운 것입니다. */
  const missingSubjects = useMemo(() => {
    if (!group) return [];
    const scheduled = new Set(
      group.timetable.flatMap((row) => row.flatMap(splitTimetableCell)),
    );
    const missing = new Map<string, string>();
    for (const record of group.records) {
      if (!record.subject) continue;
      if (scheduled.has(normalizeSubjectKey(record.subject))) continue;
      missing.set(record.subject, record.subject);
    }
    return [...missing.values()].sort();
  }, [group]);

  const roomless = useMemo(() => rows.filter((row) => !row.examRoom), [rows]);
  const roomCount = useMemo(
    () => new Set(rows.map((row) => `${row.examDate}|${row.examPeriod}|${row.examRoom}`)).size,
    [rows],
  );

  // rows는 이미 시험일자·교시 순으로 정렬돼 있으므로, Set으로 중복만 걸러내면
  // 시험시간 목록도 자연히 그 순서를 따라갑니다.
  const examTimes = useMemo(() => [...new Set(rows.map((row) => row.examTime))], [rows]);
  const subjects = useMemo(
    () => [...new Set(rows.map((row) => row.subject))].sort(),
    [rows],
  );

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          (!timeFilter || row.examTime === timeFilter) &&
          (!subjectFilter || row.subject === subjectFilter),
      ),
    [rows, timeFilter, subjectFilter],
  );

  if (!group) return null;

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-lg font-semibold">결과 · 출력</h2>
        <p className="mt-1 text-sm text-ink-muted">
          시간표와 시험실 설정을 반영한 최종 배정입니다. 좌석번호는 실제 출력될 값과
          같습니다.
        </p>
      </header>

      <GroupTabs groups={groups} activeId={group.id} onChange={changeGroup} />

      <div className="rounded-xl border border-line bg-surface-muted p-4">
        <h3 className="text-sm font-semibold">엑셀 출력</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <ExportButton
            primary
            busy={busy === 'all'}
            disabled={busy !== null}
            onClick={() =>
              runExport(
                'all',
                () =>
                  downloadResultsExcel(groups, '전체학년_최종_시험시간표.xlsx', {
                    excludedKeysByGroup: excludedKeysByGroup(),
                  }),
                '저장할 데이터가 없습니다. 시간표와 시험실을 확인하세요.',
              )
            }
          >
            전체 학년 통합 시간표
          </ExportButton>

          <ExportButton
            busy={busy === 'class'}
            disabled={busy !== null}
            onClick={() =>
              runExport(
                'class',
                () =>
                  downloadClassSchedules(
                    group,
                    excludedKeySet(excludedStudents, group.id),
                  ),
                '저장할 데이터가 없습니다. 시간표와 시험실을 확인하세요.',
              )
            }
          >
            {group.name} 학급별 시간표
          </ExportButton>

          <ExportButton
            busy={busy === 'individual'}
            disabled={busy !== null}
            onClick={() =>
              runExport(
                'individual',
                () =>
                  downloadIndividualTimetable(
                    group,
                    excludedKeySet(excludedStudents, group.id),
                  ),
                '저장할 데이터가 없습니다. 시간표와 시험실을 확인하세요.',
              )
            }
          >
            {group.name} 개인별 시간표
          </ExportButton>

          <ExportButton
            busy={busy === 'study'}
            disabled={busy !== null}
            onClick={() =>
              runExport(
                'study',
                () => downloadStudyList(group),
                '배정된 자습 명단이 없습니다. 4단계에서 자습 배정을 먼저 해주세요.',
              )
            }
          >
            {group.name} 통합 자습명단
          </ExportButton>

          <ExportButton
            busy={busy === 'envelope'}
            disabled={busy !== null}
            onClick={() =>
              runExport(
                'envelope',
                async () => downloadEnvelope(groups, excludedKeysByGroup()),
                '표지를 만들 데이터가 없습니다. 시간표와 시험실을 확인하세요.',
              )
            }
          >
            시험지 봉투 표지 (.xls)
          </ExportButton>
        </div>
        <p className="mt-3 text-xs text-ink-muted">
          학년별 출력은 위 학년 탭에서 고른 학년으로 나갑니다. 봉투 표지는 한글 메일머지에
          쓰이므로 <code>.xls</code> 형식입니다.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={<Users className="size-4" />} label="배정된 응시 건수" value={rows.length} />
        <Stat icon={<DoorOpen className="size-4" />} label="시험실 · 교시 조합" value={roomCount} />
        <Stat
          icon={<CircleAlert className="size-4" />}
          label="시험실 미정"
          value={roomless.length}
          warn={roomless.length > 0}
        />
      </div>

      {missingSubjects.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium text-amber-900">
            <CircleAlert className="size-4" aria-hidden />
            시간표에 없는 과목 {missingSubjects.length}개
          </p>
          <p className="mt-1 text-amber-800">
            이 과목들은 결과에 나오지 않습니다. 시험을 보지 않는 과목이면 정상입니다.
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {missingSubjects.map((subject) => (
              <li key={subject} className="rounded-full bg-white px-2.5 py-1 text-xs text-amber-900">
                {subject}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line p-10 text-center text-sm text-ink-muted">
          아직 배정된 결과가 없습니다. 2단계에서 시험 시간표를 먼저 채워 주세요.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-muted">
              {timeFilter || subjectFilter ? (
                <>
                  {filteredRows.length.toLocaleString('ko-KR')}건 표시 중 (전체{' '}
                  {rows.length.toLocaleString('ko-KR')}건)
                </>
              ) : (
                <>전체 {rows.length.toLocaleString('ko-KR')}건</>
              )}
            </span>
            {(timeFilter || subjectFilter) && (
              <button
                type="button"
                onClick={() => {
                  setTimeFilter('');
                  setSubjectFilter('');
                }}
                className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand"
              >
                <X className="size-3" aria-hidden />
                필터 해제
              </button>
            )}
          </div>

          <div className="max-h-[32rem] overflow-auto rounded-lg border border-line">
            <table className="grid-table w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th>
                    <div className="flex flex-col items-center gap-1">
                      <span>시험시간</span>
                      <select
                        value={timeFilter}
                        onChange={(e) => setTimeFilter(e.target.value)}
                        aria-label="시험시간으로 필터"
                        className="w-full max-w-32 rounded border border-line bg-surface px-1 py-0.5 text-xs font-normal outline-none focus:border-brand"
                      >
                        <option value="">전체</option>
                        {examTimes.map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th>시험실</th>
                  <th>좌석</th>
                  <th>반</th>
                  <th>번호</th>
                  <th>성명</th>
                  <th>
                    <div className="flex flex-col items-center gap-1">
                      <span>과목명</span>
                      <select
                        value={subjectFilter}
                        onChange={(e) => setSubjectFilter(e.target.value)}
                        aria-label="과목명으로 필터"
                        className="w-full max-w-28 rounded border border-line bg-surface px-1 py-0.5 text-xs font-normal outline-none focus:border-brand"
                      >
                        <option value="">전체</option>
                        {subjects.map((subject) => (
                          <option key={subject} value={subject}>
                            {subject}
                          </option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th>개설강의실</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, i) => (
                  <tr key={i} className={row.examRoom ? undefined : 'bg-amber-50'}>
                    <td>{row.examTime}</td>
                    <td className="font-medium">{row.examRoom || '—'}</td>
                    <td>{row.seatNo}</td>
                    <td>{row.className}</td>
                    <td>{row.number}</td>
                    <td>{row.name}</td>
                    <td>{row.subject}</td>
                    <td className="text-ink-muted">{row.courseRoom}</td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-ink-muted">
                      필터 조건에 맞는 결과가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

interface ExportButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
  primary?: boolean;
}

function ExportButton({
  children,
  onClick,
  busy,
  disabled,
  primary,
}: ExportButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-40',
        primary
          ? 'bg-brand text-white hover:bg-brand/90'
          : 'border border-line bg-surface hover:bg-brand-soft',
      ].join(' ')}
    >
      <FileDown className="size-4" aria-hidden />
      {busy ? '만드는 중…' : children}
    </button>
  );
}

interface StatProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  warn?: boolean;
}

function Stat({ icon, label, value, warn }: StatProps) {
  return (
    <div
      className={[
        'rounded-xl border p-4',
        warn ? 'border-amber-300 bg-amber-50' : 'border-line bg-surface',
      ].join(' ')}
    >
      <p
        className={[
          'flex items-center gap-1.5 text-xs',
          warn ? 'text-amber-900' : 'text-ink-muted',
        ].join(' ')}
      >
        {icon}
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {value.toLocaleString('ko-KR')}
      </p>
    </div>
  );
}
