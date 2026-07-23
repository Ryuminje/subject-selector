"use client";

import { useSession } from "@/lib/auth-client";
import { Send, FileUp, Loader2, CheckCircle2, Info } from "lucide-react";
import GeminiKeySettings from "./GeminiKeySettings";
import ConfirmModal from "./ConfirmModal";
import TrainingTitleSelect from "./TrainingTitleSelect";
import { useSubmitCertificate } from "./useSubmitCertificate";

export default function SubmitTab({ isAdmin }: { isAdmin: boolean }) {
  const { data: session } = useSession();
  const {
    trainingTitle,
    setTrainingTitle,
    file,
    fileError,
    handleFileChange,
    analyzing,
    submitting,
    analyzeResult,
    modalOpen,
    error,
    successMessage,
    noApiKey,
    handleAnalyze,
    handleConfirmSubmit,
    handleCancelModal,
  } = useSubmitCertificate();

  return (
    <div className="space-y-6">
      {isAdmin && <GeminiKeySettings />}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-teal-700 mb-1 flex items-center gap-2">
          <Send className="w-5 h-5" /> 이수증 제출하기
        </h2>
        <p className="text-sm text-slate-500 mb-5">
          {session?.user?.name ?? "본인"} 선생님 이름으로 제출됩니다.
        </p>

        <div className="mb-4">
          <label className="text-sm font-bold text-slate-700 mb-1.5 block">연수 제목</label>
          <TrainingTitleSelect value={trainingTitle} onChange={setTrainingTitle} />
          <p className="text-xs text-slate-400 mt-1.5">
            목록에 없는 연수라면 &quot;연수목록 관리&quot; 탭에서 새로 등록할 수 있어요.
          </p>
        </div>

        <div className="mb-5">
          <label className="text-sm font-bold text-slate-700 mb-1.5 block">이수증 파일 (10MB 이하)</label>
          <label className="relative flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-2xl py-8 px-4 text-center cursor-pointer hover:border-teal-300 hover:bg-teal-50/30 transition-colors">
            <input
              type="file"
              accept="image/*,application/pdf"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
            <FileUp className="w-8 h-8 text-slate-300" />
            {file ? (
              <span className="text-sm font-bold text-teal-700">{file.name}</span>
            ) : (
              <span className="text-sm text-slate-500">클릭하여 이수증 파일을 선택해주세요</span>
            )}
          </label>
          {fileError && <p className="text-xs text-rose-600 mt-2">{fileError}</p>}
        </div>

        <button
          onClick={handleAnalyze}
          disabled={analyzing || !file || !trainingTitle.trim()}
          className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-60 transition-colors"
        >
          {analyzing && <Loader2 className="w-4 h-4 animate-spin" />}
          {analyzing ? "AI가 이수증을 분석 중..." : "제출하기"}
        </button>

        {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}
        {successMessage && (
          <div className="mt-4 flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm font-semibold">
            <CheckCircle2 className="w-4 h-4" /> {successMessage}
          </div>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex gap-3 text-amber-800 text-sm leading-relaxed">
        <Info className="w-5 h-5 shrink-0 text-amber-600" />
        <div>
          제미나이 AI가 이수증에서 <strong>이수번호, 이수기관, 이수날짜</strong>를 자동 추출합니다. 추출 결과를
          확인/수정한 후 최종 제출됩니다.
        </div>
      </div>

      {modalOpen && (
        <ConfirmModal
          initial={{
            number: analyzeResult?.number ?? null,
            institution: analyzeResult?.institution ?? null,
            date: analyzeResult?.date ?? null,
          }}
          submitting={submitting}
          onCancel={handleCancelModal}
          onConfirm={handleConfirmSubmit}
        />
      )}

      {noApiKey && modalOpen && (
        <p className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
          관리자가 아직 Gemini API 키를 설정하지 않았습니다. 값을 직접 입력해 제출할 수 있습니다.
        </p>
      )}
    </div>
  );
}
