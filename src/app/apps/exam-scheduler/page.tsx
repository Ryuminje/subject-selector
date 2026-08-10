'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { ArrowLeft, GraduationCap, Save, Upload } from 'lucide-react';
import {
  ResultsStep,
  RoomsStep,
  RosterStep,
  StepNav,
  StudyStep,
  TimetableStep,
  type StepId,
} from '@/features/exam-scheduler/components';
import { saveFile } from '@/features/exam-scheduler/lib/io/saveFile';
import { useCanChooseSaveLocation } from '@/features/exam-scheduler/lib/io/useCanChooseSaveLocation';
import {
  useSchedulerStore,
  type PersistedState,
} from '@/features/exam-scheduler/lib/store/schedulerStore';

export default function ExamSchedulerPage() {
  const [step, setStep] = useState<StepId>('roster');
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const canPickLocation = useCanChooseSaveLocation();
  const groups = useSchedulerStore((s) => s.groups);
  const serialize = useSchedulerStore((s) => s.serialize);
  const hydrate = useSchedulerStore((s) => s.hydrate);
  const loadRef = useRef<HTMLInputElement>(null);

  /**
   * 작업 내역을 JSON으로 저장합니다. 구 버전의 "작업 내역 저장"과 같은 역할이며,
   * 저장 위치를 고를 수 있는 브라우저에서는 대화상자를 띄웁니다.
   */
  async function handleSave() {
    const blob = new Blob([JSON.stringify(serialize(), null, 2)], {
      type: 'application/json',
    });

    const result = await saveFile({
      blob,
      suggestedName: `시험시간표_작업내역_${new Date().toISOString().slice(0, 10)}.json`,
      description: '시험 시간표 작업 내역',
      mimeType: 'application/json',
      extensions: ['.json'],
    });

    if (result.status === 'cancelled') {
      setSaveNotice(null);
      return;
    }
    setSaveNotice(
      result.status === 'saved'
        ? `${result.fileName} 으로 저장했습니다.`
        : `${result.fileName} 을 다운로드 폴더에 받았습니다.`,
    );
    window.setTimeout(() => setSaveNotice(null), 5000);
  }

  async function handleLoad(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as PersistedState;
      if (parsed.version !== 1) throw new Error('지원하지 않는 파일 형식입니다.');
      hydrate(parsed);
      setStep('roster');
    } catch (e) {
      alert(`불러오기 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      if (loadRef.current) loadRef.current.value = '';
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-surface px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-100 bg-white/80 px-3 py-1.5 text-sm font-medium text-emerald-700 shadow-sm transition-colors hover:bg-white"
          >
            <ArrowLeft className="size-4" aria-hidden />
            허브로 돌아가기
          </Link>
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand text-white">
            <GraduationCap className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-base font-semibold">시험 시간표 관리</h1>
            <p className="text-xs text-ink-muted">
              모든 처리는 브라우저 안에서 이루어지며, 명단은 외부로 전송되지 않습니다.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {saveNotice && (
            <span className="text-xs text-ink-muted" role="status">
              {saveNotice}
            </span>
          )}
          <button
            type="button"
            onClick={() => loadRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm transition-colors hover:bg-surface-muted"
          >
            <Upload className="size-4" aria-hidden />
            작업 내역 불러오기
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={groups.length === 0}
            title={
              canPickLocation
                ? '저장할 위치를 고를 수 있습니다'
                : '이 브라우저는 저장 위치 선택을 지원하지 않아 다운로드 폴더에 저장됩니다'
            }
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm transition-colors hover:bg-surface-muted disabled:opacity-40"
          >
            <Save className="size-4" aria-hidden />
            작업 내역 저장…
          </button>
          <input
            ref={loadRef}
            type="file"
            accept=".json"
            hidden
            onChange={(e) => handleLoad(e.target.files?.[0])}
          />
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 lg:flex-row">
        <aside className="lg:w-52 lg:shrink-0">
          <StepNav
            active={step}
            onChange={setStep}
            disabledAfterRoster={groups.length === 0}
          />
        </aside>

        <main className="flex-1 rounded-xl border border-line bg-surface p-4 lg:p-6">
          {step === 'roster' && <RosterStep />}
          {step === 'timetable' && <TimetableStep />}
          {step === 'rooms' && <RoomsStep />}
          {step === 'study' && <StudyStep />}
          {step === 'export' && <ResultsStep />}
        </main>
      </div>
    </div>
  );
}
