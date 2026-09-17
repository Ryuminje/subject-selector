"use client";

import React from "react";
import { Upload, CheckCircle2, Trash2, ChevronRight, File as FileIcon } from "lucide-react";
import type { StudentTimeData } from "../../../types";
import type { ChangeGradeKey, ChangeActiveTab } from "../types";

interface UploadStepProps {
  changeActiveGrade: ChangeGradeKey;
  setChangeActiveGrade: (grade: ChangeGradeKey) => void;
  parsedSampleData: { grade2: StudentTimeData[]; grade3: StudentTimeData[] };
  changeUploadNames: Record<string, { timetable: string | null; grade2Optional: string | null; grade3Sem1: string | null }>;
  extraUploads: Record<string, { grade2Optional: boolean; grade3Sem1: boolean }>;
  handleDeleteSampleUpload: () => void;
  handleChangeSampleUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDeleteExtraUpload: (key: "grade2Optional" | "grade3Sem1") => void;
  handleExtraUpload: (key: "grade2Optional" | "grade3Sem1") => (e: React.ChangeEvent<HTMLInputElement>) => void;
  setChangeActiveTab: (tab: ChangeActiveTab) => void;
}

export function UploadStep({
  changeActiveGrade,
  setChangeActiveGrade,
  parsedSampleData,
  changeUploadNames,
  extraUploads,
  handleDeleteSampleUpload,
  handleChangeSampleUpload,
  handleDeleteExtraUpload,
  handleExtraUpload,
  setChangeActiveTab,
}: UploadStepProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* BasicStep.tsx와 같은 이유로 flex-wrap·break-keep을 둡니다 — 자세한 설명은 그쪽 주석 참고. */}
      <div className="flex justify-between items-center gap-3 flex-wrap mb-2">
        <h2 className="text-2xl font-semibold text-stone-900 flex items-center gap-2 break-keep">
          <Upload className="w-6 h-6 text-amber-600 shrink-0" />
          타임별 선택과목 데이터 업로드(해당학기 데이터만)
        </h2>

        <div className="flex bg-stone-100 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setChangeActiveGrade("grade2")}
            className={`px-6 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${changeActiveGrade === "grade2"
                ? "bg-amber-500 text-stone-900 shadow-md"
                : "text-stone-900 hover:text-stone-900"
              }`}
          >
            2학년
          </button>
          <button
            onClick={() => setChangeActiveGrade("grade3")}
            className={`px-6 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${changeActiveGrade === "grade3"
                ? "bg-amber-500 text-stone-900 shadow-md"
                : "text-stone-900 hover:text-stone-900"
              }`}
          >
            3학년
          </button>
        </div>
      </div>

      {parsedSampleData[changeActiveGrade] && parsedSampleData[changeActiveGrade].length > 0 ? (
        <div
          className="bg-stone-100 rounded-2xl p-8 border border-emerald-500/30 flex flex-col items-center justify-center min-h-[300px] text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.[0]) {
              handleChangeSampleUpload({ target: { files: e.dataTransfer.files } } as unknown as React.ChangeEvent<HTMLInputElement>);
            }
          }}
        >
          <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-700" />
          </div>
          <h3 className="text-xl font-medium text-stone-800 mb-2">타임별 선택과목 파일 업로드</h3>
          <p className="text-stone-600 mb-4 text-center max-w-full px-4">
            선택과목 현황이 A, B, C등 타임이 입력되어 있는 파일을 업로드 해 주세요.
            <br />
            &quot;리로스쿨-교육과정-이동시간표 편성-백업파일 불러오기-엑셀저장&quot;에서 다운받은 파일을 업로드 해 주세요.
          </p>
          <div className="flex flex-col items-center gap-2 mb-6">
            <div className="flex items-center gap-2">
              <FileIcon className="w-4 h-4 text-emerald-700" />
              <span className="text-emerald-700 font-medium">
                {changeUploadNames[changeActiveGrade]?.timetable || '업로드된 파일'}
              </span>
            </div>
            <span className="text-stone-600 text-sm">
              {changeActiveGrade === "grade2" ? "2학년" : "3학년"} 학생 선택 데이터: {parsedSampleData[changeActiveGrade].length}명 파싱 완료
            </span>
          </div>
          <div className="flex gap-4">
            <button
              onClick={handleDeleteSampleUpload}
              className="flex items-center gap-2 px-5 py-2.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-700 border border-rose-500/20 font-medium rounded-xl transition-all"
            >
              <Trash2 className="w-4 h-4" />
              삭제
            </button>
            <label className="cursor-pointer flex items-center gap-2 px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 border border-stone-300 font-medium rounded-xl transition-all">
              <Upload className="w-4 h-4" />
              재업로드
              <input
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={handleChangeSampleUpload}
              />
            </label>
            <button
              onClick={() => setChangeActiveTab("timetable")}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl transition-all shadow-lg shadow-amber-500/20"
            >
              시간표 입력으로 이동
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          className="bg-stone-100 rounded-2xl p-6 border border-stone-300 flex flex-col items-center justify-center min-h-[300px]"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.[0]) {
              handleChangeSampleUpload({ target: { files: e.dataTransfer.files } } as unknown as React.ChangeEvent<HTMLInputElement>);
            }
          }}
        >
          <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mb-4">
            <FileIcon className="w-10 h-10 text-amber-600" />
          </div>
          <h3 className="text-xl font-medium text-stone-800 mb-2">타임별 선택과목 파일 업로드</h3>
          <p className="text-stone-600 mb-6 text-center max-w-full px-4">
            선택과목 현황이 A, B, C등 타임이 입력되어 있는 파일을 업로드 해 주세요.
            <br />
            &quot;리로스쿨-교육과정-이동시간표 편성-백업파일 불러오기-엑셀저장&quot;에서 다운받은 파일을 업로드 해 주세요.
          </p>

          <label className="cursor-pointer flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl transition-all shadow-lg shadow-amber-500/20">
            <Upload className="w-5 h-5" />
            엑셀 파일 선택
            <input
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              onChange={handleChangeSampleUpload}
            />
          </label>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        {/* 2학년 수강과목 데이터 업로드(선택) */}
        <div
          className="bg-stone-100 rounded-2xl p-6 border border-stone-300 flex flex-col items-center justify-center min-h-[250px]"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.[0]) {
              handleExtraUpload('grade2Optional')({ target: { files: e.dataTransfer.files } } as unknown as React.ChangeEvent<HTMLInputElement>);
            }
          }}
        >
          {extraUploads[changeActiveGrade]?.grade2Optional ? (
            <>
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-700" />
              </div>
              <h3 className="text-lg font-medium text-stone-800 mb-4">2학년 수강과목 데이터 업로드(선택)</h3>
              <div className="flex items-center gap-2 mb-6 text-sm">
                <FileIcon className="w-4 h-4 text-emerald-700" />
                <span className="text-emerald-700 font-medium">
                  {changeUploadNames[changeActiveGrade]?.grade2Optional || '업로드된 파일'}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDeleteExtraUpload('grade2Optional')}
                  className="flex items-center gap-2 px-3 py-2 bg-rose-600/10 hover:bg-rose-600/20 text-rose-700 border border-rose-500/20 font-medium rounded-xl transition-all text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  삭제
                </button>
                <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 border border-stone-300 font-medium rounded-xl transition-all">
                  <Upload className="w-4 h-4" />
                  재업로드
                  <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExtraUpload('grade2Optional')} />
                </label>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-4">
                <FileIcon className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-lg font-medium text-stone-800 mb-6">2학년 수강과목 데이터 업로드(선택)</h3>
              <label className="cursor-pointer flex items-center gap-2 px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 border border-stone-300 font-medium rounded-xl transition-all shadow-sm">
                <Upload className="w-4 h-4" />
                파일 업로드
                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExtraUpload('grade2Optional')} />
              </label>
            </>
          )}
        </div>

        {/* 3학년 1학기 데이터 업로드 */}
        <div
          className="bg-stone-100 rounded-2xl p-6 border border-stone-300 flex flex-col items-center justify-center min-h-[250px]"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.[0]) {
              handleExtraUpload('grade3Sem1')({ target: { files: e.dataTransfer.files } } as unknown as React.ChangeEvent<HTMLInputElement>);
            }
          }}
        >
          {extraUploads[changeActiveGrade]?.grade3Sem1 ? (
            <>
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-700" />
              </div>
              <h3 className="text-lg font-medium text-stone-800 mb-4">3학년 1학기 데이터 업로드</h3>
              <div className="flex items-center gap-2 mb-6 text-sm">
                <FileIcon className="w-4 h-4 text-emerald-700" />
                <span className="text-emerald-700 font-medium">
                  {changeUploadNames[changeActiveGrade]?.grade3Sem1 || '업로드된 파일'}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDeleteExtraUpload('grade3Sem1')}
                  className="flex items-center gap-2 px-3 py-2 bg-rose-600/10 hover:bg-rose-600/20 text-rose-700 border border-rose-500/20 font-medium rounded-xl transition-all text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  삭제
                </button>
                <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 border border-stone-300 font-medium rounded-xl transition-all">
                  <Upload className="w-4 h-4" />
                  재업로드
                  <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExtraUpload('grade3Sem1')} />
                </label>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-4">
                <FileIcon className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-lg font-medium text-stone-800 mb-6">3학년 1학기 데이터 업로드</h3>
              <label className="cursor-pointer flex items-center gap-2 px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 border border-stone-300 font-medium rounded-xl transition-all shadow-sm">
                <Upload className="w-4 h-4" />
                파일 업로드
                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExtraUpload('grade3Sem1')} />
              </label>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
