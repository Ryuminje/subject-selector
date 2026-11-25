"use client";

// 작업 학년도 선택 — 각 탭 오른쪽 위 「사용법」 옆의 목록. 작업 학년도는 모든 탭이 같이 쓰므로 어느 탭에서든 바꿀 수 있다.
// 해마다 한 해씩 올리는 값이라 목록으로 고르게 한다(2025~2035, 이 범위 밖의 값이 이미 들어 있으면 그 값도 보여 준다).

import { useYearData } from "../YearDataContext";

const FIRST_YEAR = 2025;
const LAST_YEAR = 2035;

export function WorkYearSelect() {
  const { workYear, setWorkYear } = useYearData();
  const years: number[] = [];
  for (let y = FIRST_YEAR; y <= LAST_YEAR; y++) years.push(y);
  if (!years.includes(workYear)) {
    years.push(workYear);
    years.sort((a, b) => a - b);
  }

  return (
    <label
      className="flex items-center gap-2 pl-4 pr-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 text-sm font-medium rounded-xl transition-all border border-amber-300 shadow-sm whitespace-nowrap"
      title="수강신청을 받는 해입니다. 해가 바뀌면 한 해 올리세요."
    >
      작업 학년도
      <select
        value={workYear}
        onChange={(e) => setWorkYear(Number(e.target.value))}
        className="px-2 py-1 border border-amber-300 rounded-lg bg-white text-amber-900 font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}학년도
          </option>
        ))}
      </select>
    </label>
  );
}
