"use client";

// 수요조사·본조사·선택과목 변경 탭 맨 위의 안내 — 기초자료(편성표·위계·학생 명단)가 들어와 있는지 알려 주고,
// 이 탭이 가진 학생들을 기초자료의 학생 명단과 대조해 누락·불일치를 보여 줍니다.
// 기초자료는 사이드바의 「기초자료」 탭에서 입력합니다(여기서는 읽기만).

import { useState } from "react";
import { ChevronDown, ChevronUp, Database, UserCheck } from "lucide-react";
import type { GradeKey } from "../../../types";
import { useYearData } from "../YearDataContext";
import { cohortOfGradeKey } from "../lib/cohortCurriculum";
import { isExcluded, reconcileRoster, type FileStudent, type IdBasis, type RosterStudent } from "../lib/roster";

export const OPEN_BASE_DATA_EVENT = "open-base-data";

interface Props {
  grade: GradeKey;
  /** 이 탭이 지금 가진 학생들(학번·이름). 주면 명단과 대조한다. */
  students?: FileStudent[];
  /** 대조에 쓸 학번의 처음 선택(이전학번/진급학번) */
  defaultBasis?: IdBasis;
  /** 주면 명단의 전입생 옆에 [과목 입력] 버튼이 나온다(본조사) */
  onEnterSubjects?: (s: { id: string; name: string }) => void;
}

