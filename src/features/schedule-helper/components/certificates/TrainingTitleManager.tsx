"use client";

import { useState } from "react";
import { ListChecks, Loader2, Plus, Pencil, Trash2, UserCheck } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { useTrainingTitles, type TrainingTitleItem } from "./useTrainingTitles";
import { useRosterPresets } from "./useRosterPresets";
import RosterTable from "./RosterTable";

export default function TrainingTitleManager({ isAdmin }: { isAdmin: boolean }) {
  const { data: session } = useSession();
  const { titles, loadingTitles, createTitle, updateTitle, deleteTitle } = useTrainingTitles();
  const { presets, fetchBaseRoster } = useRosterPresets();

  const [selectedId, setSelectedId] = useState<string | null>(null); // "new"이면 새 연수 등록 중
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editNames, setEditNames] = useState<string[]>([]);
  const [addName, setAddName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingBase, setLoadingBase] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myName = session?.user?.name;
  const canEdit = (t: TrainingTitleItem) => isAdmin || t.registeredByName === myName;

  const selectedTitle = titles?.find((t) => t.id === selectedId) ?? null;

  const openPreview = (t: TrainingTitleItem) => {
    setSelectedId(t.id);
    setEditMode(false);
    setError(null);
  };

  const startEdit = async (t: TrainingTitleItem) => {
    setSelectedId(t.id);
    setEditTitle(t.title);
    setEditMode(true);
    setError(null);
    if (t.rosterSnapshot) {
      setEditNames(t.rosterSnapshot);
      return;
    }
    setLoadingBase(true);
    const result = await fetchBaseRoster();
    setLoadingBase(false);
    setEditNames(result.ok ? result.names : []);
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
    setEditTitle("");
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

  const handleLoadPreset = (presetId: string) => {
    const preset = presets?.find((p) => p.id === presetId);
    if (preset) setEditNames(preset.names);
  };

  const handleSave = async () => {
    if (!editTitle.trim()) {
      setError("연수 제목을 입력해 주세요.");
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
        ? await createTitle(editTitle.trim(), editNames)
        : await updateTitle(selectedId as string, { title: editTitle.trim(), names: editNames });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSelectedId(result.trainingTitle.id);
    setEditMode(false);
  };

  const handleResetToDefault = async () => {
    if (!selectedId || selectedId === "new") return;
    setSaving(true);
    setError(null);
    const result = await updateTitle(selectedId, { names: [] });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditMode(false);
  };

  const handleCancelEdit = () => {
    if (selectedId === "new") setSelectedId(null);
    setEditMode(false);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("이 연수를 삭제할까요? 제출된 이수증에는 영향이 없습니다.")) return;
    const result = await deleteTitle(id);
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
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-teal-700 flex items-center gap-2">
            <ListChecks className="w-5 h-5" /> 연수목록 관리
          </h2>
          <button
            onClick={startCreate}
            disabled={loadingBase}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors"
          >
            {loadingBase ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} 새 연수 등록
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          연수 제목과 참여명단을 함께 등록하세요. 연수마다 서로 다른 명단을 지정할 수 있고, 지정하지 않으면 전체
          기본 명단이 적용됩니다.
        </p>

        {loadingTitles ? (
          <div className="flex justify-center py-8 text-teal-600">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : !titles?.length ? (
          <p className="text-sm text-slate-400 text-center py-6">등록된 연수가 없습니다. &quot;새 연수 등록&quot;으로 시작하세요.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {titles.map((t) => (
              <button
                key={t.id}
                onClick={() => (selectedId === t.id && !editMode ? setSelectedId(null) : openPreview(t))}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  selectedId === t.id
                    ? "bg-teal-600 border-teal-600 text-white"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:border-teal-300"
                }`}
              >
                {t.title}
                <span className="opacity-70">
                  · {t.rosterSnapshot ? `${t.rosterSnapshot.length}명` : "기본 명단"}
                </span>
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}

        {selectedId && (selectedTitle || selectedId === "new") && (
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 mt-4">
            {editMode ? (
              <div className="mb-3 space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="연수 제목"
                    className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                  />
                  {presets && presets.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) handleLoadPreset(e.target.value);
                        e.target.value = "";
                      }}
                      defaultValue=""
                      className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 shrink-0"
                    >
                      <option value="" disabled>
                        프리셋에서 불러오기
                      </option>
                      {presets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.names.length}명
                        </option>
                      ))}
                    </select>
                  )}
                </div>
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
              selectedTitle && (
                <div className="flex items-center justify-between mb-3">
                  <div className="font-bold text-slate-800">
                    {selectedTitle.title}{" "}
                    <span className="text-sm font-normal text-slate-500 inline-flex items-center gap-1">
                      · <UserCheck className="w-3.5 h-3.5" /> {selectedTitle.registeredByName} ·{" "}
                      {selectedTitle.rosterSnapshot ? `${selectedTitle.rosterSnapshot.length}명` : "전체 기본 명단"}
                    </span>
                  </div>
                  {canEdit(selectedTitle) && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(selectedTitle)}
                        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" /> 편집
                      </button>
                      <button
                        onClick={() => handleDelete(selectedTitle.id)}
                        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-rose-200 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> 삭제
                      </button>
                    </div>
                  )}
                </div>
              )
            )}

            <RosterTable
              names={editMode ? editNames : selectedTitle?.rosterSnapshot ?? []}
              mode={editMode ? "edit" : "preview"}
              onReorder={editMode ? setEditNames : undefined}
              onRemove={editMode ? handleRemove : undefined}
            />

            {editMode && (
              <div className="flex flex-wrap justify-end gap-2 mt-3">
                {selectedId !== "new" && (
                  <button
                    onClick={handleResetToDefault}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-60"
                  >
                    전체 기본 명단으로 되돌리기
                  </button>
                )}
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
      </div>
    </div>
  );
}
