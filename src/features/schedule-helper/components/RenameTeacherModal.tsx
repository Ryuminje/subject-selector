"use client";

import { useState } from "react";
import { Loader2, Pencil, TriangleAlert, X } from "lucide-react";
import { suggestDistinctName, type RenameMode } from "@/features/schedule-helper/lib/renameTeacher";

interface RenameSummary {
  cells: number;
  blockedTeachers: boolean;
  manualChanges: number;
  meetingPresets: number;
  makeupBatches: number;
  accounts: number;
  unlinkedAccounts: number;
  adoptedStaleRow: boolean;
  certificates: { certificates: number; titles: number; rosters: number; signatures: number; extras: number };
}

interface RenameTeacherModalProps {
  teacher: string;
  /** 지금 시간표에 있는 모든 교사 이름 — 동명이인 판정에 씁니다. */
  existingNames: string[];
  onClose: () => void;
  onRenamed: (from: string, to: string) => void;
}

const API = "/api/schedule-helper/teachers/rename";

/** 0이 아닌 항목만 한 줄씩. 사용자가 "이게 같이 바뀐다"를 확인하는 용도입니다. */
function summaryLines(s: RenameSummary, includeCertificates: boolean): string[] {
  const lines: string[] = [];
  lines.push(`시간표 수업 ${s.cells}칸`);
  if (s.manualChanges > 0) lines.push(`이미 이뤄진 교체 기록 ${s.manualChanges}건`);
  if (s.makeupBatches > 0) lines.push(`저장해 둔 보강 작업 세트 ${s.makeupBatches}개`);
  if (s.meetingPresets > 0) lines.push(`협의회 묶음 ${s.meetingPresets}개`);
  if (s.blockedTeachers) lines.push("교체·대강 금지 교사 목록");
  if (s.accounts > 0) lines.push(`같은 이름의 계정 ${s.accounts}개(계정 이름도 함께 바뀝니다)`);
  if (includeCertificates) {
    const c = s.certificates;
    if (c.certificates > 0) lines.push(`연수 이수증 ${c.certificates}건`);
    if (c.signatures > 0) lines.push(`연수 서명 ${c.signatures}건`);
    if (c.titles > 0) lines.push(`담당으로 등록한 연수 ${c.titles}건`);
    if (c.rosters > 0) lines.push(`연수 참여 명단 ${c.rosters}곳`);
    if (c.extras > 0) lines.push("연수 추가 명단(행정직원 등)");
  }
  return lines;
}

type Step = "form" | "duplicate" | "confirm";

