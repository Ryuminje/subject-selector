'use client';

import { useEffect, useState } from 'react';
import { Plus, RotateCcw, X } from 'lucide-react';
import { MAX_PER_ROOM } from '@/features/exam-scheduler/lib/domain/constants';
import {
  getSplitDraft,
  sortSplitStudents,
  toSplitRooms,
  type SplitDraftRoom,
} from '@/features/exam-scheduler/lib/scheduling/split';
import { useSchedulerStore } from '@/features/exam-scheduler/lib/store/schedulerStore';
import type { GradeGroup, StudentKey } from '@/features/exam-scheduler/lib/domain/types';

interface SplitDialogProps {
  group: GradeGroup;
  subject: string;
  onClose: () => void;
}

/**
 * 분반 편집 창.
 *
 * 학생을 체크해서 다른 분반으로 옮기는 방식입니다. 끌어다 놓기 대신 선택-이동으로
 * 만든 것은, 한 번에 수십 명을 옮기는 일이 잦고 그 편이 훨씬 빠르기 때문입니다.
 */
export function SplitDialog({ group, subject, onClose }: SplitDialogProps) {
  const setSplitMapping = useSchedulerStore((s) => s.setSplitMapping);

  const [rooms, setRooms] = useState<SplitDraftRoom[]>(() =>
    getSplitDraft(group, subject),
  );
  const [selected, setSelected] = useState<Set<StudentKey>>(new Set());

  // 창이 떠 있는 동안 Esc로 닫습니다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function toggle(key: StudentKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleRoom(roomIndex: number) {
    const keys = rooms[roomIndex].students.map((s) => s.key);
    const allSelected = keys.length > 0 && keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const key of keys) {
        if (allSelected) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  }

  /** 선택된 학생을 대상 분반으로 옮깁니다. 원래 있던 분반에서는 빠집니다. */
  function moveSelectedTo(targetIndex: number) {
    if (selected.size === 0) return;

    const moving = rooms
      .flatMap((room) => room.students)
      .filter((student) => selected.has(student.key));

    setRooms((prev) =>
      prev.map((room, i) => {
        const kept = room.students.filter((s) => !selected.has(s.key));
        return i === targetIndex
          ? { ...room, students: sortSplitStudents([...kept, ...moving]) }
          : { ...room, students: kept };
      }),
    );
    setSelected(new Set());
  }

  /** 지금까지 옮긴 것을 모두 버리고 개설강의실 그대로의 초안으로 되돌립니다. */
  function resetToOriginal() {
    if (!window.confirm('분반 편집 내용을 모두 지우고 개설강의실 그대로로 되돌릴까요?')) return;
    setRooms(getSplitDraft(group, subject, { ignoreSaved: true }));
    setSelected(new Set());
  }

  function renameRoom(index: number, name: string) {
    setRooms((prev) => prev.map((room, i) => (i === index ? { ...room, name } : room)));
  }

  function addRoom() {
    setRooms((prev) => [
      ...prev,
      { name: `${subject} 분반 ${prev.length + 1}`, students: [] },
    ]);
  }

  function save() {
    setSplitMapping(group.id, subject, toSplitRooms(rooms));
    onClose();
  }

  const total = rooms.reduce((sum, room) => sum + room.students.length, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${subject} 분반 나누기`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-full w-[95vw] max-w-[1800px] flex-col rounded-xl bg-surface shadow-xl">
        <header className="flex items-start justify-between border-b border-line p-5">
          <div>
            <h3 className="text-base font-semibold">{subject} 분반 나누기</h3>
            <p className="mt-1 text-sm text-ink-muted">
              학생을 체크한 뒤 옮길 분반의 <strong>여기로 옮기기</strong>를 누르세요.
              한 분반이 {MAX_PER_ROOM}명을 넘지 않도록 나눕니다. (전체 {total}명)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-muted"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="flex-1 overflow-auto p-5">
          <div className="flex gap-4 overflow-x-auto pb-2">
            {rooms.map((room, index) => {
              const over = room.students.length > MAX_PER_ROOM;
              return (
                <div
                  key={index}
                  className={[
                    'flex min-w-52 flex-1 flex-col rounded-lg border',
                    over ? 'border-amber-400 bg-amber-50' : 'border-line bg-surface-muted',
                  ].join(' ')}
                >
                  <div className="space-y-2 border-b border-line p-3">
                    <input
                      type="text"
                      value={room.name}
                      onChange={(e) => renameRoom(index, e.target.value)}
                      aria-label={`${index + 1}번째 분반 이름`}
                      className="w-full rounded border border-line bg-surface px-2 py-1 text-sm font-medium outline-none focus:border-brand"
                    />
                    <div className="flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => toggleRoom(index)}
                        className="text-ink-muted underline-offset-2 hover:text-brand hover:underline"
                      >
                        전체 선택
                      </button>
                      <span className={over ? 'font-semibold text-amber-800' : 'text-ink-muted'}>
                        {room.students.length}명{over && ` (${MAX_PER_ROOM}명 초과)`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => moveSelectedTo(index)}
                      disabled={selected.size === 0}
                      className="w-full rounded border border-brand px-2 py-1 text-xs text-brand transition-colors hover:bg-brand-soft disabled:border-line disabled:text-ink-muted/50"
                    >
                      여기로 옮기기{selected.size > 0 && ` (${selected.size}명)`}
                    </button>
                  </div>

                  <ul className="max-h-80 overflow-y-auto p-2 text-sm">
                    {room.students.map((student) => (
                      <li key={student.key}>
                        <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-surface">
                          <input
                            type="checkbox"
                            checked={selected.has(student.key)}
                            onChange={() => toggle(student.key)}
                            className="size-3.5 accent-[var(--color-brand)]"
                          />
                          <span className="truncate">{student.label}</span>
                        </label>
                      </li>
                    ))}
                    {room.students.length === 0 && (
                      <li className="px-2 py-4 text-center text-xs text-ink-muted">
                        비어 있음
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addRoom}
              className="flex min-w-32 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line px-4 text-sm text-ink-muted transition-colors hover:border-brand hover:text-brand"
            >
              <Plus className="size-5" aria-hidden />
              분반 추가
            </button>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-line p-4">
          <button
            type="button"
            onClick={resetToOriginal}
            title="분반하기 전, 개설강의실 그대로의 명단으로 되돌립니다"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-ink-muted transition-colors hover:border-red-400 hover:text-red-600"
          >
            <RotateCcw className="size-4" aria-hidden />
            초기화
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-line px-4 py-2 text-sm transition-colors hover:bg-surface-muted"
            >
              취소
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand/90"
            >
              저장
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
