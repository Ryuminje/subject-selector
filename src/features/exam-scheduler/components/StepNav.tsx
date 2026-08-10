'use client';

import type { LucideIcon } from 'lucide-react';
import {
  CalendarDays,
  DoorOpen,
  FileSpreadsheet,
  TableProperties,
  Users,
} from 'lucide-react';

/** 작업 순서. 앞 단계가 끝나야 뒤 단계가 의미를 갖습니다. */
export const STEPS = [
  { id: 'roster', label: '명단 불러오기', icon: FileSpreadsheet },
  { id: 'timetable', label: '시험 시간표', icon: CalendarDays },
  { id: 'rooms', label: '시험실 배정', icon: DoorOpen },
  { id: 'study', label: '자습 배정', icon: Users },
  { id: 'export', label: '결과 · 출력', icon: TableProperties },
] as const;

export type StepId = (typeof STEPS)[number]['id'];

interface StepNavProps {
  active: StepId;
  onChange: (step: StepId) => void;
  /** 명단이 없으면 이후 단계는 눌러도 할 일이 없으므로 비활성화합니다. */
  disabledAfterRoster: boolean;
}

export function StepNav({ active, onChange, disabledAfterRoster }: StepNavProps) {
  return (
    <nav className="flex flex-col gap-1" aria-label="작업 단계">
      {STEPS.map((step, index) => {
        const Icon: LucideIcon = step.icon;
        const disabled = disabledAfterRoster && step.id !== 'roster';
        const isActive = active === step.id;

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onChange(step.id)}
            disabled={disabled}
            aria-current={isActive ? 'step' : undefined}
            className={[
              'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
              isActive
                ? 'bg-brand text-white'
                : 'text-ink-muted hover:bg-brand-soft hover:text-ink',
              disabled ? 'cursor-not-allowed opacity-40 hover:bg-transparent' : '',
            ].join(' ')}
          >
            <span
              className={[
                'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                isActive ? 'bg-white/20' : 'bg-line/70',
              ].join(' ')}
            >
              {index + 1}
            </span>
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{step.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
