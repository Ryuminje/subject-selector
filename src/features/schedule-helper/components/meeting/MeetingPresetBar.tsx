"use client";

import { useState } from "react";
import { Bookmark, BookmarkPlus, Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { cn } from "@/features/schedule-helper/lib/utils";
import { useMeetingPresets, type MeetingPreset } from "./useMeetingPresets";

// 협의회 교사 프리셋 막대 — 자주 함께 잡는 사람들을 이름 붙여 저장해 두고 한 번에 고릅니다.
//
// 계정별이라 서버에 저장되고, 로그아웃했다 다시 들어와도 그대로 남습니다.
// 담기와 달리 **프리셋을 누르면 현재 선택을 덮어씁니다** — "저 묶음으로 바꾼다"가
// 원하는 동작이지, 이전 선택에 더해지는 것은 대개 실수이기 때문입니다.

interface Props {
  /** 지금 선택된 교사 (저장·덮어쓰기에 씁니다) */
  selected: string[];
  /** 프리셋을 눌렀을 때 선택을 이걸로 교체 */
  onApply: (teachers: string[]) => void;
}

export default function MeetingPresetBar({ selected, onApply }: Props) {
  const { presets, loading, error, create, update, remove } = useMeetingPresets();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<MeetingPreset | null>(null);

  const canSave = selected.length >= 2;

  /** 저장/수정 공통 — 실패하면 서버가 준 문구를 그대로 띄웁니다. */
  const run = async (action: () => Promise<string | null>, done?: () => void) => {
    setBusy(true);
    const failure = await action();
    setBusy(false);
    setMessage(failure);
    if (!failure) done?.();
  };

  const submitNew = async () => {
    const trimmed = name.trim();
    if (!trimmed) return setMessage("프리셋 이름을 입력해 주세요.");
    await run(
      () => create(trimmed, selected),
      () => {
        setName("");
        setNaming(false);
      },
    );
  };

  const submitRename = async () => {
    if (!renaming) return;
    const trimmed = name.trim();
    if (!trimmed) return setMessage("프리셋 이름을 입력해 주세요.");
    await run(
      () => update(renaming.id, { name: trimmed }),
      () => {
        setName("");
        setRenaming(null);
      },
    );
  };

  return (
    <div className="mb-4 pb-4 border-b border-dashed border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
          <Bookmark className="w-3.5 h-3.5" /> 내 프리셋
        </h3>
        {!naming && !renaming && (
          <button
            onClick={() => {
              setNaming(true);
              setMessage(null);
            }}
            disabled={!canSave}
            title={canSave ? "지금 선택을 프리셋으로 저장합니다" : "교사를 2명 이상 선택하면 저장할 수 있습니다"}
            className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700 disabled:text-slate-300 transition-colors"
          >
            <BookmarkPlus className="w-3.5 h-3.5" /> 현재 선택 저장
          </button>
        )}
      </div>

      {/* 새로 저장 / 이름 바꾸기 입력줄 */}
      {(naming || renaming) && (
        <div className="flex items-center gap-1.5 mb-2">
          <input
            autoFocus
            type="text"
            value={name}
            maxLength={30}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void (renaming ? submitRename() : submitNew());
              if (e.key === "Escape") {
                setNaming(false);
                setRenaming(null);
                setName("");
                setMessage(null);
              }
            }}
            placeholder={renaming ? "새 이름" : `이름 (예: 2학년부) · ${selected.length}명`}
            className="flex-1 min-w-0 border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-teal-400"
          />
          <button
            onClick={() => void (renaming ? submitRename() : submitNew())}
            disabled={busy}
            className="p-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white disabled:bg-slate-200 transition-colors"
            title="저장"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => {
              setNaming(false);
              setRenaming(null);
              setName("");
              setMessage(null);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
            title="취소"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {message && <p className="text-[11px] text-rose-600 mb-2">{message}</p>}
      {error && <p className="text-[11px] text-rose-600 mb-2">{error}</p>}

      {loading ? (
        <p className="text-[11px] text-slate-400">불러오는 중…</p>
      ) : presets.length === 0 ? (
        <p className="text-[11px] text-slate-400 leading-relaxed">
          자주 함께 잡는 선생님들을 골라 <b>현재 선택 저장</b>을 누르면, 다음부터 한 번에 고를 수 있습니다.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="group inline-flex items-center rounded-full border border-slate-200 bg-slate-50 hover:border-teal-300 hover:bg-teal-50 transition-colors"
            >
              <button
                onClick={() => onApply(preset.teachers)}
                title={preset.teachers.join(", ")}
                className="pl-2.5 pr-1.5 py-1 text-xs font-semibold text-slate-700 group-hover:text-teal-700"
              >
                {preset.name}
                <span className="ml-1 font-normal text-slate-400">{preset.teachers.length}</span>
              </button>

              {/* 지금 선택으로 덮어쓰기 — 사람이 바뀌었을 때 지우고 다시 만들지 않아도 되게 */}
              <button
                onClick={() =>
                  void run(() => update(preset.id, { teachers: selected }))
                }
                disabled={!canSave || busy}
                title="지금 선택한 사람들로 이 프리셋을 덮어씁니다"
                className="px-1 py-1 text-slate-300 hover:text-teal-600 disabled:hover:text-slate-300 disabled:opacity-40"
              >
                <BookmarkPlus className="w-3 h-3" />
              </button>
              <button
                onClick={() => {
                  setRenaming(preset);
                  setNaming(false);
                  setName(preset.name);
                  setMessage(null);
                }}
                title="이름 바꾸기"
                className="px-1 py-1 text-slate-300 hover:text-slate-600"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={() => {
                  if (!window.confirm(`"${preset.name}" 프리셋을 지울까요?`)) return;
                  void run(() => remove(preset.id));
                }}
                title="지우기"
                className={cn("pr-2 pl-1 py-1 text-slate-300 hover:text-rose-600")}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
