"use client";

import React, { Fragment } from "react";
import { Users, Download } from "lucide-react";
import type { StudentTimeData } from "../../../types";
import type { ChangeGradeKey, TimetableData, GradeStringArrays } from "../types";

type AdjustmentLog = Record<string, { beforeStr: string; afterStr: string; status: 'success' | 'failed'; reason?: string; source?: 'applicant' | 'arbitrary' }[]>;

interface RosterAfterStepProps {
  changeActiveGrade: ChangeGradeKey;
  setChangeActiveGrade: (grade: ChangeGradeKey) => void;
  handleExportAttendanceRoster: () => void;
  handleExportRoster: (isAfter: boolean) => void;
  timeSlots: GradeStringArrays;
  classCols: GradeStringArrays;
  timetableData: TimetableData;
  rosterAfterSubjectFilter: string;
  setRosterAfterSubjectFilter: (v: string) => void;
  changeRosterTimeSlot: string;
  setChangeRosterTimeSlot: (v: string) => void;
  parsedSampleData: { grade2: StudentTimeData[]; grade3: StudentTimeData[] };
  adjustmentLog: AdjustmentLog;
}

export function RosterAfterStep({
  changeActiveGrade,
  setChangeActiveGrade,
  handleExportAttendanceRoster,
  handleExportRoster,
  timeSlots,
  classCols,
  timetableData,
  rosterAfterSubjectFilter,
  setRosterAfterSubjectFilter,
  changeRosterTimeSlot,
  setChangeRosterTimeSlot,
  parsedSampleData,
  adjustmentLog,
}: RosterAfterStepProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-semibold text-stone-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-600" />
            타임별 선택과목 명단(변경 후)
          </h2>
          <div className="flex items-center gap-3 bg-stone-100 px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              <span className="text-amber-700">학생 신청 변경</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span className="text-emerald-700">인원 균등 분배(자동)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleExportAttendanceRoster}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg shadow-md transition-all"
          >
            <Download className="w-4 h-4" />
            출석부용 엑셀 다운로드
          </button>
          <button
            onClick={() => handleExportRoster(true)}
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
        if (rosterAfterSubjectFilter === "전체") {
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
              if (base === rosterAfterSubjectFilter) {
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
                    setRosterAfterSubjectFilter("전체");
                  }}
                  className={`px-5 py-2 rounded-lg font-medium transition-all ${changeRosterTimeSlot === slot && rosterAfterSubjectFilter === "전체"
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
                  onClick={() => setRosterAfterSubjectFilter("전체")}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${rosterAfterSubjectFilter === "전체"
                      ? "bg-amber-500 text-stone-900 shadow-md"
                      : "bg-stone-100 text-stone-900 hover:bg-stone-200 hover:text-stone-900"
                    }`}
                >
                  전체 과목 (타임별)
                </button>
                {currentSubjects.map(sub => (
                  <button
                    key={sub}
                    onClick={() => setRosterAfterSubjectFilter(sub)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${rosterAfterSubjectFilter === sub
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
                          {rosterAfterSubjectFilter === "전체" ? c.original : `${c.slot}타임 ${c.original}`}
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
                          let isModified = false;
                          let modifiedSource = null;
                          const studentLogs = adjustmentLog[student.id];
                          if (studentLogs) {
                            let movedInto = null;
                            let movedOut = false;
                            for (const entry of studentLogs) {
                              if (entry.status !== 'success') continue;
                              let logBeforeSubject = entry.beforeStr;
                              let logBeforeSlot = '';
                              let logAfterSubject = entry.afterStr;
                              let logAfterSlot = '';

                              for (const s of (timeSlots[changeActiveGrade] || [])) {
                                if (entry.beforeStr.endsWith(`(${s})`)) {
                                  logBeforeSubject = entry.beforeStr.slice(0, -(s.length + 2));
                                  logBeforeSlot = s;
                                  break;
                                }
                              }
                              if (!logBeforeSlot) {
                                const bMatch = entry.beforeStr.match(/^(.+)\(([^)]+)\)$/);
                                if (bMatch) { logBeforeSubject = bMatch[1]; logBeforeSlot = bMatch[2]; }
                              }

                              for (const s of (timeSlots[changeActiveGrade] || [])) {
                                if (entry.afterStr.endsWith(`(${s})`)) {
                                  logAfterSubject = entry.afterStr.slice(0, -(s.length + 2));
                                  logAfterSlot = s;
                                  break;
                                }
                              }
                              if (!logAfterSlot) {
                                const aMatch = entry.afterStr.match(/^(.+)\(([^)]+)\)$/);
                                if (aMatch) { logAfterSubject = aMatch[1]; logAfterSlot = aMatch[2]; }
                              }

                              if (logBeforeSlot && logAfterSlot) {
                                const norm = (s: string) => s.replace(/\s+/g, '').replace(/Ⅰ/g, 'I').replace(/Ⅱ/g, 'II').replace(/Ⅲ/g, 'III');
                                if (logBeforeSlot === slot && norm(logBeforeSubject) === norm(chosenSubject as string)) {
                                  movedOut = true;
                                }
                                if (logAfterSlot === slot) {
                                  movedInto = logAfterSubject;
                                  isModified = true;
                                  modifiedSource = entry.source;
                                }
                              }
                            }
                            if (movedOut && !movedInto) effectiveSubject = '__REMOVED__';
                            else if (movedInto) effectiveSubject = movedInto;
                          }

                          if (effectiveSubject === '__REMOVED__') return;

                          let matchedBase = Object.keys(bases).find(base => {
                            const cleanChosen = effectiveSubject.replace(/\s+/g, '');
                            const cleanBase = base.replace(/\s+/g, '');
                            if (!cleanBase) return false;
                            return cleanChosen === cleanBase || cleanChosen.includes(cleanBase) || cleanBase.includes(cleanChosen);
                          });

                          if (matchedBase) {
                            if (!studentsByBase[matchedBase]) studentsByBase[matchedBase] = [];
                            studentsByBase[matchedBase].push({ ...student, isModified, modifiedSource });
                          }
                        });

                        Object.keys(studentsByBase).forEach(base => {
                          const students = studentsByBase[base].sort((a, b) => {
                            return a.id.localeCompare(b.id, undefined, { numeric: true });
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
                        if (colStudents[`${c.slot}-${c.col}`].length > maxStudents) maxStudents = colStudents[`${c.slot}-${c.col}`].length;
                      });

                      const rows = [];
                      for (let r = 0; r < maxStudents; r++) {
                        rows.push(
                          <tr key={`row-${r}`} className={`${r % 2 === 0 ? "bg-stone-50" : "bg-stone-50"} hover:bg-amber-50 transition-colors`}>
                            <td className="px-3 py-1.5 border-r border-stone-300 text-center text-stone-600 bg-stone-100">
                              {r + 1}
                            </td>
                            {displayCols.map(c => {
                              const student = colStudents[`${c.slot}-${c.col}`][r];
                              const isModified = student?.isModified;
                              const studentChangeLogs = student ? (adjustmentLog[student.id] || []) : [];
                              const tooltipText = studentChangeLogs.map(l => `${l.beforeStr} → ${l.afterStr}`).join('\n');
                              return (
                                <Fragment key={`${c.slot}-${c.col}-${r}`}>
                                  <td className={`px-2 py-1.5 border-r border-stone-300 text-center border-r-slate-800/30 text-xs ${isModified ? (student.modifiedSource === 'applicant' ? 'bg-amber-500/10 text-amber-700 font-bold' : 'bg-emerald-500/10 text-emerald-700 font-bold') : 'text-stone-900'}`}>
                                    {student ? student.id : ""}
                                  </td>
                                  <td
                                    className={`px-2 py-1.5 border-r border-stone-300 text-center text-xs ${isModified ? (student.modifiedSource === 'applicant' ? 'bg-amber-500/10 text-amber-700 font-bold cursor-help' : 'bg-emerald-500/10 text-emerald-700 font-bold cursor-help') : 'text-stone-900 font-medium'}`}
                                    title={isModified && tooltipText ? tooltipText : undefined}
                                  >
                                    {student ? student.name : ""}
                                  </td>
                                </Fragment>
                              );
                            })}
                            {emptyColCount > 0 && <td></td>}
                          </tr>
                        );
                      }

                      return (
                        <>
                          {rows}
                          <tr className="bg-amber-50 border-t-2 border-amber-300">
                            <td className="px-3 py-3 border-r border-stone-300 text-center font-bold text-amber-700">총 인원</td>
                            {displayCols.map(c => (
                              <td key={`total-${c.slot}-${c.col}`} colSpan={2} className="px-3 py-3 border-r border-stone-300 text-center font-bold text-amber-700">
                                {colStudents[`${c.slot}-${c.col}`].length}명
                              </td>
                            ))}
                            {emptyColCount > 0 && <td></td>}
                          </tr>
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
