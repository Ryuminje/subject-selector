"use client";

import React from "react";
import { Settings, Upload, CheckCircle2, GitBranch } from "lucide-react";
import { GradeTabs } from "./GradeTabs";
import type { GradeKey, ParsedCurriculumSubject } from "../../../types";

interface CurriculumStepProps {
  activeGrade: GradeKey;
  setActiveGrade: (grade: GradeKey) => void;
  setIsExampleModalOpen: (open: boolean) => void;
  handleCurriculumUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isCurriculumParsed: { [key in GradeKey]: boolean };
  parsedCurriculumList: { [key in GradeKey]: ParsedCurriculumSubject[] };
  editingDetailedCategory: { grade: GradeKey, index: number } | null;
  setEditingDetailedCategory: (value: { grade: GradeKey, index: number } | null) => void;
  detailedCategoryEditValue: string;
  setDetailedCategoryEditValue: (value: string) => void;
  handleDetailedCategoryUpdate: (grade: GradeKey, index: number, subjectName: string, newDetailedCategory: string) => void;
  setActiveTab: (tab: string) => void;
}

export function CurriculumStep({
  activeGrade,
  setActiveGrade,
  setIsExampleModalOpen,
  handleCurriculumUpload,
  isCurriculumParsed,
  parsedCurriculumList,
  editingDetailedCategory,
  setEditingDetailedCategory,
  detailedCategoryEditValue,
  setDetailedCategoryEditValue,
  handleDetailedCategoryUpdate,
  setActiveTab,
}: CurriculumStepProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl font-semibold text-stone-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-amber-600" />
          1단계: 교육과정 편성표 입력
        </h2>
      </div>

      <GradeTabs activeGrade={activeGrade} setActiveGrade={setActiveGrade} />

      <p className="text-stone-600">
        선택하신 학년의 교육과정 편성표 엑셀 파일을 업로드해 주세요. 3개년 데이터가 모두 포함된 원본 엑셀 파일을 그대로 올리시면 됩니다.
      </p>

      <button
        onClick={() => setIsExampleModalOpen(true)}
        className="mb-4 flex items-center gap-2 px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 text-sm font-semibold rounded-xl border border-amber-300 transition-all shadow-sm"
      >
        <span className="text-base">💡</span> 올바른 엑셀 입력 예시 보기
      </button>

      <div className="relative group">
        <input
          type="file"
          accept=".xlsx, .xls"
          onChange={handleCurriculumUpload}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div className="flex flex-col items-center justify-center w-full h-40 bg-stone-100 border-2 border-dashed border-stone-300 rounded-xl group-hover:border-amber-400/50 group-hover:bg-amber-500/5 transition-all">
          <Upload className="w-10 h-10 text-stone-600 group-hover:text-amber-600 mb-3 transition-colors" />
          <p className="text-stone-600 font-medium">클릭하거나 엑셀 파일을 드래그하여 업로드하세요</p>
          <p className="text-stone-600 text-sm mt-1">.xlsx, .xls 파일 지원</p>
        </div>
      </div>

      {isCurriculumParsed[activeGrade] && parsedCurriculumList[activeGrade]?.length > 0 && (
        <div className="mt-8 p-6 bg-white/70 border border-stone-200 rounded-2xl animate-in fade-in">
          <h3 className="text-xl font-medium text-stone-800 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-700" />
            추출된 교육과정 데이터 ({activeGrade === "pre1" ? "1학년 탭" : activeGrade === "grade1" ? "2학년 탭" : "3학년 탭"})
          </h3>
          <p className="text-sm text-stone-600 mb-6">
            업로드된 엑셀 파일에서 1~3학년 전체 교육과정을 자동으로 분석했습니다. 내부적으로 기초/사회/과학 과목 매핑도 완료되었습니다.
          </p>

          <div className="overflow-x-auto rounded-lg border border-stone-200">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-stone-600 uppercase bg-stone-100">
                <tr>
                  <th className="px-4 py-3 font-medium">구분</th>
                  <th className="px-4 py-3 font-medium">과목명</th>
                  <th className="px-4 py-3 font-medium">교과(군)</th>
                  <th className="px-4 py-3 font-medium text-center">운영학점</th>
                  <th className="px-4 py-3 font-medium">개설학기</th>
                  <th className="px-4 py-3 font-medium text-center">비고</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {parsedCurriculumList[activeGrade].map((subj, idx) => (
                  <tr key={idx} className="bg-stone-50 hover:bg-stone-100 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider ${subj.type === "지정" ? "bg-rose-600/10 text-rose-700 border border-rose-500/20" : "bg-amber-50 text-stone-900 border border-amber-200"
                        }`}>
                        {subj.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-stone-800">{subj.subject}</td>
                    <td className="px-4 py-3 text-stone-600">
                      {editingDetailedCategory?.grade === activeGrade && editingDetailedCategory?.index === idx ? (
                        <input
                          type="text"
                          autoFocus
                          className="w-full bg-stone-100 border border-stone-300 rounded px-2 py-1 text-stone-800"
                          value={detailedCategoryEditValue}
                          onChange={(e) => setDetailedCategoryEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleDetailedCategoryUpdate(activeGrade, idx, subj.subject, detailedCategoryEditValue);
                          }}
                          onBlur={() => handleDetailedCategoryUpdate(activeGrade, idx, subj.subject, detailedCategoryEditValue)}
                        />
                      ) : (
                        <span className="cursor-pointer hover:text-amber-600" onClick={() => {
                          setEditingDetailedCategory({ grade: activeGrade, index: idx });
                          setDetailedCategoryEditValue(subj.category);
                        }} title="클릭하여 수동 수정">
                          {subj.category}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-amber-700/90 font-mono">{subj.credits}</td>
                    <td className="px-4 py-3 text-stone-600 text-xs">{subj.semesters}</td>
                    <td className="px-4 py-3 text-center">
                      {["국어", "수학", "영어"].includes(subj.category) && (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 text-xs font-medium">
                          기초
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={() => setActiveTab("hierarchy")}
              className="px-6 py-3 bg-stone-100 hover:bg-stone-200 text-stone-900 font-medium rounded-xl transition-colors border border-stone-300 flex items-center gap-2"
            >
              다음 단계(위계 설정)로 이동
              <GitBranch className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
