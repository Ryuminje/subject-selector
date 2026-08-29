"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Layers, Loader2, Plus } from "lucide-react";
import TrainingProgressCard from "./TrainingProgressCard";
import SignDetail from "./SignDetail";
import TrainingEditorPanel from "./TrainingEditorPanel";
import SignTab from "./SignTab";
import { useSignSession } from "./useSignSession";
import { useTrainingTitles } from "./useTrainingTitles";
import type { OverviewItem } from "./useCertificateOverview";

type View = { kind: "board" } | { kind: "group" } | { kind: "edit"; id: string };

// QR 서명 탭 — 이수증 탭과 같은 카드/진행률 언어를 쓰고, 수집 도구만 QR 세션입니다.
// 여러 연수를 한 번의 서명으로 처리하는 "복수 연수 세션"은 별도 화면으로 남겨둡니다.
export default function SignBoard({
  isAdmin,
  items,
  loading,
  onRefresh,
}: {
  isAdmin: boolean;
  items: OverviewItem[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>({ kind: "board" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { creating, error, createSession } = useSignSession();
  const { deleteTitle, reloadTitles } = useTrainingTitles();

  const selected = items.find((i) => i.id === selectedId) ?? items[0] ?? null;
  const backToBoard = () => setView({ kind: "board" });

  const handleOpenSession = async (item: OverviewItem) => {
    const sessionId = await createSession([item.title]);
    if (sessionId) router.push(`/apps/schedule-helper/certificates/sessions/${sessionId}`);
  };

  const handleDelete = async (item: OverviewItem) => {
    if (!window.confirm(`"${item.title}" 연수를 삭제할까요? 이미 받은 서명에는 영향이 없습니다.`)) return;
    const result = await deleteTitle(item.id);
    if (result.ok) {
      setSelectedId(null);
      onRefresh();
    }
  };

  if (view.kind === "group") {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={backToBoard}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-teal-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> 연수 현황으로 돌아가기
        </button>
        <SignTab />
      </div>
    );
  }

  if (view.kind === "edit") {
    return (
      <TrainingEditorPanel
        category="sign"
        editingId={view.id}
        onClose={backToBoard}
        onSaved={() => {
          backToBoard();
          reloadTitles();
          onRefresh();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {/* 목록 칸이 화면 폭에 비례해서만 줄어들면 카드 안 글자가 감당 못 할 만큼 좁아져 한 글자씩
          세로로 쪼개지는 문제가 있었습니다(minmax 없이 1fr이면 바닥이 없음). 220px 밑으로는 안
          줄어들게 못 박아 두고, 그보다 넓을 땐 1:3 비율 그대로 갑니다. */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(220px,1fr)_minmax(0,3fr)] gap-5 items-start">
        <div>
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              서명 연수 {items.length}개
            </span>
            <div className="flex gap-2">
              {/* QR 세션 생성은 서버에서도 관리자 전용 */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setView({ kind: "group" })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-lg transition-colors"
                >
                  <Layers className="w-3.5 h-3.5" /> 복수 연수 세션
                </button>
              )}
              {/* 연수 등록 자체는 기존과 동일하게 로그인한 선생님 누구나 가능 */}
              <button
                type="button"
                onClick={() => setView({ kind: "edit", id: "new" })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> 새 연수
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12 text-teal-600">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-400">
              등록된 서명 연수가 없습니다. &quot;새 연수&quot;로 시작하세요.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {items.map((item) => (
                <TrainingProgressCard
                  key={item.id}
                  item={item}
                  selected={selected?.id === item.id}
                  onSelect={() => setSelectedId(item.id)}
                  onAction={
                    item.session && !item.session.locked
                      ? () => router.push(`/apps/schedule-helper/certificates/sessions/${item.session!.id}`)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>

        {selected ? (
          <SignDetail
            item={selected}
            creating={creating}
            onOpenSession={() => handleOpenSession(selected)}
            onEdit={() => setView({ kind: "edit", id: selected.id })}
            onDelete={() => handleDelete(selected)}
          />
        ) : (
          !loading && (
            <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center text-sm text-slate-400">
              왼쪽에서 연수를 선택하세요.
            </div>
          )
        )}
      </div>
    </div>
  );
}
