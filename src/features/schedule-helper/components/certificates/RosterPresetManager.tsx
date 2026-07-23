"use client";

import { useState } from "react";
import { ListChecks, Loader2, Plus, Pencil, Trash2, UserCheck } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import type { RosterPreset, useRosterPresets } from "./useRosterPresets";
import RosterTable from "./RosterTable";

type UseRosterPresetsReturn = ReturnType<typeof useRosterPresets>;

export default function RosterPresetManager({
  isAdmin,
  presets,
  loadingPresets,
  createPreset,
  updatePreset,
  deletePreset,
  fetchBaseRoster,
}: { isAdmin: boolean } & Pick<
  UseRosterPresetsReturn,
  "presets" | "loadingPresets" | "createPreset" | "updatePreset" | "deletePreset" | "fetchBaseRoster"
>) {
  const { data: session } = useSession();
  const myName = session?.user?.name;
  const canEdit = (p: RosterPreset) => isAdmin || p.createdBy === myName;
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null); // "new"이면 생성 중
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editNames, setEditNames] = useState<string[]>([]);
  const [addName, setAddName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingBase, setLoadingBase] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPreset = presets?.find((p) => p.id === selectedId) ?? null;

  const openPreview = (preset: RosterPreset) => {
    setSelectedId(preset.id);
    setEditMode(false);
    setError(null);
  };

  const startEdit = (preset: RosterPreset) => {
    setSelectedId(preset.id);
    setEditName(preset.name);
    setEditNames(preset.names);
    setEditMode(true);
    setError(null);
  };

  const startCreate = async () => {
    setLoadingBase(true);
    setError(null);
    const result = await fetchBaseRoster();
    setLoadingBase(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSelectedId("new");
    setEditName("");
    setEditNames(result.names);
    setEditMode(true);
  };

  const handleAddName = () => {
    const trimmed = addName.trim();
    if (!trimmed || editNames.includes(trimmed)) {
      setAddName("");
      return;
    }
    setEditNames((prev) => [...prev, trimmed]);
    setAddName("");
  };

  const handleRemove = (index: number) => {
    setEditNames((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      setError("명단 이름을 입력해 주세요.");
      return;
    }
    if (editNames.length === 0) {
      setError("최소 한 명 이상 포함해야 합니다.");
      return;
    }
    setSaving(true);
    setError(null);
    const result =
      selectedId === "new"
        ? await createPreset(editName.trim(), editNames)
        : await updatePreset(selectedId as string, { name: editName.trim(), names: editNames });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSelectedId(result.preset.id);
    setEditMode(false);
  };

  const handleCancelEdit = () => {
    if (selectedId === "new") setSelectedId(null);
    setEditMode(false);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("이 명단을 삭제할까요? 이미 생성된 서명 세션에는 영향이 없습니다.")) return;
    const result = await deletePreset(id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (selectedId === id) {
      setSelectedId(null);
      setEditMode(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-teal-700 flex items-center gap-2">
          <ListChecks className="w-5 h-5" /> 명단 프리셋 관리
        </h2>
        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            관리하기
          </button>
        )}
      </div>
      <p className="text-sm text-slate-500 mt-1 mb-4">
        용도별로 명단을 저장해두고 재사용하세요. 표에서 드래그로 순서를 바꿀 수 있고, 아래 &quot;QR 서명 세션
        만들기&quot;에서 저장된 명단을 선택해 세션을 만들 수 있습니다.
      </p>

      {expanded && (
        <div>
          {loadingPresets ? (
            <div className="flex justify-center py-8 text-teal-600">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                {presets?.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => (selectedId === p.id && !editMode ? setSelectedId(null) : openPreview(p))}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      selectedId === p.id
                        ? "bg-teal-600 border-teal-600 text-white"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:border-teal-300"
                    }`}
                  >
                    {p.name} <span className="opacity-70">· {p.names.length}명</span>
                  </button>
                ))}
                <button
                  onClick={startCreate}
                  disabled={loadingBase}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 border-dashed border-slate-300 text-slate-500 hover:border-teal-300 hover:text-teal-700 transition-colors disabled:opacity-60"
                >
                  {loadingBase ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} 새
                  명단 만들기
                </button>
              </div>

              {error && <p className="text-sm text-rose-600 mb-3">{error}</p>}

              {!presets?.length && !selectedId && (
                <p className="text-sm text-slate-400 text-center py-6">저장된 명단이 없습니다. &quot;새 명단 만들기&quot;로 시작하세요.</p>
              )}

              {selectedId && (selectedPreset || selectedId === "new") && (
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
                  {editMode ? (
                    <div className="mb-3 flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="명단 이름 (예: 전체 교직원)"
                        className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={addName}
                          onChange={(e) => setAddName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddName()}
                          placeholder="추가할 이름"
                          className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                        />
                        <button
                          onClick={handleAddName}
                          className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold rounded-xl transition-colors shrink-0"
                        >
                          추가
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-bold text-slate-800">
                        {selectedPreset?.name}{" "}
                        <span className="text-sm font-normal text-slate-500 inline-flex items-center gap-1">
                          · <UserCheck className="w-3.5 h-3.5" /> {selectedPreset?.createdBy} ·{" "}
                          {selectedPreset?.names.length}명
                        </span>
                      </div>
                      {selectedPreset && canEdit(selectedPreset) && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(selectedPreset)}
                            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" /> 편집
                          </button>
                          <button
                            onClick={() => handleDelete(selectedPreset.id)}
                            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-rose-200 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> 삭제
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <RosterTable
                    names={editMode ? editNames : selectedPreset?.names ?? []}
                    mode={editMode ? "edit" : "preview"}
                    onReorder={editMode ? setEditNames : undefined}
                    onRemove={editMode ? handleRemove : undefined}
                  />

                  {editMode && (
                    <div className="flex justify-end gap-2 mt-3">
                      <button
                        onClick={handleCancelEdit}
                        className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                      >
                        취소
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors"
                      >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />} 저장
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
