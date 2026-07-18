"use client";

import React from "react";
import { Settings, Download, Plus, Trash2 } from "lucide-react";
import type { ChangeGradeKey, TimetableData, GradeStringArrays } from "../types";

interface TimetableStepProps {
  changeActiveGrade: ChangeGradeKey;
  setChangeActiveGrade: (grade: ChangeGradeKey) => void;
  handleExportTimetable: () => void;
  addTimeSlot: () => void;
  addClassCol: () => void;
  removeClassCol: (idx: number) => void;
  removeTimeSlot: (idx: number) => void;
  classCols: GradeStringArrays;
  timeSlots: GradeStringArrays;
  timetableData: TimetableData;
  updateTimetableCell: (row: string, col: string, field: "subject" | "teacher", value: string) => void;
  handleTimetablePaste: (e: React.ClipboardEvent, startRowIndex: number, startColIndex: number, field: "subject" | "teacher") => void;
}

export function TimetableStep({
  changeActiveGrade,
  setChangeActiveGrade,
  handleExportTimetable,
  addTimeSlot,
  addClassCol,
  removeClassCol,
  removeTimeSlot,
  classCols,
  timeSlots,
  timetableData,
  updateTimetableCell,
  handleTimetablePaste,
}: TimetableStepProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-400" />
          타임별 시간표 입력
        </h2>

        <div className="flex bg-slate-800/50 p-1 rounded-xl">
          <button
            onClick={() => setChangeActiveGrade("grade2")}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${changeActiveGrade === "grade2"
                ? "bg-indigo-500 text-white shadow-md"
                : "text-white hover:text-white"
              }`}
          >
            2학년
          </button>
          <button
            onClick={() => setChangeActiveGrade("grade3")}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${changeActiveGrade === "grade3"
                ? "bg-indigo-500 text-white shadow-md"
                : "text-white hover:text-white"
              }`}
          >
            3학년
          </button>
        </div>
      </div>

      <div className="bg-slate-900 rounded-2xl border border-slate-700/50 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800/80 bg-slate-800/30 flex justify-between items-center">
          <div className="text-sm text-slate-300">
            엑셀에서 복사한 데이터를 칸에 클릭 후 붙여넣기(Ctrl+V) 하시면 한 번에 자동으로 채워집니다.
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportTimetable}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg font-medium text-sm transition-colors border border-emerald-500/30"
            >
              <Download className="w-4 h-4" /> 엑셀 다운로드
            </button>
            <button
              onClick={addTimeSlot}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500/20 text-white hover:bg-indigo-500/30 rounded-lg font-medium text-sm transition-colors border border-indigo-500/30"
            >
              <Plus className="w-4 h-4" /> 타임 추가
            </button>
            <button
              onClick={addClassCol}
              className="flex items-center gap-1 px-3 py-1.5 bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 rounded-lg font-medium text-sm transition-colors border border-rose-500/30"
            >
              <Plus className="w-4 h-4" /> 반 추가
            </button>
          </div>
        </div>

        <div className="overflow-x-auto pb-4">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-slate-300 uppercase bg-slate-800/80">
              <tr>
                <th className="px-4 py-3 border-r border-slate-700/50 w-24 text-center">타임</th>
                {classCols[changeActiveGrade].map((col, cIdx) => (
                  <th key={cIdx} className="px-4 py-3 border-r border-slate-700/50 min-w-[100px] text-center relative group">
                    {col}
                    <button
                      onClick={() => removeClassCol(cIdx)}
                      className="absolute top-1/2 -translate-y-1/2 right-2 text-rose-400 opacity-0 group-hover:opacity-100 hover:text-rose-300 transition-opacity"
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
                <tr key={rIdx} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <th className="px-4 py-3 border-r border-slate-700/50 font-medium text-slate-300 text-center bg-slate-800/20 relative group">
                    {row}타임
                    <button
                      onClick={() => removeTimeSlot(rIdx)}
                      className="absolute top-1/2 -translate-y-1/2 right-2 text-rose-400 opacity-0 group-hover:opacity-100 hover:text-rose-300 transition-opacity"
                      title="행 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </th>
                  {classCols[changeActiveGrade].map((col, cIdx) => (
                    <td key={`${rIdx}-${cIdx}`} className="p-0 border-r border-slate-800/50 relative">
                      <div className="flex flex-col h-full min-h-[64px]">
                        <input
                          type="text"
                          className="w-full flex-1 bg-transparent text-white px-2 text-center text-sm font-medium focus:outline-none focus:bg-indigo-500/10 focus:ring-1 focus:ring-indigo-500/50 border-b border-slate-800/50"
                          value={timetableData[changeActiveGrade]?.[row]?.[col]?.subject || ""}
                          onChange={(e) => updateTimetableCell(row, col, "subject", e.target.value)}
                          onPaste={(e) => handleTimetablePaste(e, rIdx, cIdx, "subject")}
                          placeholder="과목명"
                        />
                        <input
                          type="text"
                          className="w-full flex-1 bg-transparent text-white px-2 text-center text-xs focus:outline-none focus:bg-indigo-500/10 focus:ring-1 focus:ring-indigo-500/50"
                          value={timetableData[changeActiveGrade]?.[row]?.[col]?.teacher || ""}
                          onChange={(e) => updateTimetableCell(row, col, "teacher", e.target.value)}
                          onPaste={(e) => handleTimetablePaste(e, rIdx, cIdx, "teacher")}
                          placeholder="교사명"
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
