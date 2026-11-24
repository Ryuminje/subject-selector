"use client";

// 작업 학년도 설정 — 수강신청을 받는 해. 기초자료 1단계(교육과정 편성표 입력) 맨 위에 둡니다.
// 이 값으로 예비 1학년/1학년/2학년이 어느 입학년도 학생인지 정해지고, 해가 바뀌면 이 값만 올립니다.

import { useYearData } from "../YearDataContext";
import { storedCohortYears } from "../lib/cohortStore";

// 학년 탭 이름 계산은 lib/gradeLabels 한 곳에 두고, 기존 import 경로(여기서)도 그대로 쓸 수 있게 다시 내보낸다
export { cohortLabels } from "../lib/gradeLabels";

export function WorkYearSetting() {
  const { workYear, setWorkYear, cohorts, roster, demandResults, cohortStore } = useYearData();

  // 보관된 입학년도: 편성표·학생 명단·수요조사 결과·각 탭 데이터 중 하나라도 있는 입학년도(지난 입학생 포함)
  const years = new Set<number>(storedCohortYears(cohortStore));
  Object.keys(cohorts).forEach((c) => years.add(Number(c)));
  Object.keys(demandResults).forEach((c) => years.add(Number(c)));
  roster.forEach((s) => years.add(s.cohort));
  const archive = [...years].filter((y) => !Number.isNaN(y)).sort((a, b) => b - a);
  const stateOf = (y: number) => {
    const g = workYear - y;
    if (g === 0) return "예비 1학년";
    if (g >= 1 && g <= 2) return `현 ${g}학년`;
    return g < 0 ? "입학 전" : "지난 입학생";
  };

  return (
    <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
      <label className="font-semibold flex items-center gap-2">
        작업 학년도
        <input
          type="number"
          value={workYear}
          min={2000}
          max={2100}
          onChange={(e) => setWorkYear(Math.round(+e.target.value) || workYear)}
          className="w-24 px-2 py-1 border border-amber-300 rounded-lg bg-white"
        />
      </label>
      <span>
        수강신청을 받는 해입니다. {workYear}학년도 입학생 = 예비 1학년, {workYear - 1}학년도 입학생 = 현 1학년, {workYear - 2}학년도 입학생 = 현 2학년.
        해가 바뀌면 이 값만 한 해 올리면 되고, 입학년도별로 보관된 자료(편성표·학생 명단·올린 설문·배정 결과)는 그대로 이어집니다.
      </span>
    </div>
    {archive.length > 0 && (
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-white/70 border border-stone-200 rounded-xl text-sm text-stone-700">
        <span className="font-semibold">보관된 입학년도</span>
        {archive.map((y) => {
          const g = workYear - y;
          const inView = g >= 0 && g <= 2;
          return (
            <button
              key={y}
              disabled={inView}
              // 그 입학생이 현 2학년(지난 입학생은 볼 수 있는 가장 위 학년)으로 보이도록 작업 학년도를 맞춘다
              onClick={() => setWorkYear(y > workYear ? y : y + 2)}
              title={inView ? "지금 이 탭들에서 보이는 입학생입니다" : `작업 학년도를 ${y > workYear ? y : y + 2}로 바꿔 이 입학생이 보이게 합니다`}
              className={`px-3 py-1 rounded-lg border ${inView ? "bg-emerald-50 border-emerald-200 text-emerald-800 cursor-default" : "bg-white border-stone-300 hover:bg-amber-50"}`}
            >
              {y}학년도 입학생 · {stateOf(y)}
              {!inView && <span className="ml-1 text-xs text-stone-500">(보기)</span>}
            </button>
          );
        })}
        <span className="text-xs text-stone-500">보이지 않는 입학년도를 누르면 작업 학년도가 바뀌어 모든 탭에 그 입학생이 나타납니다.</span>
      </div>
    )}
    </div>
  );
}
