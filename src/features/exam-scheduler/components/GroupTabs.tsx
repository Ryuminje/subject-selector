'use client';

import type { GradeGroup } from '@/features/exam-scheduler/lib/domain/types';

interface GroupTabsProps {
  groups: GradeGroup[];
  activeId: string;
  onChange: (groupId: string) => void;
}

/** 학년이 둘 이상일 때만 보이는 탭. 하나뿐이면 고를 게 없으므로 숨깁니다. */
export function GroupTabs({ groups, activeId, onChange }: GroupTabsProps) {
  if (groups.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-1 border-b border-line" role="tablist">
      {groups.map((group) => {
        const isActive = group.id === activeId;
        return (
          <button
            key={group.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(group.id)}
            className={[
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'border-brand text-brand'
                : 'border-transparent text-ink-muted hover:text-ink',
            ].join(' ')}
          >
            {group.name}
          </button>
        );
      })}
    </div>
  );
}
