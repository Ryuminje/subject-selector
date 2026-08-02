"use client";

import React from "react";
import { FileText, Download, Lock, CheckCircle2, Undo2 } from "lucide-react";
import type { ChangeGradeKey, ElectiveChange, GradeStringArrays, TimetableData } from "../types";
import type { StudentTimeData } from "../../../types";
import { ElectiveChangeTable } from "./ElectiveChangeTable";

type AdjustmentLog = Record<string, { beforeStr: string; afterStr: string; status: 'success' | 'failed'; reason?: string; source?: 'applicant' | 'arbitrary'; pinned?: boolean }[]>;

interface ApplicationStepProps {
  changeActiveGrade: ChangeGradeKey;
  setChangeActiveGrade: (grade: ChangeGradeKey) => void;
  electiveChanges: Record<string, ElectiveChange[]>;
  setElectiveChanges: React.Dispatch<React.SetStateAction<Record<string, ElectiveChange[]>>>;
  electiveChangesArbitrary: Record<string, ElectiveChange[]>;
  setElectiveChangesArbitrary: React.Dispatch<React.SetStateAction<Record<string, ElectiveChange[]>>>;
  enableOptimization: Record<ChangeGradeKey, boolean>;
  setEnableOptimization: React.Dispatch<React.SetStateAction<Record<ChangeGradeKey, boolean>>>;
  handleExportChanges: () => void;
  adjustmentLog: AdjustmentLog;
  parsedSampleData: { grade2: StudentTimeData[]; grade3: StudentTimeData[] };
  timetableData: TimetableData;
  timeSlots: GradeStringArrays;
  classCols: GradeStringArrays;
  confirmedBaseSchedules: Record<string, Record<string, Record<string, string>>>;
  canUndoConfirm: Record<ChangeGradeKey, boolean>;
  onConfirm: (grade: ChangeGradeKey) => void;
  onUndoConfirm: (grade: ChangeGradeKey) => void;
}

