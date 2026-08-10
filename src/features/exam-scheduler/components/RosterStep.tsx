'use client';

import { useRef, useState } from 'react';
import { CircleAlert, FileSpreadsheet, Trash2, Upload } from 'lucide-react';
import { parseRosterFiles } from '@/features/exam-scheduler/lib/excel/parseRoster';
import { createGradeGroup, useSchedulerStore } from '@/features/exam-scheduler/lib/store/schedulerStore';
import { ExcludedStudentsPanel } from './ExcludedStudentsPanel';

/**
 * 1단계: 나이스에서 내려받은 학년별 수강 명단 엑셀을 읽어 들입니다.
 *
 * 구 버전은 tkinter 파일 대화상자를 파이썬 쪽에서 띄웠지만,
 * 여기서는 브라우저의 파일 선택을 씁니다. 파일 내용은 브라우저 밖으로 나가지 않습니다.
 */
export function RosterStep() {
  const groups = useSchedulerStore((s) => s.groups);
  const appendGroups = useSchedulerStore((s) => s.appendGroups);
  const replaceGroups = useSchedulerStore((s) => s.replaceGroups);
  const deleteGroup = useSchedulerStore((s) => s.deleteGroup);

  const inputRef = useRef<HTMLInputElement>(null);
  const [appendMode, setAppendMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  /**
   * 표본 명단 두 학년을 불러옵니다. 실제 학생 정보 없이 앱을 둘러보기 위한 것으로,
   * `tools/make-sample.mjs`가 회귀 테스트 fixture에서 생성합니다.
   * 1학년은 분반·합반이, 2학년은 자습 배정이 드러나도록 짜여 있습니다.
   */
  async function handleSample() {
    const names = ['sample-roster-1.xlsx', 'sample-roster-2.xlsx'];
    const files = await Promise.all(
      names.map(async (name) => {
        const response = await fetch(`/${name}`);
        return new File([await response.blob()], name);
      }),
    );
    await loadFiles(files);
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    await loadFiles(Array.from(fileList));
  }

  async function loadFiles(files: File[]) {
    setBusy(true);
    setErrors([]);
    try {
      const { rosters, errors: parseErrors } = await parseRosterFiles(files);
      const newGroups = rosters.map((r) => createGradeGroup(r.groupName, r.records));

      if (appendMode) appendGroups(newGroups);
      else replaceGroups(newGroups);

      setErrors(parseErrors);
    } catch (e) {
      setErrors([e instanceof Error ? e.message : String(e)]);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold">명단 불러오기</h2>
        <p className="mt-1 text-sm text-ink-muted">
          학년별 수강 명단 엑셀(.xlsx)을 선택하세요. 헤더는 2행에 있어야 하며,{' '}
          <code className="rounded bg-surface-muted px-1 py-0.5 text-xs">
            반 · 번호 · 성명 · 개설과목(학점) · 개설강의실
          </code>{' '}
          열이 필요합니다.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand/90 disabled:opacity-50"
        >
          <Upload className="size-4" aria-hidden />
          {busy ? '읽는 중…' : '엑셀 파일 선택'}
        </button>

        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={appendMode}
            onChange={(e) => setAppendMode(e.target.checked)}
            className="size-4 accent-[var(--color-brand)]"
          />
          기존 명단에 추가 (체크 해제 시 전체 교체)
        </label>

        <button
          type="button"
          onClick={handleSample}
          disabled={busy}
          className="ml-auto text-sm text-ink-muted underline-offset-2 transition-colors hover:text-brand hover:underline disabled:opacity-50"
        >
          표본 명단으로 둘러보기
        </button>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {errors.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
            <CircleAlert className="size-4" aria-hidden />
            일부 파일을 읽지 못했습니다
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-800">
            {errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface p-10 text-center">
          <FileSpreadsheet className="mx-auto size-8 text-ink-muted/50" aria-hidden />
          <p className="mt-3 text-sm text-ink-muted">아직 불러온 명단이 없습니다.</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="불러온 학년">
          {groups.map((group) => {
            const studentCount = new Set(
              group.records.map((r) => `${r.className}|${r.number}|${r.name}`),
            ).size;

            return (
              <li
                key={group.id}
                className="flex items-start justify-between rounded-xl border border-line bg-surface p-4"
              >
                <div>
                  <p className="font-semibold">{group.name}</p>
                  <p className="mt-1 text-sm text-ink-muted">
                    학생 {studentCount.toLocaleString('ko-KR')}명 · 수강 기록{' '}
                    {group.records.length.toLocaleString('ko-KR')}건
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteGroup(group.id)}
                  aria-label={`${group.name} 삭제`}
                  className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {groups.length > 0 && <ExcludedStudentsPanel />}
    </section>
  );
}
