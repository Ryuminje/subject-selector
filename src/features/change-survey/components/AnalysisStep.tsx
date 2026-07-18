"use client";

import React from "react";
import { FileText, Download } from "lucide-react";
import type { ChangeGradeKey, GradeStringArrays, Step6Row } from "../types";

type AdjustmentLog = Record<string, { beforeStr: string; afterStr: string; status: 'success' | 'failed'; reason?: string; source?: 'applicant' | 'arbitrary' }[]>;

interface AnalysisStepProps {
  changeActiveGrade: ChangeGradeKey;
  setChangeActiveGrade: (grade: ChangeGradeKey) => void;
  handleExportStep6: () => void;
  step6Data: Step6Row[];
  showOnlyApplicants: boolean;
  setShowOnlyApplicants: (v: boolean) => void;
  timeSlots: GradeStringArrays;
  adjustmentLog: AdjustmentLog;
}

export function AnalysisStep({
  changeActiveGrade,
  setChangeActiveGrade,
  handleExportStep6,
  step6Data,
  showOnlyApplicants,
  setShowOnlyApplicants,
  timeSlots,
  adjustmentLog,
}: AnalysisStepProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-2">
        <div>
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-indigo-400" />
              다년도 수강 내역 위계 및 분석
            </h2>
            <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50 text-xs font-medium mt-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/50 border border-amber-500"></span>
              <span className="text-amber-200">학생 직접 변경자 (5단계 수동 신청 반영)</span>
            </div>
          </div>
          <p className="text-slate-300 text-sm mt-1 mb-4 ml-8">
            * 위계성 검사는 '수요조사' 탭의 2단계에서 설정한 위계 규칙을 공유하여 그대로 적용합니다.
          </p>
        </div>

        <div className="flex items-center gap-4 -mt-4">
          <button
            onClick={handleExportStep6}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-emerald-500/25 flex items-center gap-2"
            disabled={step6Data.length === 0}
          >
            <Download className="w-4 h-4" />
            엑셀 다운로드
          </button>
          <button
            onClick={() => setShowOnlyApplicants(!showOnlyApplicants)}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors flex items-center gap-2 ${
              showOnlyApplicants
                ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                : "bg-slate-800/50 border-slate-700/50 text-white hover:text-white"
            }`}
          >
            직접 변경자만 보기
          </button>
          <div className="flex bg-slate-800/50 p-1 rounded-xl">
            <button
              onClick={() => setChangeActiveGrade("grade2")}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${changeActiveGrade === "grade2"
                  ? "bg-slate-700 text-white shadow"
                  : "text-slate-300 hover:text-slate-200"
                }`}
            >
              2학년
            </button>
            <button
              onClick={() => setChangeActiveGrade("grade3")}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${changeActiveGrade === "grade3"
                  ? "bg-slate-700 text-white shadow"
                  : "text-slate-300 hover:text-slate-200"
                }`}
            >
              3학년
            </button>
          </div>
        </div>
      </div>

      {step6Data.length === 0 ? (
        <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-8 text-center">
          <p className="text-slate-300">선택하신 학년의 데이터가 아직 없습니다.</p>
        </div>
      ) : (
        <div className="bg-slate-950/50 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-auto max-h-[650px] relative">
            <table className="w-full text-sm text-left text-slate-300 border-collapse">
              <thead className="text-xs text-slate-300 uppercase bg-slate-900 border-b border-slate-800">
                <tr>
                  <th rowSpan={2} className="px-2 py-2.5 whitespace-nowrap sticky top-0 left-0 z-40 bg-slate-900 min-w-[50px] max-w-[50px] border-r border-b border-slate-800 text-center align-middle">순번</th>
                  <th rowSpan={2} className="px-2 py-2.5 whitespace-nowrap sticky top-0 left-[50px] z-40 bg-slate-900 min-w-[80px] max-w-[80px] border-r border-b border-slate-800 text-center align-middle">학번</th>
                  <th rowSpan={2} className="px-2 py-2.5 whitespace-nowrap sticky top-0 left-[130px] z-40 bg-slate-900 min-w-[80px] max-w-[80px] border-r border-b border-slate-800/50 text-center shadow-[2px_0_5px_rgba(0,0,0,0.3)] align-middle">이름</th>
                  <th rowSpan={2} className="px-2 py-2.5 text-center whitespace-nowrap sticky top-0 z-10 bg-slate-900 border-r border-b border-slate-800 align-middle">과거 이수 과목</th>
                  <th colSpan={timeSlots[changeActiveGrade]?.length || 1} className="px-2 py-1 text-center whitespace-nowrap sticky top-0 z-10 bg-slate-900 border-r border-b border-slate-800 text-[11px] text-slate-400">2학기 과목</th>
                  <th rowSpan={2} className="px-2 py-2.5 whitespace-nowrap sticky top-0 z-10 bg-slate-900 border-l border-b border-slate-800 text-center align-middle">기초과목</th>
                  <th rowSpan={2} className="px-2 py-2.5 whitespace-nowrap sticky top-0 z-10 bg-slate-900 border-b border-slate-800 text-center align-middle">사회</th>
                  <th rowSpan={2} className="px-2 py-2.5 whitespace-nowrap sticky top-0 z-10 bg-slate-900 border-b border-slate-800 text-center align-middle">과학</th>
                  <th rowSpan={2} className="px-2 py-2.5 whitespace-nowrap sticky top-0 z-10 bg-slate-900 border-b border-slate-800 align-middle">비고(중복/위계)</th>
                </tr>
                <tr>
                  {timeSlots[changeActiveGrade]?.map(slot => (
                    <th key={slot} className="px-2 py-1.5 text-center whitespace-nowrap sticky top-[25px] z-10 bg-slate-900 border-r border-b border-slate-800 text-indigo-400">{slot}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(showOnlyApplicants ? step6Data.filter(row => adjustmentLog[row.id]?.some(l => l.status === 'success' && l.source === 'applicant')) : step6Data).map((row, idx) => {
                  const hasChanges = adjustmentLog[row.id] && adjustmentLog[row.id].some(l => l.status === 'success' && l.source === 'applicant');
                  const highlightClass = hasChanges ? "bg-amber-500/10 text-amber-300" : "bg-slate-950 text-white";
                  const nameHighlightClass = hasChanges ? "bg-amber-500/10 text-amber-300" : "bg-slate-950 text-white";
                  const hoverClass = hasChanges ? "group-hover:bg-amber-500/20" : "group-hover:bg-slate-900";
                  return (
                  <tr key={idx} className="group border-b border-slate-800/50 hover:bg-slate-900/50">
                    <td className="px-2 py-2.5 whitespace-nowrap sticky left-0 z-20 bg-slate-950 group-hover:bg-slate-900 min-w-[50px] max-w-[50px] border-r border-slate-800 text-center">{idx + 1}</td>
                    <td className={`px-2 py-2.5 font-medium whitespace-nowrap sticky left-[50px] z-20 min-w-[80px] max-w-[80px] border-r border-slate-800 text-center ${highlightClass} ${hoverClass}`}>{row.id}</td>
                    <td className={`px-2 py-2.5 font-medium whitespace-nowrap sticky left-[130px] z-20 min-w-[80px] max-w-[80px] border-r border-slate-800/50 text-center shadow-[2px_0_5px_rgba(0,0,0,0.3)] ${nameHighlightClass} ${hoverClass}`}>{row.name}</td>
                    <td className="px-2 py-2.5 border-r border-slate-800 max-w-[250px] text-xs leading-relaxed break-words" title={row.completedBefore.join(", ")}>
                      {row.completedBefore.length > 0 ? row.completedBefore.join(", ") : <span className="text-slate-600">-</span>}
                    </td>
                    {timeSlots[changeActiveGrade]?.map(slot => {
                      const subject = row.currentSubjectsMap?.[slot] || "";
                      const normS = (s: string) => s ? s.replace(/\s+/g, '').replace(/Ⅰ/g, 'I').replace(/Ⅱ/g, 'II').replace(/Ⅲ/g, 'III') : '';
                      const isDuplicate = subject && row.duplicateSubjects?.some((d: string) => normS(d) === normS(subject));
                      const isHierarchyViolation = subject && row.hierarchyViolations?.some((v: any) => normS(v.subject) === normS(subject) || normS(v.prereq) === normS(subject));

                      let isChangedByApplicant = false;
                      let debugInfo = "";
                      if (adjustmentLog[row.id] && subject) {
                          isChangedByApplicant = adjustmentLog[row.id].some(l => {
                              if (l.status !== 'success' || l.source !== 'applicant') return false;
                              const timeSlotsForGrade = timeSlots[changeActiveGrade] || [];
                              let afterSubj = l.afterStr;
                              let found = false;
                              for (const ts of timeSlotsForGrade) {
                                  if (l.afterStr.endsWith(`(${ts})`)) {
                                      afterSubj = l.afterStr.slice(0, -(ts.length + 2));
                                      found = true;
                                      break;
                                  }
                              }
                              if (!found) {
                                  const match = l.afterStr.match(/^(.+)\(([^)]+)\)$/);
                                  if (match) afterSubj = match[1];
                              }
                              const norm = (s: string) => s.replace(/\s+/g, '').replace(/Ⅰ/g, 'I').replace(/Ⅱ/g, 'II').replace(/Ⅲ/g, 'III');
                              return norm(afterSubj) === norm(subject);
                          });
                      }

                      let cellClass = "inline-block px-1.5 py-0.5 rounded text-xs ";
                      if (isChangedByApplicant) {
                          if (isHierarchyViolation) {
                              cellClass += "bg-amber-500/20 text-cyan-400 font-black ring-1 ring-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.5)]";
                          } else if (isDuplicate) {
                              cellClass += "bg-amber-500/20 text-rose-400 font-black ring-1 ring-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]";
                          } else {
                              cellClass += "bg-amber-500/20 text-amber-300 font-bold ring-1 ring-amber-500/50";
                          }
                      } else {
                          if (isHierarchyViolation) cellClass += "text-cyan-400 font-bold bg-cyan-400/10";
                          else if (isDuplicate) cellClass += "text-yellow-400 font-bold bg-yellow-400/10";
                          else cellClass += "bg-slate-800 text-slate-300";
                      }

                      return (
                        <td key={slot} className="px-2 py-2.5 border-r border-slate-800 text-center">
                          {subject ? (
                              <span className={cellClass} title={debugInfo}>
                                  {subject}
                              </span>
                          ) : (
                              <span className="text-slate-600">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2.5 text-center text-indigo-400 font-medium whitespace-nowrap">{row.basicCount}</td>
                    <td className="px-2 py-2.5 text-center text-rose-400 font-medium whitespace-nowrap">{row.socialCount}</td>
                    <td className="px-2 py-2.5 text-center text-emerald-400 font-medium whitespace-nowrap">{row.scienceCount}</td>
                    <td className="px-2 py-2.5 font-medium flex flex-col gap-1 whitespace-nowrap">
                      {row.basicCount >= 10 && <span className="text-rose-400 whitespace-nowrap">기초과목 최대학점 초과</span>}
                      {row.duplicateSubjects?.length > 0 && <span className="text-yellow-400 whitespace-nowrap">중복선택: {row.duplicateSubjects.join(", ")}</span>}
                      {row.hierarchyViolations?.map((v: any, i: number) => (
                        <span key={i} className="text-cyan-400 text-xs whitespace-nowrap">
                          {v.message}
                        </span>
                      ))}
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
