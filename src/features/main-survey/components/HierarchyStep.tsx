"use client";

import React from "react";
import { GitBranch, Upload, Plus, ChevronRight, Trash2 } from "lucide-react";
import { SearchableSelect } from "../../../components/ui/SearchableSelect";
import { GradeTabs } from "./GradeTabs";
import type { GradeKey, HierarchyRule, SubjectMap } from "../../../types";

interface HierarchyStepProps {
  activeGrade: GradeKey;
  setActiveGrade: (grade: GradeKey) => void;
  isCurriculumParsed: { [key in GradeKey]: boolean };
  subjectMap: { [key in GradeKey]: SubjectMap };
  hierarchyRules: { [key in GradeKey]: HierarchyRule[] };
  setHierarchyRules: React.Dispatch<React.SetStateAction<{ [key in GradeKey]: HierarchyRule[] }>>;
  setActiveTab: (tab: string) => void;
}

export function HierarchyStep({
  activeGrade,
  setActiveGrade,
  isCurriculumParsed,
  subjectMap,
  hierarchyRules,
  setHierarchyRules,
  setActiveTab,
}: HierarchyStepProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl font-semibold text-stone-900 flex items-center gap-2">
          <GitBranch className="w-6 h-6 text-amber-700" />
          2단계: 과목 위계(선수 과목) 설정
        </h2>
      </div>

      <GradeTabs activeGrade={activeGrade} setActiveGrade={setActiveGrade} />

      <p className="text-stone-600">
        특정 과목을 수강하기 위해 먼저 들어야 하는 선수 과목 규칙을 설정할 수 있습니다. 1단계에서 분석된 과목들만 선택 가능합니다.
      </p>

      {!isCurriculumParsed[activeGrade] || Object.keys(subjectMap[activeGrade]).length === 0 ? (
        <div className="p-8 bg-white/70 border border-stone-200 rounded-2xl text-center">
          <p className="text-stone-600">먼저 교육과정 설정 탭에서 과목을 분석해 주세요.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <button
            onClick={() => {
              const subjects = Object.keys(subjectMap[activeGrade]);
              if (subjects.length > 0) {
                setHierarchyRules(prev => ({
                  ...prev,
                  [activeGrade]: [...(prev[activeGrade] || []), { id: Date.now().toString(), prereq: subjects[0], advanced: subjects[0] }]
                }));
              }
            }}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-900 font-medium rounded-lg transition-colors border border-stone-300 flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            새로운 위계 규칙 추가
          </button>

          {(!hierarchyRules[activeGrade] || hierarchyRules[activeGrade].length === 0) && (
            <div className="p-6 bg-stone-100 border border-dashed border-stone-300 rounded-xl text-center text-stone-600 text-sm">
              설정된 위계 규칙이 없습니다. 필요한 경우 규칙을 추가해 주세요.
            </div>
          )}

          <div className="grid gap-3">
            {(hierarchyRules[activeGrade] || []).map((rule, idx) => (
              <div key={rule.id} className="flex items-center gap-3 p-4 bg-white border border-stone-300 rounded-xl">
                <span className="text-stone-600 font-medium">#{idx + 1}</span>
                <div className="flex-1 flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-xs text-stone-600 mb-1">선행 과목 (먼저 듣는 과목)</label>
                    <SearchableSelect
                      options={Object.keys(subjectMap[activeGrade])}
                      value={rule.prereq}
                      onChange={(val) => {
                        const newRules = [...hierarchyRules[activeGrade]];
                        newRules[idx].prereq = val;
                        setHierarchyRules(prev => ({ ...prev, [activeGrade]: newRules }));
                      }}
                      placeholder="선행 과목 검색..."
                    />
                  </div>
                  <ChevronRight className="w-5 h-5 text-stone-500 mt-5" />
                  <div className="flex-1">
                    <label className="block text-xs text-stone-600 mb-1">후행 과목 (나중에 듣는 과목)</label>
                    <SearchableSelect
                      options={Object.keys(subjectMap[activeGrade])}
                      value={rule.advanced}
                      onChange={(val) => {
                        const newRules = [...hierarchyRules[activeGrade]];
                        newRules[idx].advanced = val;
                        setHierarchyRules(prev => ({ ...prev, [activeGrade]: newRules }));
                      }}
                      placeholder="후행 과목 검색..."
                    />
                  </div>
                </div>
                <button
                  onClick={() => {
                    const newRules = hierarchyRules[activeGrade].filter(r => r.id !== rule.id);
                    setHierarchyRules(prev => ({ ...prev, [activeGrade]: newRules }));
                  }}
                  className="mt-5 p-2 text-stone-900 hover:text-rose-700 hover:bg-rose-600/10 rounded-lg transition-colors"
                  title="규칙 삭제"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={() => setActiveTab("upload")}
              className="px-6 py-3 bg-stone-100 hover:bg-stone-200 text-stone-900 font-medium rounded-xl transition-colors border border-stone-300 flex items-center gap-2"
            >
              다음 단계(파일 업로드)로 이동
              <Upload className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
