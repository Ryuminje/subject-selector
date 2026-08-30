"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import RosterTable from "./RosterTable";
import { useRosterPresets } from "./useRosterPresets";
import { useTrainingTitles, type TrainingTitleCategory } from "./useTrainingTitles";

// 연수 등록/편집 패널. 제목 + 이 연수 전용 참여명단을 함께 다룹니다.
// 명단 프리셋은 이수증/서명 구분 없이 공통이라 여기서 그대로 불러 쓸 수 있습니다.
export default function TrainingEditorPanel({
  category,
  editingId,
  onClose,
  onSaved,
}: {
  category: TrainingTitleCategory;
  /** "new"면 신규 등록, 그 외에는 해당 연수 편집 */
  editingId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { titles, createTitle, updateTitle } = useTrainingTitles();
  const { presets, fetchBaseRoster } = useRosterPresets();

  const isNew = editingId === "new";
  const target = isNew ? null : titles?.find((t) => t.id === editingId) ?? null;

  const [title, setTitle] = useState("");
  const [names, setNames] = useState<string[]>([]);
  const [addName, setAddName] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 편집 대상이 정해지면 초기값을 채웁니다. 전용 명단이 없으면 전체 기본 명단을 시작값으로 씁니다.
  // (setState는 항상 .then()/.finally() 안에서만 — 이펙트 본문에서 직접 호출 금지)
  useEffect(() => {
    if (!isNew && !titles) return; // 목록 로딩 대기
    let alive = true;
    const snapshot = target?.rosterSnapshot ?? null;
    const load = snapshot
      ? Promise.resolve({ ok: true as const, names: snapshot })
      : fetchBaseRoster();
    load
      .then((result) => {
        if (!alive) return;
        setTitle(target?.title ?? "");
        setNames(result.ok ? result.names : []);
        if (!result.ok) setError(result.error);
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [isNew, titles, target, fetchBaseRoster]);

  const handleAddName = () => {
    const trimmed = addName.trim();
    if (!trimmed || names.includes(trimmed)) {
      setAddName("");
      return;
    }
    setNames((prev) => [...prev, trimmed]);
    setAddName("");
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError("연수 제목을 입력해 주세요.");
      return;
    }
    if (names.length === 0) {
      setError("최소 한 명 이상 포함해야 합니다.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = isNew
      ? await createTitle(title.trim(), names, category)
      : await updateTitle(editingId, { title: title.trim(), names });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved();
  };

  return (
    <div className="bg-white rounded-[14px] border border-stone-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg text-cert">
          {isNew ? (category === "sign" ? "새 서명 연수 등록" : "새 이수증 연수 등록") : "연수 편집"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
          aria-label="닫기"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {!ready ? (
        <div className="flex justify-center py-10 text-cert">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-bold text-stone-700 mb-1.5 block">연수 제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예) 2026 청렴교육"
              className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-cert/30 focus:border-cert"
            />
          </div>

          {presets && presets.length > 0 && (
            <div>
              <div className="text-xs font-bold text-stone-500 mb-1.5">명단 프리셋에서 불러오기 (이수증·서명 공통)</div>
              <div className="flex flex-wrap gap-2">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setNames(p.names)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-cert/8 border border-cert/20 text-cert hover:bg-cert/15 hover:border-cert/30 transition-colors"
                  >
                    {p.name} <span className="opacity-70">· {p.names.length}명</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-bold text-stone-700 mb-1.5 block">참여 명단 ({names.length}명)</label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddName()}
                placeholder="추가할 이름"
                className="flex-1 px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-cert/30 focus:border-cert"
              />
              <button
                type="button"
                onClick={handleAddName}
                className="px-4 py-2.5 bg-cert hover:opacity-90 text-white text-sm font-bold rounded-[10px] transition-opacity shrink-0"
              >
                추가
              </button>
            </div>
            <RosterTable
              names={names}
              mode="edit"
              onReorder={setNames}
              onRemove={(index) => setNames((prev) => prev.filter((_, i) => i !== index))}
            />
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-stone-500 hover:bg-stone-100 rounded-[10px] transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-cert hover:opacity-90 disabled:opacity-60 text-white text-sm font-bold rounded-[10px] transition-opacity"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} 저장
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
