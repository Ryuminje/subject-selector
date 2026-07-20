"use client";

import React from "react";
import { Download, File as FileIcon } from "lucide-react";
import type { ChangeGradeKey } from "../types";

interface RiroschoolStepProps {
  sampleRawData: { grade2: string | null; grade3: string | null };
  handleDownloadRiroschool: (grade: ChangeGradeKey) => void;
}

export function RiroschoolStep({
  sampleRawData,
  handleDownloadRiroschool,
}: RiroschoolStepProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-stone-900 flex items-center gap-2">
          <Download className="w-6 h-6 text-amber-600" />
          리로스쿨 업로드용 파일 다운로드
        </h2>
      </div>

      <div className="bg-stone-100 rounded-2xl p-6 md:p-10 border border-stone-300">
        <div className="flex flex-col items-center justify-center text-center space-y-4 max-w-2xl mx-auto">
          <div className="w-16 h-16 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center mb-2">
            <FileIcon className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="text-xl font-bold text-stone-900">
            최종 선택과목 데이터 엑셀 다운로드
          </h3>
          <p className="text-stone-600 text-sm md:text-base leading-relaxed">
            2단계에서 업로드했던 원본 엑셀 파일(sample3)의 형태와 서식을 그대로 유지한 채,<br />
            학생들의 변경 신청 결과에 맞춰 선택과목 알파벳 마킹(A, B, C, D)만 정확히 최신화하여 다운로드합니다.
          </p>

          <div className="flex gap-4 mt-8 pt-4">
            <button
              onClick={() => handleDownloadRiroschool('grade2')}
              disabled={!sampleRawData['grade2']}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg ${
                sampleRawData['grade2']
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-500/20 hover:scale-105'
                  : 'bg-stone-100 text-stone-900 cursor-not-allowed border border-stone-300'
              }`}
            >
              <Download className="w-5 h-5" />
              2학년 리로스쿨 엑셀 다운로드
            </button>
            <button
              onClick={() => handleDownloadRiroschool('grade3')}
              disabled={!sampleRawData['grade3']}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg ${
                sampleRawData['grade3']
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-500/20 hover:scale-105'
                  : 'bg-stone-100 text-stone-900 cursor-not-allowed border border-stone-300'
              }`}
            >
              <Download className="w-5 h-5" />
              3학년 리로스쿨 엑셀 다운로드
            </button>
          </div>

          {(!sampleRawData['grade2'] && !sampleRawData['grade3']) && (
            <p className="text-rose-700 text-sm mt-4">
              ⚠️ 2단계 탭에서 원본 파일을 먼저 업로드해야 다운로드가 가능합니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
