"use client";

import { FileText, Download } from "lucide-react";
import { GradeTabs } from "./GradeTabs";
import type { GradeKey, ProcessedStudent } from "../../../types";

interface PreviewStepProps {
  activeGrade: GradeKey;
  setActiveGrade: (grade: GradeKey) => void;
  handleExport: () => void;
  activeData: ProcessedStudent[];
}

const normS = (s: string) => s ? s.replace(/\s+/g, '').replace(/Ⅰ/g, 'I').replace(/Ⅱ/g, 'II').replace(/Ⅲ/g, 'III') : '';

export function PreviewStep({
  activeGrade,
  setActiveGrade,
  handleExport,
  activeData,
}: PreviewStepProps) {
  const maxSem1 = activeData.length > 0 ? Math.max(4, ...activeData.map(d => d.semester1.length)) : 4;
  const maxSem1_2 = activeData.length > 0 ? Math.max(0, ...activeData.map(d => (d.semester1_2 || []).length)) : 0;
  const maxSem2 = activeData.length > 0 ? Math.max(4, ...activeData.map(d => d.semester2.length)) : 4;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl font-semibold text-stone-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-emerald-700" />
          4단계: 수강신청(본조사) 결과 및 다운로드
        </h2>
        <button
          onClick={handleExport}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-emerald-500/25 flex items-center gap-2"
          disabled={activeData.length === 0}
        >
          <Download className="w-4 h-4" />
          {activeGrade === "pre1" ? "1학년" : activeGrade === "grade1" ? "2학년" : "3학년"} 엑셀 다운로드
        </button>
      </div>

      <GradeTabs activeGrade={activeGrade} setActiveGrade={setActiveGrade} />

      {activeData.length === 0 ? (
        <div className="bg-white/70 border border-stone-200 rounded-2xl p-8 text-center">
          <p className="text-stone-600">선택하신 학년의 데이터가 아직 없습니다. 교육과정 설정과 파일 업로드를 진행해 주세요.</p>
        </div>
      ) : (
        <div className="bg-white/70 border border-stone-200 rounded-2xl overflow-hidden">
          <div className="overflow-auto max-h-[650px] relative">
            <table className="w-full text-sm text-left text-stone-600 border-collapse">
              <thead className="text-xs text-stone-600 uppercase bg-white border-b border-stone-200">
                <tr>
                  <th className="px-2 py-2.5 whitespace-nowrap sticky top-0 left-0 z-40 bg-white min-w-[50px] max-w-[50px] border-r border-stone-200 text-center">순번</th>
                  <th className="px-2 py-2.5 whitespace-nowrap sticky top-0 left-[50px] z-40 bg-white min-w-[80px] max-w-[80px] border-r border-stone-200 text-center">학번</th>
                  <th className="px-2 py-2.5 whitespace-nowrap sticky top-0 left-[130px] z-40 bg-white min-w-[80px] max-w-[80px] border-r border-stone-200 text-center shadow-[2px_0_5px_rgba(0,0,0,0.3)]">이름</th>
                  <th className="px-2 py-2.5 text-center whitespace-nowrap sticky top-0 z-10 bg-white border-r border-stone-200" colSpan={maxSem1}>1학기</th>
                  {maxSem1_2 > 0 && <th className="px-2 py-2.5 text-center whitespace-nowrap sticky top-0 z-10 bg-white border-r border-stone-200" colSpan={maxSem1_2}>1~2학기</th>}
                  <th className="px-2 py-2.5 text-center whitespace-nowrap sticky top-0 z-10 bg-white border-r border-stone-200" colSpan={maxSem2}>2학기</th>
                  <th className="px-2 py-2.5 whitespace-nowrap sticky top-0 z-10 bg-white text-center">기초과목</th>
                  <th className="px-2 py-2.5 whitespace-nowrap sticky top-0 z-10 bg-white text-center">사회</th>
                  <th className="px-2 py-2.5 whitespace-nowrap sticky top-0 z-10 bg-white text-center">과학</th>
                  <th className="px-2 py-2.5 whitespace-nowrap sticky top-0 z-10 bg-white">비고(중복)</th>
                </tr>
              </thead>
              <tbody>
                {activeData.map((row, idx) => (
                  <tr key={idx} className="group border-b border-stone-200 hover:bg-stone-100">
                    <td className="px-2 py-2.5 whitespace-nowrap sticky left-0 z-20 bg-white group-hover:bg-white min-w-[50px] max-w-[50px] border-r border-stone-200 text-center">{idx + 1}</td>
                    <td className="px-2 py-2.5 font-medium text-stone-900 whitespace-nowrap sticky left-[50px] z-20 bg-white group-hover:bg-white min-w-[80px] max-w-[80px] border-r border-stone-200 text-center">{row.studentId}</td>
                    <td className="px-2 py-2.5 whitespace-nowrap sticky left-[130px] z-20 bg-white group-hover:bg-white min-w-[80px] max-w-[80px] border-r border-stone-200 text-center shadow-[2px_0_5px_rgba(0,0,0,0.3)]">{row.name}</td>
                    {Array.from({ length: maxSem1 }).map((_, i) => {
                      const subject = row.semester1[i] || "";
                      const isDuplicate = subject && row.duplicateSubjects?.some(d => normS(d) === normS(subject));
                      const isHierarchyViolation = subject && row.hierarchyViolations?.some(v => normS(v.subject) === normS(subject) || normS(v.prereq) === normS(subject));
                      let cellClass = "px-2 py-2.5 whitespace-nowrap ";
                      if (isHierarchyViolation) cellClass += "text-cyan-700 font-bold bg-cyan-400/10 rounded-md";
                      else if (isDuplicate) cellClass += "text-yellow-700 font-bold bg-yellow-400/10 rounded-md";

                      return (
                        <td key={`s1-${i}`} className={cellClass}>
                          {subject}
                        </td>
                      );
                    })}
                    {maxSem1_2 > 0 && Array.from({ length: maxSem1_2 }).map((_, i) => {
                      const subject = (row.semester1_2 || [])[i] || "";
                      const isDuplicate = subject && row.duplicateSubjects?.some(d => normS(d) === normS(subject));
                      const isHierarchyViolation = subject && row.hierarchyViolations?.some(v => normS(v.subject) === normS(subject) || normS(v.prereq) === normS(subject));
                      let cellClass = "px-2 py-2.5 whitespace-nowrap ";
                      if (isHierarchyViolation) cellClass += "text-cyan-700 font-bold bg-cyan-400/10 rounded-md";
                      else if (isDuplicate) cellClass += "text-yellow-700 font-bold bg-yellow-400/10 rounded-md";

                      return (
                        <td key={`s12-${i}`} className={cellClass}>
                          {subject}
                        </td>
                      );
                    })}
                    {Array.from({ length: maxSem2 }).map((_, i) => {
                      const subject = row.semester2[i] || "";
                      const isDuplicate = subject && row.duplicateSubjects?.some(d => normS(d) === normS(subject));
                      const isHierarchyViolation = subject && row.hierarchyViolations?.some(v => normS(v.subject) === normS(subject) || normS(v.prereq) === normS(subject));
                      let cellClass = "px-2 py-2.5 whitespace-nowrap ";
                      if (isHierarchyViolation) cellClass += "text-cyan-700 font-bold bg-cyan-400/10 rounded-md";
                      else if (isDuplicate) cellClass += "text-yellow-700 font-bold bg-yellow-400/10 rounded-md";

                      return (
                        <td key={`s2-${i}`} className={cellClass}>
                          {subject}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2.5 text-center text-amber-600 font-medium whitespace-nowrap">{row.basicCount}</td>
                    <td className="px-2 py-2.5 text-center text-rose-700 font-medium whitespace-nowrap">{row.socialCount}</td>
                    <td className="px-2 py-2.5 text-center text-emerald-700 font-medium whitespace-nowrap">{row.scienceCount}</td>
                    <td className="px-2 py-2.5 font-medium flex flex-col gap-1 whitespace-nowrap">
                      {row.basicCount >= 10 && <span className="text-rose-700 whitespace-nowrap">기초과목 최대학점 초과</span>}
                      {row.duplicateSubjects?.length > 0 && <span className="text-yellow-700 whitespace-nowrap">중복선택: {row.duplicateSubjects.join(", ")}</span>}
                      {row.hierarchyViolations?.map((v, i) => (
                        <span key={i} className="text-cyan-700 text-xs whitespace-nowrap">
                          {v.message}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
