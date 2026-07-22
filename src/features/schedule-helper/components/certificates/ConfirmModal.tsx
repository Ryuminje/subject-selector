"use client";

import { useState } from "react";
import { Bot, Loader2 } from "lucide-react";

export interface ConfirmModalFields {
  number: string;
  institution: string;
  date: string;
}

interface ConfirmModalProps {
  initial: { number: string | null; institution: string | null; date: string | null };
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (fields: ConfirmModalFields) => void;
}

function Badge({ recognized }: { recognized: boolean }) {
  return recognized ? (
    <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md font-semibold">AI 추출</span>
  ) : (
    <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md font-semibold">인식 실패</span>
  );
}

export default function ConfirmModal({ initial, submitting, onCancel, onConfirm }: ConfirmModalProps) {
  const [number, setNumber] = useState(initial.number ?? "");
  const [institution, setInstitution] = useState(initial.institution ?? "");
  const [date, setDate] = useState(initial.date ?? "");

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-teal-700 mb-1 flex items-center gap-2">
          <Bot className="w-5 h-5" /> AI 추출 결과 확인
        </h2>
        <p className="text-sm text-slate-500 mb-5">자동 추출된 정보를 확인하고, 틀린 부분이 있으면 직접 수정해주세요.</p>

        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <label className="text-sm font-bold text-slate-700">이수번호</label>
              <Badge recognized={!!initial.number} />
            </div>
            <input
              type="text"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="이수번호를 입력하세요"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <label className="text-sm font-bold text-slate-700">이수기관</label>
              <Badge recognized={!!initial.institution} />
            </div>
            <input
              type="text"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="이수기관을 입력하세요"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <label className="text-sm font-bold text-slate-700">이수날짜</label>
              <Badge recognized={!!initial.date} />
            </div>
            <input
              type="text"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="예) 2025-03-15"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => onConfirm({ number, institution, date })}
            disabled={submitting}
            className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-60 transition-colors"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            이대로 제출
          </button>
        </div>
      </div>
    </div>
  );
}