export function ApplicationStep({
  changeActiveGrade,
  setChangeActiveGrade,
  electiveChanges,
  setElectiveChanges,
  electiveChangesArbitrary,
  setElectiveChangesArbitrary,
  enableOptimization,
  setEnableOptimization,
  handleExportChanges,
  adjustmentLog,
  parsedSampleData,
  timetableData,
  timeSlots,
  classCols,
  confirmedBaseSchedules,
  canUndoConfirm,
  onConfirm,
  onUndoConfirm,
}: ApplicationStepProps) {
  const confirmedCount = Object.keys(confirmedBaseSchedules[changeActiveGrade] || {}).length;
  const hasPending = (electiveChanges[changeActiveGrade] || []).length > 0 || (electiveChangesArbitrary[changeActiveGrade] || []).length > 0;

  const handleConfirmClick = () => {
    if (!window.confirm("지금까지의 변경 결과를 확정할까요?\n확정하면 이 결과는 고정되고, 신청 표는 비워집니다. 이후 새로 입력하는 신청만 계산에 반영되며 확정된 학생은 다시 건드리지 않습니다.")) return;
    onConfirm(changeActiveGrade);
  };
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl font-semibold text-stone-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-amber-600" />
          선택과목 변경 신청 내역
        </h2>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="flex flex-col gap-6 w-full min-w-0">
          <ElectiveChangeTable
            title="변경 신청 입력(신청자)"
            titleColorClass="text-stone-800"
            changeActiveGrade={changeActiveGrade}
            data={electiveChanges}
            setData={setElectiveChanges}
            timetableData={timetableData}
            timeSlots={timeSlots}
            classCols={classCols}
          />
          <ElectiveChangeTable
            title="인원 균등 분배를 위한 임의 변경"
            titleColorClass="text-emerald-700"
            changeActiveGrade={changeActiveGrade}
            data={electiveChangesArbitrary}
            setData={setElectiveChangesArbitrary}
          />
        </div>
        <div className="bg-stone-100 border border-stone-200 rounded-2xl overflow-hidden shadow-inner flex flex-col h-full">
          <div className="p-4 bg-stone-200 border-b border-stone-300 space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <h3 className="font-semibold text-emerald-700">자동 변경 결과 내역</h3>
                <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableOptimization[changeActiveGrade]}
                    onChange={(e) => setEnableOptimization(prev => ({ ...prev, [changeActiveGrade]: e.target.checked }))}
                    className="form-checkbox rounded bg-stone-100 border-stone-300 text-emerald-500 focus:ring-emerald-500"
                  />
                  인원 균등화 최적화 알고리즘 ({changeActiveGrade === "grade2" ? "2학년" : "3학년"}만 적용)
                </label>
              </div>
              <button
                onClick={handleExportChanges}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg shadow-md transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                엑셀 다운로드
              </button>
            </div>
            <div className="flex items-center gap-2">
              {confirmedCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {confirmedCount}명 확정됨
                </span>
              )}
              <button
                onClick={handleConfirmClick}
                disabled={!hasPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 disabled:bg-stone-300 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg shadow-sm transition-all"
                title="지금까지의 신청/자동배정 결과를 고정합니다. 확정 후 새로 추가하는 신청만 다시 계산되고, 확정된 학생은 건드리지 않습니다."
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                확정
              </button>
              {canUndoConfirm[changeActiveGrade] && !hasPending && (
                <button
                  onClick={() => onUndoConfirm(changeActiveGrade)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-stone-50 text-stone-600 text-xs font-medium rounded-lg border border-stone-300 shadow-sm transition-all"
                  title="가장 최근 확정을 취소하고 신청 표를 되돌립니다."
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  확정 취소
                </button>
              )}
              {canUndoConfirm[changeActiveGrade] && hasPending && (
                <span className="text-xs text-stone-500">
                  새 신청이 있어 확정 취소를 할 수 없습니다 (새 신청을 먼저 삭제하세요)
                </span>
              )}
            </div>
          </div>
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm text-left text-stone-600 border-collapse">
              <thead className="text-xs text-stone-600 bg-stone-100 border-b border-stone-300 uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold text-center w-24 border-r border-stone-300 sticky top-0 z-10 bg-stone-200 backdrop-blur shadow-sm">학번</th>
                  <th className="px-4 py-3 font-semibold text-center w-24 border-r border-stone-300 sticky top-0 z-10 bg-stone-200 backdrop-blur shadow-sm">이름</th>
                  <th className="px-4 py-3 font-semibold text-center sticky top-0 z-10 bg-stone-200 backdrop-blur shadow-sm">변경 내역</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const data = electiveChanges[changeActiveGrade] || [];
                  const dataLower = electiveChangesArbitrary[changeActiveGrade] || [];
                  const gradeRoster = parsedSampleData[changeActiveGrade] || [];

                  // 학생 목록은 (지금 입력 중인 표가 아니라) 확정분까지 합쳐진 adjustmentLog 기준으로
                  // 뽑아야, 확정 후 입력 표가 비워져도 확정된 결과가 계속 보인다.
                  // adjustmentLog는 학년 구분 없이 학번으로만 저장되므로, 현재 학년 명단에
                  // 속한 학번만 걸러내야 다른 학년 학생이 함께 뜨지 않는다.
                  const gradeStudentIds = new Set(gradeRoster.map(s => String(s.id)));

                  if (Object.keys(adjustmentLog).length === 0) {
                    return (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center text-stone-600">
                          신청 내역을 입력하면 자동 변경 결과가 이곳에 표시됩니다.
                        </td>
                      </tr>
                    );
                  }
                  const studentsUpper = Array.from(new Set(
                    Object.entries(adjustmentLog).filter(([sid, entries]) => gradeStudentIds.has(sid) && entries.some(e => e.source === 'applicant')).map(([sid]) => sid)
                  )).sort((a, b) => String(a).localeCompare(String(b)));
                  const studentsLower = Array.from(new Set(
                    Object.entries(adjustmentLog).filter(([sid, entries]) => gradeStudentIds.has(sid) && entries.some(e => e.source === 'arbitrary')).map(([sid]) => sid)
                  )).sort((a, b) => String(a).localeCompare(String(b)));

                  if (studentsUpper.length === 0 && studentsLower.length === 0) {
                    return (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center text-stone-600">
                          유효한 학번이 입력되지 않았습니다.
                        </td>
                      </tr>
                    );
                  }

                  const renderSection = (students: string[], source: 'applicant' | 'arbitrary', title: string) => {
                    if (students.length === 0) return null;

                    const rows = students.map(studentId => {
                      const logs = adjustmentLog[studentId] || [];
                      const filteredLogs = logs.filter(l => l.source === source);
                      if (filteredLogs.length === 0) return null;

                      const studentName = gradeRoster.find(s => String(s.id) === studentId)?.name
                        || data.find(d => d.studentId === studentId)?.studentName
                        || dataLower.find(d => d.studentId === studentId)?.studentName
                        || "";

                      return (
                        <tr key={studentId} className="border-b border-stone-200 hover:bg-stone-50">
                          <td className="px-4 py-3 text-center border-r border-stone-300 font-medium">{studentId}</td>
                          <td className="px-4 py-3 text-center border-r border-stone-300">{studentName}</td>
                          <td className="px-4 py-3">
                            {filteredLogs.length > 0 ? (
                              <div className="space-y-1">
                                {filteredLogs.map((log, i) => (
                                  <div
                                    key={i}
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs mr-2 mb-1 ${log.status === 'success'
                                        ? 'text-emerald-700 bg-emerald-500/10 border-emerald-500/20'
                                        : 'text-rose-700 bg-rose-600/10 border-rose-500/20 cursor-help'
                                      }`}
                                    title={log.pinned ? `고정된 타임(1순위)${log.reason ? ` — ${log.reason}` : ''}` : log.reason}
                                  >
                                    {log.pinned && <Lock className="w-3 h-3 text-amber-600 shrink-0" />}
                                    {log.beforeStr} → {log.afterStr}
                                    {log.status === 'failed' && <span className="ml-1 font-bold">(불가)</span>}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-stone-600 italic text-xs">일치하는 수강 명단 없음</span>
                            )}
                          </td>
                        </tr>
                      );
                    }).filter(Boolean);

                    if (rows.length === 0) return null;

                    return (
                      <>
                        <tr>
                          <td colSpan={3} className="px-4 py-2 bg-stone-200 border-y border-stone-300 text-emerald-700 font-semibold text-sm">
                            {title}
                          </td>
                        </tr>
                        {rows}
                      </>
                    );
                  };

                  return (
                    <>
                      {renderSection(studentsUpper, 'applicant', '■ 변경 신청 결과 (신청자)')}
                      {renderSection(studentsLower, 'arbitrary', '■ 인원 균등 분배 임의 변경 결과')}
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
