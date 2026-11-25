"use client";

// 타임별 학생 명단(3단계·5단계) 위의 "학번 기준 / 정렬" 선택. 반 배치에는 영향이 없고 표시와 엑셀의 학번·순서만 바뀐다(lib/rosterView).

import { useYearData } from "../../year-data/YearDataContext";
import { CHANGE_OFFSETS } from "../../year-data/lib/cohortStore";
import type { ChangeGradeKey } from "../types";
import { SORT_LABEL, type IdMode, type SortMode } from "../lib/rosterView";

interface Props {
  grade: ChangeGradeKey;
  idMode: IdMode;
  setIdMode: (m: IdMode) => void;
  sortMode: SortMode;
  setSortMode: (m: SortMode) => void;
  /** 고른 학년 학번으로 못 바꾸는 학생(이유별)과 전체 학생 수 */
  missing?: { notInRoster: string[]; noGradeId: string[]; total: number };
}

const selectCls = "px-2 py-1 border border-stone-300 rounded-lg bg-white text-stone-800 text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400";

export function RosterViewControls({ grade, idMode, setIdMode, sortMode, setSortMode, missing }: Props) {
  const { workYear } = useYearData();
  const cohort = workYear - CHANGE_OFFSETS[grade]; // 이 자리 학생들의 입학년도
  return (
    <div className="flex items-center gap-3 flex-wrap text-sm text-stone-700">
      <label className="flex items-center gap-1.5" title="학생 명단에 쌓인 학년별 학번 중 어느 학번으로 볼지 고릅니다. 반 배치는 바뀌지 않습니다.">
        학번 기준
        <select value={String(idMode)} onChange={(e) => setIdMode(e.target.value === "file" ? "file" : (Number(e.target.value) as 1 | 2 | 3))} className={selectCls}>
          <option value="file">파일 그대로</option>
          {([1, 2, 3] as const).map((n) => (
            <option key={n} value={n}>
              {n}학년 때 학번({cohort + n - 1}학년도)
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5">
        정렬
        <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} className={selectCls}>
          {(Object.keys(SORT_LABEL) as SortMode[]).map((m) => (
            <option key={m} value={m}>
              {SORT_LABEL[m]}
            </option>
          ))}
        </select>
      </label>
      {missing && idMode !== "file" && missing.notInRoster.length > 0 && (
        <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
          {missing.total}명 중 {missing.notInRoster.length}명은 이 학번이 학생 명단에 없어 바꾸지 못했습니다(예: {missing.notInRoster.slice(0, 3).join(", ")}) — 이 학기 자료의 학번이 명단의 어느 학년 학번과도 같지 않습니다
        </span>
      )}
      {missing && idMode !== "file" && missing.noGradeId.length > 0 && (
        <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
          {missing.total}명 중 {missing.noGradeId.length}명은 명단에 있지만 {idMode}학년 때 학번 칸이 비어 있어 바꾸지 못했습니다(예: {missing.noGradeId.slice(0, 3).join(", ")})
        </span>
      )}
    </div>
  );
}
