"use client";

import React from "react";
import { Settings, Download, Plus, Trash2, Eraser } from "lucide-react";
import type { ChangeGradeKey, TimetableData, GradeStringArrays } from "../types";
import { isKnownSubject } from "../lib/subjectMatch";

interface TimetableStepProps {
  /** 2단계 학생 데이터에 나오는 과목명 — 자동완성 후보이자 "일치하지 않음" 판정 기준. */
  subjectOptions: string[];
  changeActiveGrade: ChangeGradeKey;
  setChangeActiveGrade: (grade: ChangeGradeKey) => void;
  handleExportTimetable: () => void;
  addTimeSlot: () => void;
  addClassCol: () => void;
  removeClassCol: (idx: number) => void;
  removeTimeSlot: (idx: number) => void;
  /** 칸 내용만 비움 — row/col 없으면 전체. */
  clearTimetable: (target?: { row?: string; col?: string }) => void;
  classCols: GradeStringArrays;
  timeSlots: GradeStringArrays;
  timetableData: TimetableData;
  updateTimetableCell: (row: string, col: string, field: "subject" | "teacher", value: string) => void;
  handleTimetablePaste: (e: React.ClipboardEvent, startRowIndex: number, startColIndex: number, field: "subject" | "teacher") => void;
}

export function TimetableStep({
  subjectOptions,
  changeActiveGrade,
  setChangeActiveGrade,
  handleExportTimetable,
  addTimeSlot,
  addClassCol,
  removeClassCol,
  removeTimeSlot,
  clearTimetable,
  classCols,
  timeSlots,
  timetableData,
  updateTimetableCell,
  handleTimetablePaste,
}: TimetableStepProps) {
  const unknownCount = timeSlots[changeActiveGrade].reduce(
    (n, row) =>
      n +
      classCols[changeActiveGrade].filter(
        (col) => !isKnownSubject(timetableData[changeActiveGrade]?.[row]?.[col]?.subject || "", subjectOptions),
      ).length,
    0,
  );

  const gradeLabel = changeActiveGrade === "grade2" ? "2학년" : "3학년";
  const confirmClear = (message: string, target?: { row?: string; col?: string }) => {
    if (window.confirm(`${message}\n과목명·교사명이 지워지며 되돌릴 수 없습니다.`)) clearTimetable(target);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* BasicStep.tsx와 같은 이유로 flex-wrap·break-keep을 둡니다 — 자세한 설명은 그쪽 주석 참고. */}
      <div className="flex justify-between items-center gap-3 flex-wrap mb-2">
        <h2 className="text-2xl font-semibold text-stone-900 flex items-center gap-2 break-keep">
          <Settings className="w-6 h-6 text-amber-600 shrink-0" />
          타임별 시간표 입력
        </h2>

        <div className="flex bg-stone-100 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setChangeActiveGrade("grade2")}
            className={`px-6 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${changeActiveGrade === "grade2"
                ? "bg-amber-500 text-stone-900 shadow-md"
                : "text-stone-900 hover:text-stone-900"
              }`}
          >
            2학년
          </button>
          <button
            onClick={() => setChangeActiveGrade("grade3")}
            className={`px-6 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${changeActiveGrade === "grade3"
                ? "bg-amber-500 text-stone-900 shadow-md"
                : "text-stone-900 hover:text-stone-900"
              }`}
          >
            3학년
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-300 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-stone-200 bg-stone-100 flex justify-between items-center">
          <div className="text-sm text-stone-600">
            엑셀에서 복사한 데이터를 칸에 클릭 후 붙여넣기(Ctrl+V) 하시면 한 번에 자동으로 채워집니다.
            {unknownCount > 0 && (
              <span className="block mt-1 font-semibold text-rose-600">
                학생 데이터에 없는 과목명 {unknownCount}칸(빨간색) — 명단·자동 변경에서 이 칸은 어떤 학생과도 연결되지 않습니다.
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportTimetable}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/20 text-emerald-700 hover:bg-emerald-500/30 rounded-lg font-medium text-sm transition-colors border border-emerald-500/30"
            >
              <Download className="w-4 h-4" /> 엑셀 다운로드
            </button>
            <button
              onClick={() => confirmClear(`${gradeLabel} 시간표 전체 내용을 지울까요?`)}
              className="flex items-center gap-1 px-3 py-1.5 bg-white text-stone-700 hover:bg-stone-200 rounded-lg font-medium text-sm transition-colors border border-stone-300"
            >
              <Eraser className="w-4 h-4" /> 전체 지우기
            </button>
            <button
              onClick={addTimeSlot}
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-stone-900 hover:bg-amber-500/30 rounded-lg font-medium text-sm transition-colors border border-amber-300"
            >
              <Plus className="w-4 h-4" /> 타임 추가
            </button>
            <button
              onClick={addClassCol}
              className="flex items-center gap-1 px-3 py-1.5 bg-rose-600/20 text-rose-700 hover:bg-rose-600/30 rounded-lg font-medium text-sm transition-colors border border-rose-500/30"
            >
              <Plus className="w-4 h-4" /> 반 추가
            </button>
          </div>
        </div>

        <div className="overflow-x-auto pb-4">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-stone-600 uppercase bg-stone-200">
              <tr>
                <th className="px-4 py-3 border-r border-stone-300 w-24 text-center">타임</th>
                {classCols[changeActiveGrade].map((col, cIdx) => (
                  <th key={cIdx} className="px-4 py-3 border-r border-stone-300 min-w-[100px] text-center relative group">
                    {col}
                    <button
                      onClick={() => confirmClear(`${col} 열 내용을 지울까요?`, { col })}
                      className="absolute top-1/2 -translate-y-1/2 left-2 text-stone-500 opacity-0 group-hover:opacity-100 hover:text-amber-700 transition-opacity"
                      title="열 내용 지우기"
                    >
                      <Eraser className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeClassCol(cIdx)}
                      className="absolute top-1/2 -translate-y-1/2 right-2 text-rose-700 opacity-0 group-hover:opacity-100 hover:text-rose-700 transition-opacity"
                      title="열 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots[changeActiveGrade].map((row, rIdx) => (
                <tr key={rIdx} className="border-b border-stone-200 hover:bg-stone-100 transition-colors">
                  <th className="px-4 py-3 border-r border-stone-300 font-medium text-stone-600 text-center bg-stone-50 relative group">
                    {row}타임
                    <button
                      onClick={() => confirmClear(`${row}타임 행 내용을 지울까요?`, { row })}
                      className="absolute top-1/2 -translate-y-1/2 left-1 text-stone-500 opacity-0 group-hover:opacity-100 hover:text-amber-700 transition-opacity"
                      title="행 내용 지우기"
                    >
                      <Eraser className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeTimeSlot(rIdx)}
                      className="absolute top-1/2 -translate-y-1/2 right-2 text-rose-700 opacity-0 group-hover:opacity-100 hover:text-rose-700 transition-opacity"
                      title="행 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </th>
                  {classCols[changeActiveGrade].map((col, cIdx) => {
                    const subject = timetableData[changeActiveGrade]?.[row]?.[col]?.subject || "";
                    const unknown = !isKnownSubject(subject, subjectOptions);
                    return (
                    <td key={`${rIdx}-${cIdx}`} className="p-0 border-r border-stone-200 relative">
                      <div className="flex flex-col h-full min-h-[64px]">
                        <input
                          type="text"
                          list="change-subject-options"
                          className={`w-full flex-1 px-2 text-center text-sm font-medium focus:outline-none focus:ring-1 border-b border-stone-200 ${unknown
                              ? "bg-rose-50 text-rose-700 focus:ring-rose-500/50"
                              : "bg-transparent text-stone-900 focus:bg-amber-50 focus:ring-amber-500/50"
                            }`}
                          value={subject}
                          onChange={(e) => updateTimetableCell(row, col, "subject", e.target.value)}
                          onPaste={(e) => handleTimetablePaste(e, rIdx, cIdx, "subject")}
                          placeholder="과목명"
                          title={unknown ? `'${subject}'은(는) 학생 데이터에 없는 과목명입니다` : undefined}
                        />
                        <input
                          type="text"
                          className="w-full flex-1 bg-transparent text-stone-900 px-2 text-center text-xs focus:outline-none focus:bg-amber-50 focus:ring-1 focus:ring-amber-500/50"
                          value={timetableData[changeActiveGrade]?.[row]?.[col]?.teacher || ""}
                          onChange={(e) => updateTimetableCell(row, col, "teacher", e.target.value)}
                          onPaste={(e) => handleTimetablePaste(e, rIdx, cIdx, "teacher")}
                          placeholder="교사명"
                        />
                      </div>
                    </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="change-subject-options">
            {subjectOptions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      </div>
    </div>
  );
}
