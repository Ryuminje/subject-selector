"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QrCode, Loader2, History, Lock, Unlock } from "lucide-react";
import { useSignSession } from "./useSignSession";
import { useRosterPresets } from "./useRosterPresets";
import TrainingTitleMultiSelect from "./TrainingTitleMultiSelect";

export default function SignTab() {
  const router = useRouter();
  const { creating, error, createSession, pastSessions, loadingSessions, loadPastSessions } = useSignSession();
  const rosterPresets = useRosterPresets();
  const { presets } = rosterPresets;
  const [titles, setTitles] = useState<string[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");

  const selectedPreset = presets?.find((p) => p.id === selectedPresetId) ?? null;

  const handleCreate = async () => {
    if (titles.length === 0) return;
    const sessionId = await createSession(titles, selectedPreset?.names, selectedPreset?.name ?? null);
    if (sessionId) router.push(`/apps/schedule-helper/certificates/sessions/${sessionId}`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-teal-700 mb-1 flex items-center gap-2">
          <QrCode className="w-5 h-5" /> QR 서명 세션 만들기
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          등록된 연수 중 하나 이상을 선택하세요. 2개 이상 선택하면 여러 연수를 한 번의 서명으로 동시에 처리하는
          &quot;복수 연수&quot; 세션이 됩니다.
        </p>

        <label className="text-sm font-bold text-slate-700 mb-1.5 block">연수 제목</label>
        <div className="mb-4">
          <TrainingTitleMultiSelect value={titles} onChange={setTitles} />
        </div>

        <label className="text-sm font-bold text-slate-700 mb-1.5 block">참여 명단</label>
        <select
          value={selectedPresetId}
          onChange={(e) => setSelectedPresetId(e.target.value)}
          className="w-full mb-4 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
        >
          <option value="">자동 (연수별 등록 명단 적용)</option>
          {presets?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.names.length}명
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-400 -mt-2.5 mb-4">
          기본값은 각 연수에 등록된 명단을 그대로 사용합니다(복수 연수 시 연수별로 서명이 분리됩니다). 프리셋을
          고르면 선택한 모든 연수에 그 명단이 동일하게 적용됩니다. 프리셋은 &quot;연수목록 관리 → 명단 프리셋
          관리&quot;에서 만들 수 있습니다.
        </p>

        <button
          onClick={handleCreate}
          disabled={creating || titles.length === 0}
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
                  {s.rosterPresetName && (
                    <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                      {s.rosterPresetName}
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
