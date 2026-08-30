"use client";

import { useState } from "react";
import { ArrowLeft, History, Loader2, Plus } from "lucide-react";
import TrainingProgressCard from "./TrainingProgressCard";
import CertificateDetail from "./CertificateDetail";
import TrainingEditorPanel from "./TrainingEditorPanel";
import SubmitTab from "./SubmitTab";
import HistoryTab from "./HistoryTab";
import { useTrainingTitles } from "./useTrainingTitles";
import type { OverviewItem } from "./useCertificateOverview";

type View = { kind: "board" } | { kind: "submit"; title: string } | { kind: "history" } | { kind: "edit"; id: string };

// 이수증 수거 탭 — 연수 카드 목록 + 선택한 연수의 상세.
// 예전 "제출하기 / 내역조회 / 일괄확인 / 연수목록 관리" 네 탭이 하던 일이 여기로 모입니다.
export default function CertificateBoard({
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
  const [view, setView] = useState<View>({ kind: "board" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { deleteTitle, reloadTitles } = useTrainingTitles();

  const selected = items.find((i) => i.id === selectedId) ?? items[0] ?? null;

  const backToBoard = () => setView({ kind: "board" });

  const handleDelete = async (item: OverviewItem) => {
    if (!window.confirm(`"${item.title}" 연수를 삭제할까요? 이미 제출된 이수증에는 영향이 없습니다.`)) return;
    const result = await deleteTitle(item.id);
    if (result.ok) {
      setSelectedId(null);
      onRefresh();
    }
  };

  if (view.kind === "submit" || view.kind === "history") {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={backToBoard}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-stone-500 hover:text-cert transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> 연수 현황으로 돌아가기
        </button>
        {view.kind === "submit" ? (
          <SubmitTab initialTitle={view.title} onSubmitted={onRefresh} />
        ) : (
          <HistoryTab isAdmin={isAdmin} />
        )}
      </div>
    );
  }

  if (view.kind === "edit") {
    return (
      <TrainingEditorPanel
        category="certificate"
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

  // SignBoard.tsx와 같은 이유로 minmax 바닥을 둡니다 — 자세한 설명은 그쪽 주석 참고.
  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(220px,1fr)_minmax(0,3fr)] gap-5 items-start">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <span className="text-[11px] font-bold tracking-wider text-stone-400 uppercase">
            이수증 연수 {items.length}개
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setView({ kind: "history" })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 hover:bg-stone-50 text-stone-600 text-xs font-bold rounded-lg transition-colors"
            >
              <History className="w-3.5 h-3.5" /> 내 제출 내역
            </button>
            <button
              type="button"
              onClick={() => setView({ kind: "edit", id: "new" })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cert hover:opacity-90 text-white text-xs font-bold rounded-lg transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" /> 새 연수
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12 text-cert">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-[10px] border border-stone-200 p-8 text-center text-sm text-stone-400">
            등록된 이수증 연수가 없습니다. &quot;새 연수&quot;로 시작하세요.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {items.map((item) => (
              <TrainingProgressCard
                key={item.id}
                item={item}
                selected={selected?.id === item.id}
                onSelect={() => setSelectedId(item.id)}
                onAction={() => setView({ kind: "submit", title: item.title })}
              />
            ))}
          </div>
        )}
      </div>

      {selected ? (
        <CertificateDetail
          key={selected.id}
          item={selected}
          onEdit={() => setView({ kind: "edit", id: selected.id })}
          onDelete={() => handleDelete(selected)}
          onRefresh={onRefresh}
        />
      ) : (
        !loading && (
          <div className="bg-white rounded-[14px] border border-stone-200 p-10 text-center text-sm text-stone-400">
            왼쪽에서 연수를 선택하세요.
          </div>
        )
      )}
    </div>
  );
}
