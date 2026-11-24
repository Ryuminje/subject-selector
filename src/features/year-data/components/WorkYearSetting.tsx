"use client";

// 작업 학년도 설정 — 수강신청을 받는 해. 기초자료 1단계(교육과정 편성표 입력) 맨 위에 둡니다.
// 이 값으로 예비 1학년/1학년/2학년이 어느 입학년도 학생인지 정해지고, 해가 바뀌면 이 값만 올립니다.

import { useYearData } from "../YearDataContext";

// 학년 탭 이름 계산은 lib/gradeLabels 한 곳에 두고, 기존 import 경로(여기서)도 그대로 쓸 수 있게 다시 내보낸다
export { cohortLabels } from "../lib/gradeLabels";

export function WorkYearSetting() {
  const { workYear, setWorkYear } = useYearData();
  return (
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
        해가 바뀌면 이 값만 한 해 올리면 되고, 입학년도별로 보관된 편성표·학생 명단은 그대로 이어집니다.
      </span>
    </div>
  );
}