export default function RenameTeacherModal({ teacher, existingNames, onClose, onRenamed }: RenameTeacherModalProps) {
  const [step, setStep] = useState<Step>("form");
  // 동명이인 확인을 거쳐 온 경우 확인 단계의 "뒤로"가 그 단계로 돌아가게 합니다.
  const [viaDuplicate, setViaDuplicate] = useState(false);
  // 동명이인으로 걸린 원래 입력 이름(안내 문구용 — 구분 이름을 고치는 동안에도 그대로 둡니다).
  const [duplicateOf, setDuplicateOf] = useState("");
  const [newName, setNewName] = useState("");
  const [mode, setMode] = useState<RenameMode>("correct");
  const [includeCertificates, setIncludeCertificates] = useState(true);
  const [summary, setSummary] = useState<RenameSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = async (name: string, dryRun: boolean) => {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: teacher, to: name, mode, includeCertificates, dryRun }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string; summary?: RenameSummary };
    if (!res.ok) throw new Error(body.error ?? "이름을 바꾸지 못했습니다.");
    return body.summary as RenameSummary;
  };

  // 영향 범위를 서버에서 미리 계산해 확인 단계에 보여 줍니다(아직 아무것도 바뀌지 않음).
  const preview = async (name: string) => {
    setBusy(true);
    setError(null);
    try {
      setSummary(await call(name, true));
      setStep("confirm");
    } catch (e) {
      setError(e instanceof Error ? e.message : "영향 범위를 확인하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const handleNext = async () => {
    const name = newName.trim();
    if (!name) {
      setError("새 이름을 입력해 주세요.");
      return;
    }
    if (name === teacher) {
      setError("지금 이름과 같습니다.");
      return;
    }
    // 같은 이름이 이미 있으면 바로 바꾸지 않고 동명이인인지 물어봅니다.
    if (existingNames.includes(name)) {
      setDuplicateOf(name);
      setNewName(suggestDistinctName(name, existingNames));
      setError(null);
      setViaDuplicate(true);
      setStep("duplicate");
      return;
    }
    setViaDuplicate(false);
    await preview(name);
  };

  const handleDuplicateContinue = async () => {
    const name = newName.trim();
    if (!name || name === teacher) {
      setError("구분할 수 있는 새 이름을 입력해 주세요.");
      return;
    }
    if (existingNames.includes(name)) {
      setError(`"${name}" 선생님도 이미 있습니다. 다른 구분 이름을 써 주세요.`);
      return;
    }
    await preview(name);
  };

  const handleApply = async () => {
    setBusy(true);
    setError(null);
    try {
      const name = newName.trim();
      await call(name, false);
      onRenamed(teacher, name);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "이름을 바꾸지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-2xl border border-stone-200 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-stone-200 bg-stone-50">
          <h3 className="font-bold text-stone-900 flex items-center gap-2">
            <Pencil className="w-4 h-4 text-swap" /> {teacher} 선생님 이름 바꾸기
          </h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900" aria-label="닫기">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm">
          {step === "form" && (
            <>
              <label className="block">
                <span className="block text-xs font-semibold text-stone-600 mb-1">새 이름</span>
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleNext();
                  }}
                  maxLength={40}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-swap/30 focus:border-swap"
                />
              </label>

              <div className="space-y-2">
                {(
                  [
                    ["correct", "이름 정정", "같은 선생님입니다(오타·개명). 교체 불가 요일 같은 설정을 그대로 둡니다."],
                    ["replace", "후임 교사로 교체", "휴직 대체 등 다른 선생님이 맡습니다. 이전 선생님의 교체 불가 요일·임시 설정은 비우고, 연결된 계정은 끊습니다."],
                  ] as const
                ).map(([value, label, hint]) => (
                  <label
                    key={value}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                      mode === value ? "border-swap bg-swap/5" : "border-stone-200 hover:bg-stone-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="rename-mode"
                      checked={mode === value}
                      onChange={() => setMode(value)}
                      className="mt-0.5 accent-swap"
                    />
                    <span>
                      <span className="font-semibold text-stone-800">{label}</span>
                      <span className="block text-xs text-stone-500 mt-0.5">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCertificates}
                  onChange={(e) => setIncludeCertificates(e.target.checked)}
                  className="mt-0.5 accent-swap"
                />
                <span>
                  연수 이수증 기록도 함께 바꾸기
                  {mode === "replace" && includeCertificates && (
                    <span className="block text-xs text-amber-700 mt-0.5">
                      후임 교체에서는 이전 선생님이 낸 이수증·서명도 새 이름으로 바뀝니다. 이전 선생님의 기록을 남기려면 체크를 끄세요.
                    </span>
                  )}
                </span>
              </label>
            </>
          )}

          {step === "duplicate" && (
            <>
              <div className="flex gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  시간표에 &quot;{duplicateOf}&quot; 선생님이 이미 있습니다. 같은 이름의 <b>다른 선생님(동명이인)</b>이라면
                  두 분을 구분할 수 있게 이름을 고쳐서 저장합니다.
                </p>
              </div>
              <label className="block">
                <span className="block text-xs font-semibold text-stone-600 mb-1">구분되는 이름</span>
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleDuplicateContinue();
                  }}
                  maxLength={40}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-swap/30 focus:border-swap"
                />
                <span className="block text-xs text-stone-500 mt-1">예: 이영희(2), 이영희(수학)</span>
              </label>
            </>
          )}

          {step === "confirm" && summary && (
            <>
              <p className="text-stone-700">
                <b>{teacher}</b> → <b>{newName.trim()}</b> ({mode === "replace" ? "후임 교사로 교체" : "이름 정정"})
              </p>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <p className="text-xs font-semibold text-stone-600 mb-1.5">함께 바뀌는 것</p>
                <ul className="space-y-0.5 text-stone-700 list-disc pl-4">
                  {summaryLines(summary, includeCertificates).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {mode === "replace" && summary.unlinkedAccounts > 0 && (
                  <p className="text-xs text-stone-500 mt-2">연결된 계정 {summary.unlinkedAccounts}개는 이 선생님과의 연결이 끊깁니다.</p>
                )}
                {summary.adoptedStaleRow && (
                  <p className="text-xs text-stone-500 mt-2">옛 업로드에 남아 있던 같은 이름의 교사 정보는 정리됩니다.</p>
                )}
              </div>
              <p className="text-xs text-stone-500">
                시간표를 다시 업로드해도 이 이름이 유지됩니다. 되돌리려면 같은 방법으로 원래 이름으로 바꾸세요.
              </p>
            </>
          )}

          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-stone-200 bg-stone-50">
          {step !== "form" && (
            <button
              onClick={() => {
                setError(null);
                setStep(step === "confirm" && viaDuplicate ? "duplicate" : "form");
              }}
              disabled={busy}
              className="px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-200 rounded-xl transition-colors disabled:opacity-50"
            >
              뒤로
            </button>
          )}
          <button onClick={onClose} disabled={busy} className="px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-200 rounded-xl transition-colors disabled:opacity-50">
            취소
          </button>
          {step === "form" && (
            <button
              onClick={handleNext}
              disabled={busy}
              className="inline-flex items-center gap-2 px-5 py-2 bg-swap hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} 다음
            </button>
          )}
          {step === "duplicate" && (
            <button
              onClick={handleDuplicateContinue}
              disabled={busy}
              className="inline-flex items-center gap-2 px-5 py-2 bg-swap hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} 동명이인입니다 — 이 이름으로 계속
            </button>
          )}
          {step === "confirm" && (
            <button
              onClick={handleApply}
              disabled={busy}
              className="inline-flex items-center gap-2 px-5 py-2 bg-swap hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} 이름 바꾸기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
