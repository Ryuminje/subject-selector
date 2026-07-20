"use client";

import React, { Fragment } from "react";
import { Users, Download } from "lucide-react";
import type { StudentTimeData } from "../../../types";
import type { ChangeGradeKey, TimetableData, GradeStringArrays } from "../types";

interface RosterStepProps {
  changeActiveGrade: ChangeGradeKey;
  setChangeActiveGrade: (grade: ChangeGradeKey) => void;
  handleExportRoster: (isAfter: boolean) => void;
  timeSlots: GradeStringArrays;
  classCols: GradeStringArrays;
  timetableData: TimetableData;
  rosterSubjectFilter: string;
  setRosterSubjectFilter: (v: string) => void;
  changeRosterTimeSlot: string;
  setChangeRosterTimeSlot: (v: string) => void;
  parsedSampleData: { grade2: StudentTimeData[]; grade3: StudentTimeData[] };
}

export function RosterStep({
  changeActiveGrade,
  setChangeActiveGrade,
  handleExportRoster,
  timeSlots,
  classCols,
  timetableData,
  rosterSubjectFilter,
  setRosterSubjectFilter,
  changeRosterTimeSlot,
  setChangeRosterTimeSlot,
  parsedSampleData,
}: RosterStepProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl font-semibold text-stone-900 flex items-center gap-2">
          <Users className="w-6 h-6 text-amber-600" />
          타임별 선택과목 명단
        </h2>

        <div className="flex items-center gap-4">
          <button
            onClick={() => handleExportRoster(false)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg shadow-md transition-all"
          >
            <Download className="w-4 h-4" />
            엑셀 다운로드
          </button>
          <div className="flex bg-stone-100 p-1 rounded-xl">
            <button
              onClick={() => setChangeActiveGrade("grade2")}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${changeActiveGrade === "grade2"
                  ? "bg-amber-500 text-stone-900 shadow-md"
                  : "text-stone-900 hover:text-stone-900"
                }`}
            >
              2학년
            </button>
            <button
              onClick={() => setChangeActiveGrade("grade3")}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${changeActiveGrade === "grade3"
                  ? "bg-amber-500 text-stone-900 shadow-md"
                  : "text-stone-900 hover:text-stone-900"
                }`}
            >
              3학년
            </button>
          </div>
        </div>
      </div>

      {(() => {
        const currentSubjects = Array.from(new Set(
          timeSlots[changeActiveGrade].flatMap(slot =>
            classCols[changeActiveGrade]
              .map(col => {
                const cellSubject = timetableData[changeActiveGrade]?.[slot]?.[col]?.subject?.trim();
                if (!cellSubject) return null;
                const match = cellSubject.match(/^(.*?)([\d\s]*)$/);
                return match ? match[1].trim() : cellSubject;
              })
              .filter(Boolean)
          )
        )).sort() as string[];

        const displayCols: { slot: string, col: string, original: string }[] = [];
        if (rosterSubjectFilter === "전체") {
          classCols[changeActiveGrade].forEach(col => {
            const cellSubject = timetableData[changeActiveGrade]?.[changeRosterTimeSlot]?.[col]?.subject?.trim();
            displayCols.push({ slot: changeRosterTimeSlot, col, original: cellSubject || "" });
          });
        } else {
          timeSlots[changeActiveGrade].forEach(slot => {
            classCols[changeActiveGrade].forEach(col => {
              const cellSubject = timetableData[changeActiveGrade]?.[slot]?.[col]?.subject?.trim();
              if (!cellSubject) return;
              const match = cellSubject.match(/^(.*?)([\d\s]*)$/);
              const base = match ? match[1].trim() : cellSubject;
              if (base === rosterSubjectFilter) {
                displayCols.push({ slot, col, original: cellSubject });
              }
            });
          });
        }

        const maxCols = classCols[changeActiveGrade].length;
        const firstColWidth = 8;
        const dataColWidth = (100 - firstColWidth) / maxCols;
        const emptyColCount = maxCols - displayCols.length;

        return (
          <>
            <div className="flex gap-2 flex-wrap mb-4">
              {timeSlots[changeActiveGrade].map(slot => (
                <button
                  key={slot}
                  onClick={() => {
                    setChangeRosterTimeSlot(slot);
                    setRosterSubjectFilter("전체");
                  }}
                  className={`px-5 py-2 rounded-lg font-medium transition-all ${changeRosterTimeSlot === slot && rosterSubjectFilter === "전체"
                      ? "bg-amber-600 text-white shadow-md"
                      : "bg-stone-100 text-stone-900 hover:bg-stone-200 hover:text-stone-900"
                    }`}
                >
                  {slot}타임
                </button>
              ))}
            </div>

            {currentSubjects.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-4">
                <button
                  onClick={() => setRosterSubjectFilter("전체")}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${rosterSubjectFilter === "전체"
                      ? "bg-amber-500 text-stone-900 shadow-md"
                      : "bg-stone-100 text-stone-900 hover:bg-stone-200 hover:text-stone-900"
                    }`}
                >
                  전체 과목 (타임별)
                </button>
                {currentSubjects.map(sub => (
                  <button
                    key={sub}
                    onClick={() => setRosterSubjectFilter(sub)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${rosterSubjectFilter === sub
                        ? "bg-amber-500 text-stone-900 shadow-md"
                        : "bg-stone-100 text-stone-900 hover:bg-stone-200 hover:text-stone-900"
                      }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            )}

            <div className="bg-white rounded-2xl border border-stone-300 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse table-fixed">
                  <thead>
                    <tr className="bg-amber-400/20 text-amber-700 border-b-2 border-stone-300">
                      <th style={{ width: `${firstColWidth}%` }} className="px-3 py-2 border-r border-stone-300 text-center font-bold">과목명</th>
                      {displayCols.map(c => (
                        <th key={`${c.slot}-${c.col}`} colSpan={2} style={{ width: `${dataColWidth}%` }} className="px-3 py-2 border-r border-stone-300 text-center font-bold">
                          {rosterSubjectFilter === "전체" ? c.original : `${c.slot}타임 ${c.original}`}
                        </th>
                      ))}
                      {emptyColCount > 0 && <th style={{ width: `${emptyColCount * dataColWidth}%` }}></th>}
                    </tr>
                    <tr className="bg-stone-100 border-b border-stone-300">
                      <th className="px-3 py-2 border-r border-stone-300 text-center font-semibold text-stone-600">강의실</th>
                      {displayCols.map(c => (
                        <Fragment key={`room-${c.slot}-${c.col}`}>
                          <th colSpan={2} className="px-3 py-2 border-r border-stone-300 text-center font-semibold text-stone-600 bg-stone-200">
                            {c.col}
                          </th>
                        </Fragment>
                      ))}
                      {emptyColCount > 0 && <th></th>}
                    </tr>
                    <tr className="bg-stone-100 border-b border-stone-300">
                      <th className="px-3 py-2 border-r border-stone-300 text-center font-semibold text-stone-600">교사</th>
                      {displayCols.map(c => (
                        <Fragment key={`teacher-${c.slot}-${c.col}`}>
                          <th colSpan={2} className="px-3 py-2 border-r border-stone-300 text-center text-stone-600">
                            {timetableData[changeActiveGrade]?.[c.slot]?.[c.col]?.teacher || "-"}
                          </th>
                        </Fragment>
                      ))}
                      {emptyColCount > 0 && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const colStudents: Record<string, any[]> = {};
                      displayCols.forEach(c => {
                        colStudents[`${c.slot}-${c.col}`] = [];
                      });

                      const allStudents = parsedSampleData[changeActiveGrade] || [];

                      const slotGroups: Record<string, Record<string, { col: string, num: number, original: string }[]>> = {};
                      displayCols.forEach(c => {
                        if (!slotGroups[c.slot]) slotGroups[c.slot] = {};
                        const match = c.original.match(/^(.*?)([\d\s]*)$/);
                        const base = match ? match[1].trim() : c.original;
                        const numMatch = c.original.match(/\d+/);
                        const num = numMatch ? parseInt(numMatch[0], 10) : 1;
                        if (!slotGroups[c.slot][base]) slotGroups[c.slot][base] = [];
                        slotGroups[c.slot][base].push({ col: c.col, num, original: c.original });
                      });

                      Object.values(slotGroups).forEach(bases => {
                        Object.values(bases).forEach(group => group.sort((a, b) => a.num - b.num));
                      });

                      Object.keys(slotGroups).forEach(slot => {
                        const bases = slotGroups[slot];
                        const studentsByBase: Record<string, any[]> = {};

                        allStudents.forEach(student => {
                          const chosenSubject = student.timeSlotMap[slot];
                          if (!chosenSubject) return;

                          let effectiveSubject = chosenSubject;

                          let matchedBase = Object.keys(bases).find(base => {
                            const cleanChosen = effectiveSubject.replace(/\s+/g, '');
                            const cleanBase = base.replace(/\s+/g, '');
                            if (!cleanBase) return false;
                            return cleanChosen === cleanBase || cleanChosen.includes(cleanBase) || cleanBase.includes(cleanChosen);
                          });

                          if (matchedBase) {
                            if (!studentsByBase[matchedBase]) studentsByBase[matchedBase] = [];
                            studentsByBase[matchedBase].push(student);
                          }
                        });

                        Object.keys(studentsByBase).forEach(base => {
                          const students = studentsByBase[base].sort((a, b) => {
                            return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
                          });
                          const cols = bases[base];

                          const baseCount = Math.floor(students.length / cols.length);
                          const remainder = students.length % cols.length;

                          let sIdx = 0;
                          cols.forEach((colObj, idx) => {
                            const count = baseCount + (idx < remainder ? 1 : 0);
                            const assigned = students.slice(sIdx, sIdx + count);
                            colStudents[`${slot}-${colObj.col}`].push(...assigned);
                            sIdx += count;
                          });
                        });
                      });

                      let maxStudents = 0;
                      displayCols.forEach(c => {
                        if (colStudents[`${c.slot}-${c.col}`].length > maxStudents) {
                          maxStudents = colStudents[`${c.slot}-${c.col}`].length;
                        }
                      });

                      const rows = [];
                      for (let r = 0; r < maxStudents; r++) {
                        rows.push(
                          <tr key={r} className="border-b border-stone-200 hover:bg-stone-50">
                            <td className="px-3 py-1.5 border-r border-stone-300 text-center text-stone-600 bg-stone-100">{r + 1}</td>
                            {displayCols.map(c => {
                              const student = colStudents[`${c.slot}-${c.col}`][r];
                              return (
                                <Fragment key={`data-${c.slot}-${c.col}-${r}`}>
                                  <td className="px-2 py-1.5 border-r border-stone-300 text-center text-stone-600 border-r-slate-800/30 text-xs">
                                    {student ? student.id : ""}
                                  </td>
                                  <td className="px-2 py-1.5 border-r border-stone-300 text-center text-stone-600 font-medium text-xs">
                                    {student ? student.name : ""}
                                  </td>
                                </Fragment>
                              );
                            })}
                            {emptyColCount > 0 && <td colSpan={emptyColCount * 2}></td>}
                          </tr>
                        );
                      }

                      return (
                        <>
                          {rows.length > 0 ? rows : (
                            <tr>
                              <td colSpan={displayCols.length * 2 + 1} className="px-6 py-12 text-center text-stone-400">
                                표시할 학생 데이터가 없습니다.
                              </td>
                            </tr>
                          )}
                          {rows.length > 0 && (
                            <tr className="bg-amber-50 border-t-2 border-amber-300">
                              <td className="px-3 py-3 border-r border-stone-300 text-center font-bold text-amber-700">총 인원</td>
                              {displayCols.map(c => (
                                <td key={`total-${c.slot}-${c.col}`} colSpan={2} className="px-3 py-3 border-r border-stone-300 text-center font-bold text-amber-700">
                                  {colStudents[`${c.slot}-${c.col}`].length}명
                                </td>
                              ))}
                              {emptyColCount > 0 && <td colSpan={emptyColCount * 2}></td>}
                            </tr>
                          )}
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