export function BaseDataNotice({ grade, students, defaultBasis = "old", onEnterSubjects }: Props) {
  const { isCurriculumParsed, selectedSubjectHours, hierarchyRules, roster, workYear } = useYearData();
  const [basis, setBasis] = useState<IdBasis>(defaultBasis);
  const [open, setOpen] = useState(false);
  const ready = isCurriculumParsed[grade];
  const activeCount = roster.filter((s) => !isExcluded(s)).length;
  const cohort = cohortOfGradeKey(workYear, grade);
  const rec = students ? reconcileRoster(roster, students, cohort, basis, workYear) : null;
  // 이 탭에 아직 올린 파일이 없으면(학생 0명) 모두 "없음"으로 떠서 오히려 혼란이라 대조 줄을 숨긴다
  const showRec = !!rec && rec.hasRoster && (students?.length ?? 0) > 0;

  // 전입생(명단에 있고 이 탭에 아직 없는 학생)은 따로 "신청 입력 필요"로 보여 준다
  const transferMissing = rec ? rec.missing.filter((s) => s.status === "전입") : [];
  const otherMissing = rec ? rec.missing.filter((s) => s.status !== "전입") : [];
  const idOf = (s: RosterStudent) => {
    const g = workYear - s.cohort;
    const slot = g <= 0 ? 1 : basis === "old" ? g : g + 1;
    return s.ids[Math.min(3, Math.max(1, slot)) as 1 | 2 | 3] ?? "";
  };

  const issues = rec ? rec.missing.length + rec.unknown.length + rec.nameMismatch.length + rec.excludedInFile.length : 0;

  return (
    <div className="mb-4 space-y-2">
      <div
        className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 rounded-xl border text-sm ${
          ready ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-amber-50 border-amber-300 text-amber-900"
        }`}
      >
        <Database className="w-4 h-4 shrink-0" />
        {ready ? (
          <span>
            기초자료 반영됨 — 선택과목 {selectedSubjectHours[grade].length}개 · 위계 규칙 {hierarchyRules[grade].length}개
            {roster.length > 0 && ` · 학생 명단 ${activeCount}명(제외 ${roster.length - activeCount}명)`}
          </span>
        ) : (
          <span>이 학년의 교육과정 편성표가 아직 없습니다. 먼저 「기초자료」 탭에서 입력해 주세요.</span>
        )}
        <button
          onClick={() => window.dispatchEvent(new Event(OPEN_BASE_DATA_EVENT))}
          className="ml-auto underline underline-offset-2 font-medium hover:opacity-80"
        >
          기초자료 탭 열기
        </button>
      </div>

      {showRec && rec && (
        <div className={`rounded-xl border text-sm ${issues === 0 ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-sky-50 border-sky-200 text-sky-900"}`}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
            <UserCheck className="w-4 h-4 shrink-0" />
            <span className="font-medium">학생 명단 대조</span>
            <span>일치 {rec.matched}명</span>
            {transferMissing.length > 0 && <span className="font-semibold text-sky-800">신청 입력 필요(전입) {transferMissing.length}명</span>}
            {otherMissing.length > 0 && <span className="font-semibold text-amber-800">파일에 없음 {otherMissing.length}명</span>}
            {rec.unknown.length > 0 && <span className="font-semibold text-rose-700">명단에 없음 {rec.unknown.length}명</span>}
            {rec.nameMismatch.length > 0 && <span className="font-semibold text-rose-700">이름 다름 {rec.nameMismatch.length}명</span>}
            {rec.excludedInFile.length > 0 && <span className="text-stone-600">제외 학생 {rec.excludedInFile.length}명(자동 제외)</span>}
            <label className="ml-auto flex items-center gap-1.5 text-xs">
              대조 학번
              <select
                value={basis}
                onChange={(e) => setBasis(e.target.value as IdBasis)}
                className="px-2 py-1 border border-stone-300 rounded-md bg-white text-stone-700"
              >
                <option value="old">이전학번(올해 학번)</option>
                <option value="new">진급학번</option>
              </select>
            </label>
            {issues > 0 && (
              <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 underline underline-offset-2 font-medium">
                {open ? "접기" : "자세히"} {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </div>
          {open && issues > 0 && (
            <div className="px-4 pb-3 space-y-3 max-h-80 overflow-auto text-xs text-stone-800">
              {transferMissing.length > 0 && (
                <Section title="신청 입력 필요 — 전입생(명단에는 있고 이 탭에 신청이 없음)">
                  {transferMissing.map((s) => (
                    <li key={s.key} className="flex items-center gap-2">
                      <span>{idOf(s) || "(학번 없음)"} {s.name}</span>
                      {onEnterSubjects && idOf(s) && (
                        <button
                          onClick={() => onEnterSubjects({ id: idOf(s), name: s.name })}
                          className="px-2 py-0.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white"
                        >
                          과목 입력
                        </button>
                      )}
                    </li>
                  ))}
                </Section>
              )}
              {otherMissing.length > 0 && (
                <Section title="명단에는 있는데 이 탭의 파일에 없음(미제출·누락 확인)">
                  {otherMissing.map((s) => <li key={s.key}>{idOf(s)} {s.name}</li>)}
                </Section>
              )}
              {rec.unknown.length > 0 && (
                <Section title="파일에는 있는데 명단에 없음(전출입 미반영·학번 오타 확인)">
                  {rec.unknown.map((f) => <li key={f.id}>{f.id} {f.name}</li>)}
                </Section>
              )}
              {rec.nameMismatch.length > 0 && (
                <Section title="학번은 같은데 이름이 다름">
                  {rec.nameMismatch.map((m) => <li key={m.file.id}>{m.file.id} — 파일 「{m.file.name}」 / 명단 「{m.student.name}」</li>)}
                </Section>
              )}
              {rec.excludedInFile.length > 0 && (
                <Section title="전출·퇴학으로 표시된 학생(파일에 있어도 표·통계에서 빠집니다)">
                  {rec.excludedInFile.map((m) => <li key={m.file.id}>{m.file.id} {m.file.name} ({m.student.status})</li>)}
                </Section>
              )}
            </div>
          )}
          {rec.noId.length > 0 && (
            <div className="px-4 pb-2 text-xs text-stone-500">
              명단에 이 기준 학번이 없는 학생 {rec.noId.length}명은 대조에서 빠졌습니다(대조 학번을 바꿔 보세요).
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-semibold mb-1">{title}</div>
      <ul className="space-y-0.5 list-disc pl-5">{children}</ul>
    </div>
  );
}
