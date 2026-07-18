"use client";

import React from "react";
import { Settings, Upload, GitBranch, Plus, Trash2, ChevronRight } from "lucide-react";
import { SearchableSelect } from "../../../components/ui/SearchableSelect";
import type { ParsedCurriculumSubject, SubjectMap, HierarchyRule } from "../../../types";

type ChangeGradeKey = "grade2" | "grade3";
type ChangeActiveTab = "basic" | "upload" | "timetable" | "roster" | "application" | "roster_after" | "analysis" | "riroschool";

interface BasicStepProps {
  changeActiveGrade: ChangeGradeKey;
  setChangeActiveGrade: (grade: ChangeGradeKey) => void;
  handleChangeCurriculumUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  changeIsCurriculumParsed: Record<string, boolean>;
  changeParsedCurriculumList: Record<string, ParsedCurriculumSubject[]>;
  changeSubjectMap: Record<string, SubjectMap>;
  changeHierarchyRules: Record<string, HierarchyRule[]>;
  setChangeHierarchyRules: React.Dispatch<React.SetStateAction<Record<string, HierarchyRule[]>>>;
  setChangeActiveTab: (tab: ChangeActiveTab) => void;
}

export function BasicStep({
  changeActiveGrade,
  setChangeActiveGrade,
  handleChangeCurriculumUpload,
  changeIsCurriculumParsed,
  changeParsedCurriculumList,
  changeSubjectMap,
  changeHierarchyRules,
  setChangeHierarchyRules,
  setChangeActiveTab,
}: BasicStepProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-400" />
          선택과목 변경 기초자료 입력 (교육과정 및 위계)
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

      <div className="grid grid-cols-5 gap-8">
        {/* Left Column: Curriculum Upload */}
        <div className="col-span-3 space-y-6">
          <div className="bg-slate-950/40 border border-slate-800/50 rounded-2xl p-6 h-full flex flex-col">
            <h3 className="text-lg font-semibold text-slate-200 mb-2 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-400" />
              교육과정 엑셀 업로드
            </h3>
            <p className="text-sm text-slate-300 mb-6">
              선택하신 학년이 기준이 됩니다. 수요조사와 독립적으로 검증에 사용될 교육과정 엑셀 파일을 업로드해 주세요.
            </p>

            <div className="relative group mb-6 shrink-0">
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleChangeCurriculumUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="flex flex-col items-center justify-center w-full h-32 bg-slate-900/50 border-2 border-dashed border-slate-700 rounded-xl group-hover:border-indigo-500/50 group-hover:bg-indigo-500/5 transition-all">
                <Upload className="w-8 h-8 text-slate-300 group-hover:text-indigo-400 mb-2 transition-colors" />
                <p className="text-slate-300 font-medium text-sm">엑셀 파일 업로드</p>
              </div>
            </div>

            {changeIsCurriculumParsed[changeActiveGrade] && changeParsedCurriculumList[changeActiveGrade]?.length > 0 && (
              <div className="flex-1 overflow-auto pr-2 custom-scrollbar">
                <div className="rounded-lg border border-slate-800">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-300 uppercase bg-slate-900/80 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 font-medium">구분</th>
                        <th className="px-4 py-3 font-medium">과목명</th>
                        <th className="px-4 py-3 font-medium">교과(군)</th>
                        <th className="px-4 py-3 font-medium text-center">학점</th>
                        <th className="px-4 py-3 font-medium">학기</th>
                        <th className="px-4 py-3 font-medium text-center">비고</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {changeParsedCurriculumList[changeActiveGrade].map((subj, idx) => (
                        <tr key={idx} className="bg-slate-950/30 hover:bg-slate-900/50 transition-colors">
                          <td className="px-4 py-3">
                            <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider ${subj.type === "지정" ? "bg-rose-600/10 text-rose-400 border border-rose-500/20" : "bg-indigo-500/10 text-white border border-indigo-500/20"
                              }`}>
                              {subj.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-200">{subj.subject}</td>
                          <td className="px-4 py-3 text-slate-300 text-xs">{subj.category}</td>
                          <td className="px-4 py-3 text-center text-amber-400/90 font-mono">{subj.credits}</td>
                          <td className="px-4 py-3 text-slate-300 text-[10px]">{subj.semesters}</td>
                          <td className="px-4 py-3 text-center">
                            {["국어", "수학", "영어"].includes(subj.category) && (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium">
                                기초
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Hierarchy Setup */}
        <div className="col-span-2 space-y-6">
          <div className="bg-slate-950/40 border border-slate-800/50 rounded-2xl p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-indigo-400" />
                위계 규칙 설정
              </h3>
              <button
                onClick={() => {
                  const subjects = Object.keys(changeSubjectMap[changeActiveGrade] || {});
                  if (subjects.length > 0) {
                    setChangeHierarchyRules(prev => ({
                      ...prev,
                      [changeActiveGrade]: [...(prev[changeActiveGrade] || []), { id: Date.now().toString(), prereq: subjects[0], advanced: subjects[0] }]
                    }));
                  } else {
                    alert('먼저 교육과정 엑셀 파일을 업로드해 주세요.');
                  }
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors border border-slate-700 flex items-center gap-1.5 text-xs"
              >
                <Plus className="w-3 h-3" />
                규칙 추가
              </button>
            </div>
            <p className="text-sm text-slate-300 mb-6">
              변경 신청 시 위계 위반을 검증할 규칙을 설정합니다.
            </p>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
              {(!changeHierarchyRules[changeActiveGrade] || changeHierarchyRules[changeActiveGrade].length === 0) ? (
                <div className="p-6 border border-dashed border-slate-700/50 rounded-xl text-center text-slate-300 text-sm">
                  설정된 위계 규칙이 없습니다.
                </div>
              ) : (
                changeHierarchyRules[changeActiveGrade].map((rule, idx) => (
                  <div key={rule.id} className="flex flex-col gap-2 p-3 bg-slate-900/80 border border-slate-700/50 rounded-xl relative group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-300 font-medium text-xs">규칙 #{idx + 1}</span>
                      <button
                        onClick={() => {
                          const newRules = changeHierarchyRules[changeActiveGrade].filter(r => r.id !== rule.id);
                          setChangeHierarchyRules(prev => ({ ...prev, [changeActiveGrade]: newRules }));
                        }}
                        className="text-slate-300 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <SearchableSelect
                          options={Object.keys(changeSubjectMap[changeActiveGrade] || {})}
                          value={rule.prereq}
                          onChange={(val) => {
                            const newRules = [...changeHierarchyRules[changeActiveGrade]];
                            newRules[idx].prereq = val;
                            setChangeHierarchyRules(prev => ({ ...prev, [changeActiveGrade]: newRules }));
                          }}
                          placeholder="선행 과목 검색..."
                        />
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                      <div className="flex-1">
                        <SearchableSelect
                          options={Object.keys(changeSubjectMap[changeActiveGrade] || {})}
                          value={rule.advanced}
                          onChange={(val) => {
                            const newRules = [...changeHierarchyRules[changeActiveGrade]];
                            newRules[idx].advanced = val;
                            setChangeHierarchyRules(prev => ({ ...prev, [changeActiveGrade]: newRules }));
                          }}
                          placeholder="후행 과목 검색..."
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={() => setChangeActiveTab("upload")}
          className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-colors border border-slate-700 flex items-center gap-2"
        >
          다음 단계(데이터 업로드)로 이동
          <Upload className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
