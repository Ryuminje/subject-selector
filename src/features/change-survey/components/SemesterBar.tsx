"use client";

import { ArrowRightLeft } from "lucide-react";
import { SEMESTER_LABEL, type ChangeSemester } from "../lib/semester";

interface Props {
  semester: ChangeSemester;
  onChange: (s: ChangeSemester) => void;
  /** 1학기 변경 후 수강과목을 2학기 "이전 수강과목"으로 넘기기 */
  onCarryOver: () => void;
  hasStudents: boolean;
}

/** 선택과목 변경 탭 맨 위: 1학기/2학기 전환 + 1학기 결과를 2학기로 넘기는 버튼 */
export function SemesterBar({ semester, onChange, onCarryOver, hasStudents }: Props) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200 bg-white/70 px-4 py-3">
      <div className="flex gap-1 rounded-xl bg-stone-100 p-1 border border-stone-200">
        {(["s1", "s2"] as ChangeSemester[]).map((s) => (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={`px-5 py-1.5 rounded-lg text-sm font-semibold transition-all ${semester === s ? "bg-white text-rose-700 shadow border border-stone-200" : "text-stone-500 hover:text-stone-800"}`}
          >
            {SEMESTER_LABEL[s]} 변경
          </button>
        ))}
      </div>
      {semester === "s1" ? (
        <>
          <button
            onClick={onCarryOver}
            disabled={!hasStudents}
            title="1학기 변경이 끝난 뒤 누르세요. 변경 후 수강과목이 2학기 변경의 '이전 수강과목'(1학기에 이미 들은 과목 경고용)으로 들어갑니다. 진급으로 바뀐 학번도 기초자료 명단으로 함께 처리합니다."
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-stone-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl"
          >
            <ArrowRightLeft className="w-4 h-4" />
            1학기 변경 결과를 2학기로 넘기기
          </button>
          <span className="text-xs text-stone-500">1학기 변경을 끝낸 뒤 누르면, 변경 후 수강과목이 2학기 변경의 &quot;이전 수강과목&quot;이 됩니다.</span>
        </>
      ) : (
        <span className="text-xs text-stone-500">
          2학기의 &quot;이전 수강과목&quot;은 1학기 화면의 &quot;2학기로 넘기기&quot;로 채우거나, 1단계에서 파일로 올릴 수 있습니다. 2학기 학생·시간표는 타임 배정 탭에서 2학기를 골라 보내세요.
        </span>
      )}
    </div>
  );
}
