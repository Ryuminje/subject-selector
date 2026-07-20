"use client";

import React from "react";
import { FileText, Download } from "lucide-react";
import type { ChangeGradeKey, ElectiveChange } from "../types";
import { ElectiveChangeTable } from "./ElectiveChangeTable";

type AdjustmentLog = Record<string, { beforeStr: string; afterStr: string; status: 'success' | 'failed'; reason?: string; source?: 'applicant' | 'arbitrary' }[]>;

interface ApplicationStepProps {
  changeActiveGrade: ChangeGradeKey;
  setChangeActiveGrade: (grade: ChangeGradeKey) => void;
  electiveChanges: Record<string, ElectiveChange[]>;
  setElectiveChanges: React.Dispatch<React.SetStateAction<Record<string, ElectiveChange[]>>>;
  electiveChangesArbitrary: Record<string, ElectiveChange[]>;
  setElectiveChangesArbitrary: React.Dispatch<React.SetStateAction<Record<string, ElectiveChange[]>>>;
  enableOptimization: boolean;
  setEnableOptimization: (v: boolean) => void;
  handleExportChanges: () => void;
  adjustmentLog: AdjustmentLog;
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
}: ApplicationStepProps) {
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
          <div className="p-4 bg-stone-200 border-b border-stone-300 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h3 className="font-semibold text-emerald-700">자동 변경 결과 내역</h3>
              <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableOptimization}
                  onChange={(e) => setEnableOptimization(e.target.checked)}
                  className="form-checkbox rounded bg-stone-100 border-stone-300 text-emerald-500 focus:ring-emerald-500"
                />
                인원 균등화 최적화 알고리즘
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

                  if (data.length === 0 && dataLower.length === 0) {
                    return (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center text-stone-600">
                          신청 내역을 입력하면 자동 변경 결과가 이곳에 표시됩니다.
                        </td>
                      </tr>
                    );
                  }

                  const studentsUpper = Array.from(new Set(data.map(d => d.studentId))).filter(id => id).sort((a, b) => String(a).localeCompare(String(b)));
                  const studentsLower = Array.from(new Set(dataLower.map(d => d.studentId))).filter(id => id).sort((a, b) => String(a).localeCompare(String(b)));

                  if (studentsUpper.length === 0 && studentsLower.length === 0) {
                    return (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center text-stone-600">
                          유효한 학번이 입력되지 않았습니다.
                        </td>
                      </tr>
                    );
                  }

                  const renderSection = (students: string[], source: 'applicant' | 'arbitrary', title: string, originalData: ElectiveChange[]) => {
                    if (students.length === 0) return null;

                    const rows = students.map(studentId => {
                      const logs = adjustmentLog[studentId] || [];
                      const filteredLogs = logs.filter(l => l.source === source);
                      if (filteredLogs.length === 0) return null;

                      const studentName = originalData.find(d => d.studentId === studentId)?.studentName || "";

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
                                    className={`inline-block px-2 py-1 rounded border text-xs mr-2 mb-1 ${log.status === 'success'
                                        ? 'text-emerald-700 bg-emerald-500/10 border-emerald-500/20'
                                        : 'text-rose-700 bg-rose-600/10 border-rose-500/20 cursor-help'
                                      }`}
                                    title={log.reason}
                                  >
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
                      {renderSection(studentsUpper, 'applicant', '■ 변경 신청 결과 (신청자)', data)}
                      {renderSection(studentsLower, 'arbitrary', '■ 인원 균등 분배 임의 변경 결과', dataLower)}
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
