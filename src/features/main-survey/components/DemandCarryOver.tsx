"use client";

// 본조사 탭 맨 위 — 수요조사에서 정한 과목 개설 여부(폐강·반 수)를 본조사로 가져와 보여 줍니다.
//  · 폐강된 과목에 본조사 신청이 있으면 경고
//  · 본조사 3단계(과목 개설 여부) 표에 "수요조사 결과" 비교 열(가져온 값은 입학년도별로 저장·불러오기 됨)
// 가져오기는 누른 순간의 수요조사 결과를 복사합니다(수요조사를 고치면 "바뀌었습니다" 안내가 뜨고 다시 가져오면 됩니다).

import { useState } from "react";
import { AlertTriangle, ClipboardList, RefreshCw } from "lucide-react";
import type { GradeKey, SubjectStat } from "../../../types";
import { useYearData } from "../../year-data/YearDataContext";
import { GRADES, cohortOfGradeKey } from "../../year-data/lib/cohortCurriculum";
import {
  closedWithApplicants,
  computeDemandOutcomes,
  outcomeSignature,
  type DemandResult,
} from "../../year-data/lib/demandOutcome";

interface DemandBackupLike {
  subjectStats?: Partial<Record<GradeKey, SubjectStat[]>>;
  standardClassSize?: Partial<Record<GradeKey, number>>;
  manualStep5Classes?: Record<string, string>;
}

const readDemand = (): DemandBackupLike | null =>
  typeof window === "undefined" ? null : ((window as unknown as { getDemandBackup?: () => DemandBackupLike }).getDemandBackup?.() ?? null);

export function DemandCarryOver({ grade, mainStats }: { grade: GradeKey; mainStats: SubjectStat[] }) {
  const { demandResults, setDemandResults, workYear } = useYearData();
  const [open, setOpen] = useState(false);
  const key = String(cohortOfGradeKey(workYear, grade));
  const saved = demandResults[key];

  const d = readDemand();
  const live = d ? computeDemandOutcomes(grade, d.subjectStats?.[grade] ?? [], d.standardClassSize?.[grade] ?? 25, d.manualStep5Classes ?? {}) : [];
  const stale = !!saved && live.length > 0 && outcomeSignature(live) !== outcomeSignature(saved.outcomes);

  const importAll = () => {
    const dd = readDemand();
    const next: Record<string, DemandResult> = {};
    for (const g of GRADES) {
      const stats = dd?.subjectStats?.[g] ?? [];
      if (!stats.length) continue;
      const size = dd?.standardClassSize?.[g] ?? 25;
      next[String(cohortOfGradeKey(workYear, g))] = {
        importedAt: Date.now(),
        standardClassSize: size,
        outcomes: computeDemandOutcomes(g, stats, size, dd?.manualStep5Classes ?? {}),
      };
    }
    if (!Object.keys(next).length) {
      window.alert("수요조사 탭에 업로드한 데이터가 없습니다. 먼저 수요조사 탭에서 설문 파일을 올려 주세요.");
      return;
    }
    setDemandResults((prev) => ({ ...prev, ...next }));
  };

  const closed = saved?.outcomes.filter((o) => o.status === "폐강") ?? [];
  const confirmed = saved?.outcomes.filter((o) => o.status === "확정") ?? [];
  const undecided = saved?.outcomes.filter((o) => o.status === "미정") ?? [];
  const bad = saved ? closedWithApplicants(saved.outcomes, mainStats) : [];

  return (
    <div className={`mb-4 rounded-xl border text-sm ${saved ? "bg-white/70 border-stone-200" : "bg-stone-50 border-stone-200"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
        <ClipboardList className="w-4 h-4 shrink-0 text-emerald-700" />
        {saved ? (
          <>
            <span className="font-medium text-stone-800">수요조사 결과 반영됨</span>
            <span className="text-stone-600">
              개설 확정 {confirmed.length}개 · <span className="text-rose-700 font-semibold">폐강 {closed.length}개</span>
              {undecided.length > 0 && ` · 논의 필요 ${undecided.length}개`} (기준 인원 {saved.standardClassSize}명, {new Date(saved.importedAt).toLocaleDateString("ko-KR")} 가져옴)
            </span>
            {stale && <span className="font-semibold text-amber-700">수요조사 결과가 바뀌었습니다 — 다시 가져오세요</span>}
          </>
        ) : (
          <span className="text-stone-600">
            수요조사에서 정한 과목 개설 여부(폐강·반 수)를 가져와 본조사에서 비교합니다.
            {live.length === 0 && " (수요조사 탭에 올린 설문 파일이 아직 없습니다)"}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {saved && closed.length > 0 && (
            <button onClick={() => setOpen((v) => !v)} className="underline underline-offset-2 font-medium text-stone-700">
              {open ? "폐강 과목 접기" : "폐강 과목 보기"}
            </button>
          )}
          <button
            onClick={importAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {saved ? "다시 가져오기" : "수요조사 결과 가져오기"}
          </button>
        </div>
      </div>

      {bad.length > 0 && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          <div className="font-semibold flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-4 h-4" /> 수요조사에서 폐강된 과목에 본조사 신청이 있습니다 — 학생에게 다시 안내가 필요합니다
          </div>
          <ul className="list-disc pl-5 space-y-0.5">
            {bad.map((b) => (
              <li key={`${b.outcome.semester}|${b.outcome.subject}`}>
                {b.outcome.semester} {b.outcome.subject} — 본조사 신청 {b.applicants}명
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && closed.length > 0 && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 text-xs text-stone-700">
          <div className="font-semibold mb-1">수요조사에서 폐강된 과목 ({closed.length}개) — 본조사 신청에서 제외해야 합니다</div>
          <div className="flex flex-wrap gap-1.5">
            {closed.map((o) => (
              <span key={`${o.semester}|${o.subject}`} className="px-2 py-0.5 rounded-md bg-white border border-stone-300">
                {o.semester} {o.subject} ({o.applicants}명)
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
