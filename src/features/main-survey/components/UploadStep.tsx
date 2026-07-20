"use client";

import React from "react";
import { Upload, File as FileIcon, Trash2 } from "lucide-react";
import { GradeTabs } from "./GradeTabs";
import type { GradeKey } from "../../../types";

interface UploadStepProps {
  activeGrade: GradeKey;
  setActiveGrade: (grade: GradeKey) => void;
  uploadedFiles: { [key in GradeKey]: { name: string, size: number, data: string } | null };
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveFile: () => void;
  setActiveTab: (tab: string) => void;
  previousHistoryFiles: { [key in GradeKey]: { name: string, size: number, data: string } | null };
  handlePrevHistoryFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemovePrevHistoryFile: () => void;
  previousSubjectMap: { [key in GradeKey]: { [studentId: string]: { name: string, subjects: string[] } } };
}

export function UploadStep({
  activeGrade,
  setActiveGrade,
  uploadedFiles,
  handleFileUpload,
  handleRemoveFile,
  setActiveTab,
  previousHistoryFiles,
  handlePrevHistoryFileUpload,
  handleRemovePrevHistoryFile,
  previousSubjectMap,
}: UploadStepProps) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-semibold text-stone-900 flex items-center gap-2 mb-2">
          <Upload className="w-6 h-6 text-rose-700" />
          3단계: 데이터 파일 업로드
        </h2>
        <p className="text-stone-600 text-sm">
          당해년도 수강신청(본조사) 설문 파일과 이전 학년의 이수 이력 데이터(선택)를 업로드해 주세요.
        </p>
      </div>

      <GradeTabs activeGrade={activeGrade} setActiveGrade={setActiveGrade} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. 당해년도 수강신청 파일 업로드 */}
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-stone-800 flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-stone-900 text-xs font-bold">1</span>
            당해년도 수강신청(본조사) 설문 파일 (필수)
          </h3>

          {!uploadedFiles[activeGrade] ? (
            <div className="border-2 border-dashed border-stone-300 hover:border-amber-400/50 bg-stone-50 rounded-2xl p-12 text-center transition-all duration-300 group cursor-pointer relative">
              <input
                key={`curr-${activeGrade}`}
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform duration-300 border border-stone-200">
                <Upload className="w-6 h-6 text-amber-600" />
              </div>
              <h4 className="text-md font-medium text-stone-800 mb-1">
                리로스쿨 설문 제출내역 파일을 업로드하세요.
              </h4>
              <p className="text-xs text-stone-600 mb-4">또는 클릭하여 컴퓨터에서 선택 (.xlsx, .xls)</p>
              <button className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-900 text-sm font-medium rounded-lg transition-colors border border-stone-300">
                파일 선택
              </button>
            </div>
          ) : (
            <div className="border border-stone-200 bg-stone-50 rounded-2xl p-6 flex flex-col justify-between h-[196px]">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-amber-100 text-stone-900 rounded-xl flex items-center justify-center border border-amber-300 flex-shrink-0">
                  <FileIcon className="w-6 h-6" />
                </div>
                <div className="overflow-hidden">
                  <h4 className="text-md font-medium text-stone-800 truncate" title={uploadedFiles[activeGrade]?.name}>
                    {uploadedFiles[activeGrade]?.name}
                  </h4>
                  <p className="text-xs text-stone-600 mt-1">
                    {(uploadedFiles[activeGrade]!.size / 1024).toFixed(1)} KB
                  </p>
                  <span className="inline-block mt-2 px-2 py-0.5 bg-emerald-500/10 text-emerald-700 text-xs font-semibold rounded border border-emerald-500/20">
                    업로드 완료
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab("preview")}
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  결과 미리보기
                </button>
                <button
                  onClick={handleRemoveFile}
                  className="px-3 py-2 bg-stone-100 hover:bg-rose-600/20 hover:text-rose-700 text-stone-900 rounded-lg transition-colors border border-stone-200"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2. 이전 학년 이수 이력 파일 업로드 */}
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-stone-800 flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-700 text-xs font-bold">2</span>
            이전 학년 이수 이력 파일 (선택)
          </h3>

          {!previousHistoryFiles[activeGrade] ? (
            <div className="border-2 border-dashed border-stone-300 hover:border-amber-500/50 bg-stone-50 rounded-2xl p-12 text-center transition-all duration-300 group cursor-pointer relative">
              <input
                key={`prev-${activeGrade}`}
                type="file"
                accept=".xlsx, .xls"
                onChange={handlePrevHistoryFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform duration-300 border border-stone-200">
                <Upload className="w-6 h-6 text-amber-700" />
              </div>
              <h4 className="text-md font-medium text-stone-800 mb-1">
                수강신청 통계 파일 업로드
              </h4>
              <p className="text-xs text-stone-600 mb-4 px-4 leading-relaxed">
                "리로스쿨-교육과정-수강신청-통계-엑셀저장"에서 다운받은 수강신청 통계 파일을 업로드하세요.
              </p>
              <button className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-900 text-sm font-medium rounded-lg transition-colors border border-stone-300">
                파일 선택
              </button>
            </div>
          ) : (
            <div className="border border-stone-200 bg-stone-50 rounded-2xl p-6 flex flex-col justify-between h-[196px]">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-amber-500/20 text-amber-700 rounded-xl flex items-center justify-center border border-amber-500/30 flex-shrink-0">
                  <FileIcon className="w-6 h-6" />
                </div>
                <div className="overflow-hidden">
                  <h4 className="text-md font-medium text-stone-800 truncate" title={previousHistoryFiles[activeGrade]?.name}>
                    {previousHistoryFiles[activeGrade]?.name}
                  </h4>
                  <p className="text-xs text-stone-600 mt-1">
                    {(previousHistoryFiles[activeGrade]!.size / 1024).toFixed(1)} KB
                  </p>
                  <span className="inline-block mt-2 px-2 py-0.5 bg-emerald-500/10 text-emerald-700 text-xs font-semibold rounded border border-emerald-500/20">
                    총 {Object.keys(previousSubjectMap[activeGrade] || {}).length}명 연동 완료
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 py-2 text-center text-stone-600 text-xs bg-stone-100 rounded-lg flex items-center justify-center border border-stone-200">
                  다년도 위계 검사 자동 적용됨
                </div>
                <button
                  onClick={handleRemovePrevHistoryFile}
                  className="px-3 py-2 bg-stone-100 hover:bg-rose-600/20 hover:text-rose-700 text-stone-900 rounded-lg transition-colors border border-stone-200"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
