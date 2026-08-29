"use client";

import { useState } from "react";
import { FileSpreadsheet, ListChecks, Loader2, Plus, Pencil, Trash2, UserCheck } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import type { RosterPreset, useRosterPresets } from "./useRosterPresets";
import RosterTable from "./RosterTable";
import RosterExcelImport from "./RosterExcelImport";

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
  const [selectedId, setSelectedId] = useState<string | null>(null); // "new"이면 생성 중
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editNames, setEditNames] = useState<string[]>([]);
  const [addName, setAddName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingBase, setLoadingBase] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 엑셀 가져오기 패널: "create"면 새 명단 초안, "append"면 편집 중인 명단에 이어 붙이기, null이면 닫힘
  const [importMode, setImportMode] = useState<"create" | "append" | null>(null);

  const selectedPreset = presets?.find((p) => p.id === selectedId) ?? null;

  // 공통(관리자가 만듦, 모두에게 보임)과 개인(직접 만듦, 나에게만 보임)을 상하 두 그리드로 나눠 보여줍니다.
  // 개인 명단은 애초에 서버가 본인 것만 내려주므로(roster-presets/route.ts), 여기서 다시 걸러낼 필요는 없습니다.
  const sharedPresets = presets?.filter((p) => p.isShared) ?? [];
  const personalPresets = presets?.filter((p) => !p.isShared) ?? [];

  // 강조색: 공통=인디고, 개인=앰버 — 목록 배지든 프리셋 이름 앞 점이든 이 두 색으로 한눈에 갈립니다.
  const groupTheme = {
    indigo: { dot: "bg-indigo-500", text: "text-indigo-700", badgeBg: "bg-indigo-50", badgeBorder: "border-indigo-200" },
    amber: { dot: "bg-amber-500", text: "text-amber-700", badgeBg: "bg-amber-50", badgeBorder: "border-amber-200" },
  } as const;

  const renderPresetGroup = (
    title: string,
    hint: string,
    color: keyof typeof groupTheme,
    list: RosterPreset[]
  ) => {
    const theme = groupTheme[color];
    return (
      <div className="mb-4">
        <div className="flex items-center gap-1.5 mb-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${theme.dot}`} />
          <span className={`text-xs font-bold ${theme.text}`}>{title}</span>
          <span className="text-xs text-slate-400">· {hint}</span>
        </div>
        {list.length === 0 ? (
          <p className="text-xs text-slate-400 pl-3.5">아직 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {list.map((p) => (
              <button
                key={p.id}
                onClick={() => (selectedId === p.id && !editMode ? setSelectedId(null) : openPreview(p))}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors min-w-0 ${
                  selectedId === p.id
                    ? "bg-teal-600 border-teal-600 text-white"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:border-teal-300"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${theme.dot}`} />
                <span className="truncate">{p.name}</span>
                <span className="opacity-70 shrink-0">· {p.names.length}명</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // 파일 이름을 그대로 명단 이름으로 쓰면 이미 있는 이름과 부딪혀 저장이 거부됩니다("이미 있는 명단 이름입니다").
  // 사용자가 손대기 전에 미리 비켜 두어 그냥 저장만 눌러도 통과하게 합니다.
  const uniquePresetName = (base: string) => {
    const taken = new Set((presets ?? []).map((p) => p.name));
    if (!base || !taken.has(base)) return base;
    for (let i = 2; i <= 99; i += 1) {
      const candidate = `${base} (${i})`;
      if (!taken.has(candidate)) return candidate;
    }
    return base;
  };

  const openPreview = (preset: RosterPreset) => {
    setSelectedId(preset.id);
    setEditMode(false);
    setError(null);
    setImportMode(null);
  };

  const startEdit = (preset: RosterPreset) => {
    setSelectedId(preset.id);
    setEditName(preset.name);
    setEditNames(preset.names);
    setEditMode(true);
    setError(null);
    setImportMode(null);
  };

  const startCreate = async () => {
    setLoadingBase(true);
    setError(null);
    setImportMode(null);
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

  // 엑셀 패널 열기. 새로 만들 때는 진행 중이던 편집을 접고 빈 상태에서 시작합니다.
  const openImport = (mode: "create" | "append") => {
    setError(null);
    if (mode === "create") {
      setSelectedId(null);
      setEditMode(false);
    }
    setImportMode(mode);
  };

  const handleImportConfirm = (names: string[], suggestedName: string) => {
    if (importMode === "append") {
      setEditNames((prev) => [...prev, ...names.filter((n) => !prev.includes(n))]);
    } else {
      // 기본 명단 불러오기(startCreate)와 같은 자리로 들어갑니다. 이름·순서는 저장 전에 얼마든지 고칠 수 있습니다.
      setSelectedId("new");
      setEditName(uniquePresetName(suggestedName));
      setEditNames(names);
      setEditMode(true);
    }
    setImportMode(null);
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
    setImportMode(null);
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
      <h2 className="text-lg font-bold text-teal-700 flex items-center gap-2">
        <ListChecks className="w-5 h-5" /> 명단 프리셋 관리
      </h2>
      <p className="text-sm text-slate-500 mt-1 mb-4">
        용도별로 명단을 저장해두고 재사용하세요. 교직원 명렬표 같은 <strong className="font-semibold">엑셀 파일에서
        바로 만들 수도</strong> 있습니다. 표에서 드래그로 순서를 바꿀 수 있고, 연수를 등록·편집할 때와 복수 연수 QR
        세션을 만들 때 저장된 명단을 그대로 불러올 수 있습니다.{" "}
        <strong className="font-semibold">관리자가 만든 명단은 모두에게 보이고, 직접 만든 명단은 나에게만
        보입니다.</strong>
      </p>

      <div>
        {loadingPresets ? (
          <div className="flex justify-center py-8 text-teal-600">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <>
            {renderPresetGroup("공통 프리셋", "관리자가 만듦 · 모두에게 보임", "indigo", sharedPresets)}
              {renderPresetGroup("개인 프리셋", "직접 만듦 · 나에게만 보임", "amber", personalPresets)}

              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={startCreate}
                  disabled={loadingBase}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 border-dashed border-slate-300 text-slate-500 hover:border-teal-300 hover:text-teal-700 transition-colors disabled:opacity-60"
                >
                  {loadingBase ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} 새
                  명단 만들기
                </button>
                <button
                  onClick={() => openImport("create")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 border-dashed border-teal-300 text-teal-700 hover:bg-teal-50 transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> 엑셀로 만들기
                </button>
              </div>

              {importMode === "create" && (
                <RosterExcelImport mode="create" onConfirm={handleImportConfirm} onCancel={() => setImportMode(null)} />
              )}

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
                        <button
                          onClick={() => (importMode === "append" ? setImportMode(null) : openImport("append"))}
                          title="엑셀 파일에서 이름을 한꺼번에 가져옵니다"
                          className={`px-3 py-2.5 border text-sm font-bold rounded-xl transition-colors shrink-0 inline-flex items-center gap-1.5 ${
                            importMode === "append"
                              ? "bg-teal-100 border-teal-300 text-teal-800"
                              : "bg-white border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-700"
                          }`}
                        >
                          <FileSpreadsheet className="w-4 h-4" /> 엑셀
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                        {selectedPreset && (
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                              groupTheme[selectedPreset.isShared ? "indigo" : "amber"].badgeBg
                            } ${groupTheme[selectedPreset.isShared ? "indigo" : "amber"].badgeBorder} ${
                              groupTheme[selectedPreset.isShared ? "indigo" : "amber"].text
                            }`}
                          >
                            {selectedPreset.isShared ? "공통" : "개인"}
                          </span>
                        )}
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

                  {editMode && importMode === "append" && (
                    <RosterExcelImport
                      mode="append"
                      existingNames={editNames}
                      onConfirm={handleImportConfirm}
                      onCancel={() => setImportMode(null)}
                    />
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
    </div>
  );
}
