"use client";

// 작업 학년도 설정 — 수강신청을 받는 해. 기초자료 1단계(교육과정 편성표 입력) 맨 위에 둡니다.
// 이 값으로 예비 1학년/1학년/2학년이 어느 입학년도 학생인지 정해지고, 해가 바뀌면 이 값만 올립니다.

import { useYearData } from "../YearDataContext";
import { parseRoundKey, storedRounds } from "../lib/cohortStore";

// 학년 탭 이름 계산은 lib/gradeLabels 한 곳에 두고, 기존 import 경로(여기서)도 그대로 쓸 수 있게 다시 내보낸다
export { cohortLabels } from "../lib/gradeLabels";

export function WorkYearSetting() {
  const { workYear, setWorkYear, demandResults, cohortStore } = useYearData();

  // 보관된 수강신청 회차: 각 탭 데이터·수요조사 결과가 하나라도 있는 (입학년도, 신청 학년). 회차의 작업 학년도 = 입학년도 + 신청 학년 − 1
  const roundKeys = storedRounds(cohortStore);
  Object.keys(demandResults).forEach((k) => parseRoundKey(k) && roundKeys.add(k));
  const archive = [...roundKeys]
    .map((k) => ({ key: k, ...parseRoundKey(k)! }))
    .map((r) => ({ ...r, year: r.cohort + r.grade - 1 }))
    .sort((a, b) => b.year - a.year || b.cohort - a.cohort);

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
        해가 바뀌면 이 값만 한 해 올리면 됩니다. 편성표·학생 명단은 그대로 이어지고, 같은 입학생이 한 학년 위 과목을 신청하는 새 수강신청이 되므로
        설문·신청·타임 배정·변경 자료는 비어 있는 채로 시작합니다. 지난 자료는 보관되며, 작업 학년도를 되돌리면 다시 보입니다.
      </span>
    </div>
    {archive.length > 0 && (
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-white/70 border border-stone-200 rounded-xl text-sm text-stone-700">
        <span className="font-semibold">보관된 수강신청 자료</span>
        {archive.map((r) => {
          const inView = r.year === workYear;
          // 화면에는 1~3학년 과목 신청만 나온다(그 밖의 회차는 보관만)
          const viewable = r.grade >= 1 && r.grade <= 3;
          return (
            <button
              key={r.key}
              disabled={inView || !viewable}
              onClick={() => setWorkYear(r.year)}
              title={inView ? "지금 이 탭들에서 보이는 자료입니다" : viewable ? `작업 학년도를 ${r.year}로 바꿔 이 자료가 보이게 합니다` : "화면에서 볼 수 없는 회차입니다"}
              className={`px-3 py-1 rounded-lg border ${inView ? "bg-emerald-50 border-emerald-200 text-emerald-800 cursor-default" : "bg-white border-stone-300 hover:bg-amber-50 disabled:opacity-50 disabled:hover:bg-white"}`}
            >
              {r.cohort}학년도 입학생 · {r.grade}학년 과목 신청({r.year}학년도)
              {!inView && viewable && <span className="ml-1 text-xs text-stone-500">(보기)</span>}
            </button>
          );
        })}
        <span className="text-xs text-stone-500">다른 회차를 누르면 작업 학년도가 바뀌어 모든 탭에 그 회차의 자료가 나타납니다.</span>
      </div>
    )}
    </div>
  );
}
