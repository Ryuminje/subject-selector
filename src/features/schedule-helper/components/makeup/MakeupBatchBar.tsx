"use client";

import { useState } from "react";
import { Bookmark, BookmarkPlus, Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { cn } from "@/features/schedule-helper/lib/utils";
import type { MakeupBatch } from "./useMakeupBatches";
import type { MakeupEntry } from "@/features/schedule-helper/lib/makeup/types";

// 교체·보강 작업 세트 저장 막대 — 여러 선생님 몫을 한 번에 손보다 시간이 걸릴 때, 지금까지
// 담은 내역에 이름을 붙여 서버에 저장해 두고 나중에 이어서 고칠 수 있게 합니다.
//
// MeetingPresetBar.tsx와 같은 자리·같은 상호작용이지만, 목록 상태(useMakeupBatches)는
// **SwapTab이 들고 있다가 props로 내려줍니다** — MeetingPresetBar와 달리 SwapTab도 겹침
// 판정에 다른 작업 세트들의 entries가 같이 필요해서, 이 컴포넌트가 따로 fetch하면 같은
// 데이터를 두 번 불러오게 됩니다. **누르면 지금 트레이 내용을 통째로 덮어씁니다**(불러오기든
// 최신 상태로 저장이든) — "이 작업 세트로 바꾼다"가 원하는 동작이지, 지금 담긴 것에 더해지는
// 건 대개 실수이기 때문입니다.

interface Props {
  /** 지금 트레이에 담긴 내역(저장·덮어쓰기에 씁니다) */
  entries: MakeupEntry[];
  /** 지금 트레이의 결강 주간 기준일(저장·덮어쓰기에 씁니다) */
  baseDate: string;
  /** 작업 세트를 눌렀을 때 트레이 내용을 이걸로 교체 */
  onLoad: (batch: MakeupBatch) => void;
  batches: MakeupBatch[];
  loading: boolean;
  error: string | null;
  create: (name: string, entries: MakeupEntry[], baseDate: string) => Promise<string | null>;
  update: (id: string, patch: { name?: string; entries?: MakeupEntry[]; baseDate?: string }) => Promise<string | null>;
  remove: (id: string) => Promise<string | null>;
}

export default function MakeupBatchBar({ entries, baseDate, onLoad, batches, loading, error, create, update, remove }: Props) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<MakeupBatch | null>(null);

  const canSave = entries.length > 0;

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
    if (!trimmed) return setMessage("작업 세트 이름을 입력해 주세요.");
    await run(
      () => create(trimmed, entries, baseDate),
      () => {
        setName("");
        setNaming(false);
      },
    );
  };

  const submitRename = async () => {
    if (!renaming) return;
    const trimmed = name.trim();
    if (!trimmed) return setMessage("작업 세트 이름을 입력해 주세요.");
    await run(
      () => update(renaming.id, { name: trimmed }),
      () => {
        setName("");
        setRenaming(null);
      },
    );
  };

  return (
    <div className="mb-4 pb-4 border-b border-dashed border-stone-200">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-stone-500 flex items-center gap-1.5">
          <Bookmark className="w-3.5 h-3.5" /> 저장된 작업 세트
        </h3>
        {!naming && !renaming && (
          <button
            onClick={() => {
              setNaming(true);
              setMessage(null);
            }}
            disabled={!canSave}
            title={canSave ? "지금 담긴 내역을 작업 세트로 저장합니다" : "먼저 교체·보강을 한 건 이상 담아야 저장할 수 있습니다"}
            className="inline-flex items-center gap-1 text-xs font-semibold text-swap hover:opacity-80 disabled:text-stone-300 transition-colors"
          >
            <BookmarkPlus className="w-3.5 h-3.5" /> 지금 내역 저장
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
            maxLength={40}
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
            placeholder={renaming ? "새 이름" : `이름 (예: 수학여행 3학년 대강) · ${entries.length}건`}
            className="flex-1 min-w-0 border border-stone-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-swap"
          />
          <button
            onClick={() => void (renaming ? submitRename() : submitNew())}
            disabled={busy}
            className="p-1.5 rounded-lg bg-swap hover:opacity-90 text-white disabled:bg-stone-200 transition-opacity"
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
            className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 transition-colors"
            title="취소"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {message && <p className="text-[11px] text-rose-600 mb-2">{message}</p>}
      {error && <p className="text-[11px] text-rose-600 mb-2">{error}</p>}

      {loading ? (
        <p className="text-[11px] text-stone-400">불러오는 중…</p>
      ) : batches.length === 0 ? (
        <p className="text-[11px] text-stone-400 leading-relaxed">
          여러 선생님 몫을 한 번에 손볼 땐, 지금까지 담은 내역을 이름 붙여 저장해 두면 나중에 이어서 고칠 수 있습니다.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {batches.map((batch) => (
            <div
              key={batch.id}
              className="group inline-flex items-center rounded-full border border-stone-200 bg-stone-50 hover:border-swap/40 hover:bg-swap/8 transition-colors"
            >
              <button
                onClick={() => onLoad(batch)}
                title={`불러오기 · 마지막 저장 ${new Date(batch.updatedAt).toLocaleDateString("ko-KR")}`}
                className="pl-2.5 pr-1.5 py-1 text-xs font-semibold text-stone-700 group-hover:text-swap"
              >
                {batch.name}
                <span className="ml-1 font-normal text-stone-400">{batch.entries.length}</span>
              </button>

              {/* 지금 내역으로 덮어쓰기 — 이어서 고친 뒤 저장할 때, 지우고 다시 만들지 않아도 되게 */}
              <button
                onClick={() => void run(() => update(batch.id, { entries, baseDate }))}
                disabled={!canSave || busy}
                title="지금 담긴 내역으로 이 작업 세트를 덮어씁니다"
                className={cn("px-1 py-1 text-stone-300 hover:text-swap disabled:hover:text-stone-300 disabled:opacity-40")}
              >
                <BookmarkPlus className="w-3 h-3" />
              </button>
              <button
                onClick={() => {
                  setRenaming(batch);
                  setNaming(false);
                  setName(batch.name);
                  setMessage(null);
                }}
                title="이름 바꾸기"
                className="px-1 py-1 text-stone-300 hover:text-stone-600"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={() => {
                  if (!window.confirm(`"${batch.name}" 작업 세트를 지울까요?`)) return;
                  void run(() => remove(batch.id));
                }}
                title="지우기"
                className={cn("pr-2 pl-1 py-1 text-stone-300 hover:text-rose-600")}
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
