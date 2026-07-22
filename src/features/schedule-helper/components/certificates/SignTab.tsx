"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QrCode, Plus, X, Loader2, History, Lock, Unlock } from "lucide-react";
import { useSignSession } from "./useSignSession";

export default function SignTab() {
  const router = useRouter();
  const { creating, error, createSession, pastSessions, loadingSessions, loadPastSessions } = useSignSession();
  const [titles, setTitles] = useState<string[]>([""]);

  const updateTitle = (idx: number, value: string) => {
    setTitles((prev) => prev.map((t, i) => (i === idx ? value : t)));
  };

  const addTitleRow = () => setTitles((prev) => [...prev, ""]);
  const removeTitleRow = (idx: number) => setTitles((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  const handleCreate = async () => {
    const cleaned = titles.map((t) => t.trim()).filter(Boolean);
    if (cleaned.length === 0) return;
    const sessionId = await createSession(cleaned);
    if (sessionId) router.push(`/apps/schedule-helper/certificates/sessions/${sessionId}`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-teal-700 mb-1 flex items-center gap-2">
          <QrCode className="w-5 h-5" /> QR 서명 세션 만들기
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          연수 제목을 하나 이상 입력하세요. 2개 이상 입력하면 여러 연수를 한 번의 서명으로 동시에 처리하는
          &quot;복수 연수&quot; 세션이 됩니다.
        </p>

        <div className="space-y-2 mb-3">
          {titles.map((title, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => updateTitle(idx, e.target.value)}
                placeholder={`연수 제목 ${idx + 1}`}
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
              />
              {titles.length > 1 && (
                <button
                  onClick={() => removeTitleRow(idx)}
                  className="w-10 h-10 shrink-0 flex items-center justify-center bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={addTitleRow}
          className="w-full mb-4 py-2.5 border-2 border-dashed border-slate-200 hover:border-teal-300 hover:bg-teal-50/30 rounded-xl text-sm font-semibold text-slate-500 hover:text-teal-700 transition-colors inline-flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> 연수 추가
        </button>

        <button
          onClick={handleCreate}
          disabled={creating || titles.every((t) => !t.trim())}
          className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-60 transition-colors"
        >
          {creating && <Loader2 className="w-4 h-4 animate-spin" />}
          QR 코드 생성
        </button>
        {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-teal-700 flex items-center gap-2">
            <History className="w-5 h-5" /> 이전 연수 세션
          </h2>
          <button
            onClick={loadPastSessions}
            className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors"
          >
            새로고침
          </button>
        </div>

        {loadingSessions ? (
          <div className="flex justify-center py-8 text-teal-600">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : !pastSessions || pastSessions.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">이전 세션이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {pastSessions.map((s) => (
              <button
                key={s.id}
                onClick={() => router.push(`/apps/schedule-helper/certificates/sessions/${s.id}`)}
                className="w-full text-left p-3.5 bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-2 font-bold text-slate-800 mb-1">
                  {s.locked ? <Lock className="w-4 h-4 text-rose-500" /> : <Unlock className="w-4 h-4 text-emerald-500" />}
                  {s.trainingTitles.join(" / ")}
                  {s.isGroup && (
                    <span className="text-[11px] bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-semibold">
                      복수연수
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(s.createdAt).toLocaleDateString("ko-KR")} · {s.signedCount} / {s.totalCount}명 서명
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
