"use client";

// 「기초자료」 탭 — 수요조사·본조사·선택과목 변경이 같이 쓰는 자료를 한 번만 입력하는 곳.
//   1단계 교육과정 편성표(학년별) · 2단계 과목 위계 · 3단계 진급 학번 명단.
// 값은 YearDataContext(공유 저장소)에 들어가고, 다른 탭들은 여기서 받아 씁니다.

import React, { useEffect, useRef, useState } from "react";
import { FolderOpen, GitBranch, GraduationCap, Save, Settings } from "lucide-react";
import { useMainCurriculum } from "../../features/main-survey/hooks/useMainCurriculum";
import { CurriculumStep } from "../../features/demand-survey/components/CurriculumStep";
import { HierarchyStep } from "../../features/demand-survey/components/HierarchyStep";
import { ExampleModal } from "../../features/demand-survey/components/ExampleModal";
import { StudentRosterStep } from "../../features/year-data/components/StudentRosterStep";
import { WorkYearSetting, cohortLabels } from "../../features/year-data/components/WorkYearSetting";
import { useYearData } from "../../features/year-data/YearDataContext";
import { mergeRoster, sanitizeRoster } from "../../features/year-data/lib/roster";
import { sanitizeCohorts } from "../../features/year-data/lib/cohortCurriculum";
import { hasLegacyRoundKeys, migrateRoundKeys, sanitizeCohortStore } from "../../features/year-data/lib/cohortStore";
import type { HierarchyRule } from "../../types";
import type { PromotionEntry } from "../../features/main-survey/lib/promotion";
import type { GradeKey } from "../../types";
import { GuideLink } from "@/features/guide/components/GuideLink";

type BaseTab = "curriculum" | "hierarchy" | "promotion";

const STEPS: { id: BaseTab; no: string; label: string; icon: React.ReactNode }[] = [
  { id: "curriculum", no: "1단계", label: "교육과정 편성표 입력", icon: <Settings className="w-4 h-4" /> },
  { id: "hierarchy", no: "2단계", label: "과목 위계 설정", icon: <GitBranch className="w-4 h-4" /> },
  { id: "promotion", no: "3단계", label: "학생 명단", icon: <GraduationCap className="w-4 h-4" /> },
];

type Win = Window & {
  getDemandBackup?: () => unknown;
  getMainBackup?: () => unknown;
  getChangeBackup?: () => unknown;
  getTimeAllocBackup?: () => unknown;
  getBaseBackup?: () => unknown;
  loadDemandBackup?: (p: unknown) => void;
  loadMainBackup?: (p: unknown) => void;
  loadChangeBackup?: (p: unknown) => void;
  loadTimeAllocBackup?: (p: unknown) => void;
  loadBaseBackup?: (p: unknown) => void;
};

export function BaseDataTab() {
  const [activeTab, setActiveTab] = useState<BaseTab>("curriculum");
  const [activeGrade, setActiveGrade] = useState<GradeKey>("grade1");
  const [isExampleModalOpen, setIsExampleModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { workYear, setWorkYear, roster, setRoster, cohorts, setCohorts, hierarchy, setHierarchy, demandResults, setDemandResults, cohortStore, setCohortStore } = useYearData();

  const {
    parsedCurriculumList,
    subjectMap,
    isCurriculumParsed,
    hierarchyRules, setHierarchyRules,
    editingDetailedCategory, setEditingDetailedCategory,
    detailedCategoryEditValue, setDetailedCategoryEditValue,
    handleCurriculumUpload,
    handleDetailedCategoryUpdate,
  } = useMainCurriculum(activeGrade);

  // 저장하기·불러오기 번들(다른 탭들과 같은 파일)에 기초자료의 작업 학년도·학생 명단이 같이 들어가게 합니다.
  useEffect(() => {
    const w = window as Win;
    w.getBaseBackup = () => ({ workYear, roster, cohorts, hierarchy, demandResults, cohortStore });
    w.loadBaseBackup = (p) => {
      const b = (p ?? {}) as { workYear?: number; roster?: unknown; promotionEntries?: PromotionEntry[]; cohorts?: unknown; hierarchy?: HierarchyRule[]; demandResults?: unknown; cohortStore?: unknown };
      // 저장 파일의 작업 학년도 — 옛 형식(입학년도만 키로 쓴) 자료를 어느 학년 회차로 옮길지 정하는 기준
      let fileWy = typeof b.workYear === "number" && b.workYear > 2000 ? b.workYear : workYear;
      // 옛 형식(입학년도만 키로 쓴) 파일은 자료를 어느 학년도에 입력했는지 파일에 없다. 저장 당시 작업 학년도와 다를 수 있어(예: 올려 본 뒤 저장) 직접 확인한다.
      if (hasLegacyRoundKeys(b.cohortStore, b.demandResults)) {
        const ans = Number(window.prompt(`옛 형식의 저장 파일입니다. 이 자료를 입력한 작업 학년도(수강신청을 받은 해)를 적어 주세요.\n(파일에 적힌 작업 학년도: ${fileWy})`, String(fileWy)));
        if (Number.isFinite(ans) && ans > 2000 && ans < 2100) fileWy = Math.round(ans);
        b.workYear = fileWy; // 자료가 있는 해로 화면을 맞춘다
      }
      // 각 탭의 학년 자리별 데이터(수강신청 회차 기준 저장소). 없는 옛 파일은 각 탭 백업의 학년별 값이 이미 채워 둔 상태를 그대로 둔다.
      if (b.cohortStore && typeof b.cohortStore === "object") setCohortStore(sanitizeCohortStore(b.cohortStore, fileWy));
      // 본조사로 가져온 수요조사 결과(없는 옛 파일은 그대로 둔다)
      if (b.demandResults && typeof b.demandResults === "object") setDemandResults(migrateRoundKeys(b.demandResults as typeof demandResults, fileWy));
      // 입학년도 편성표·공통 위계(새 형식). 없는 옛 파일은 각 탭 백업의 학년별 값이 이미 채워 둔 상태를 그대로 둔다.
      if (b.cohorts && typeof b.cohorts === "object") setCohorts(sanitizeCohorts(b.cohorts));
      if (Array.isArray(b.hierarchy)) setHierarchy(b.hierarchy);
      const wy = fileWy;
      if (typeof b.workYear === "number" && b.workYear > 2000) setWorkYear(b.workYear);
      if (Array.isArray(b.roster)) setRoster(sanitizeRoster(b.roster));
      else if (Array.isArray(b.promotionEntries)) {
        // 명단 기능 이전에 저장한 진급 명단(이전학번·이름·진급학번)을 명단으로 옮겨 담습니다.
        setRoster(mergeRoster([], b.promotionEntries.map((e) => ({ oldId: e.oldId, newId: e.newId, name: e.name })), wy).roster);
      }
    };
    return () => {
      delete w.getBaseBackup;
      delete w.loadBaseBackup;
    };
  }, [workYear, roster, cohorts, hierarchy, demandResults, cohortStore, setWorkYear, setRoster, setCohorts, setHierarchy, setDemandResults, setCohortStore]);

  // 단계 컴포넌트의 "다음 단계" 버튼이 옛 탭 id("upload")를 넘기면 이 탭의 마지막 단계로 보냅니다.
  const goTo = (tab: string) => setActiveTab(tab === "upload" ? "promotion" : (tab as BaseTab));

  const handleSaveBackup = async () => {
    const w = window as Win;
    const fullBackup = {
      version: 3,
      demand: w.getDemandBackup?.() || {},
      main: w.getMainBackup?.() || {},
      change: w.getChangeBackup?.() || {},
      timeAlloc: w.getTimeAllocBackup?.() || {},
      base: w.getBaseBackup?.() || {},
    };
    const jsonString = JSON.stringify(fullBackup, null, 2);
    const suggestedName = "2026학년도 수강신청 도우미.json";

    // 저장 위치를 직접 고르게 showSaveFilePicker를 먼저 시도하고, 안 되는 환경에서는 일반 다운로드로 대체합니다
    // (실패한 저장이 빈 파일을 남기는 걸 막기 위함 — 다른 탭들과 같은 방식).
    let savedViaPicker = false;
    if ("showSaveFilePicker" in window) {
      try {
        const showSaveFilePicker = (
          window as unknown as {
            showSaveFilePicker: (opts: unknown) => Promise<{
              createWritable: () => Promise<{ write: (s: string) => Promise<void>; close: () => Promise<void> }>;
            }>;
          }
        ).showSaveFilePicker;
        const handle = await showSaveFilePicker({
          suggestedName,
          types: [{ description: "JSON 파일", accept: { "application/json": [".json"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(jsonString);
        await writable.close();
        savedViaPicker = true;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.warn("showSaveFilePicker 저장 실패, 다운로드로 대체합니다:", err);
      }
    }
    if (!savedViaPicker) {
      try {
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = suggestedName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Failed to save file:", err);
        window.alert("파일 저장 중 오류가 발생했습니다.");
      }
    }
  };

  const handleLoadBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        const w = window as Win;
        if (parsed.version >= 2) {
          w.loadDemandBackup?.(parsed.demand || {});
          w.loadMainBackup?.(parsed.main || {});
          w.loadChangeBackup?.(parsed.change || {});
          w.loadTimeAllocBackup?.(parsed.timeAlloc || {});
          w.loadBaseBackup?.(parsed.base || {});
        } else {
          w.loadDemandBackup?.(parsed);
          w.loadMainBackup?.(parsed);
          w.loadChangeBackup?.(parsed);
        }
        window.alert("작업 내역을 성공적으로 불러왔습니다.");
      } catch {
        window.alert("올바르지 않은 백업 파일입니다.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      <header className="flex-none px-10 py-5 border-b border-stone-200 bg-white/60 backdrop-blur-sm flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap w-full">
          <h1 className="text-2xl font-extrabold tracking-tight text-stone-900 break-keep">명신고등학교 기초자료 입력</h1>
          <div className="flex flex-wrap gap-2 min-w-0 sm:shrink-0">
            <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleLoadBackup} />
            <GuideLink
              slug="enrollment"
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-stone-50 text-stone-700 text-sm font-medium rounded-xl transition-all border border-stone-300 shadow-sm whitespace-nowrap"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-medium rounded-xl transition-all border border-stone-300 shadow-sm"
            >
              <FolderOpen className="w-4 h-4" />
              불러오기
            </button>
            <button
              onClick={handleSaveBackup}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-xl transition-all border border-amber-500/50 shadow-md shadow-amber-500/20"
            >
              <Save className="w-4 h-4" />
              저장하기
            </button>
          </div>
        </div>

        <div className="w-full">
          <div className="flex gap-2 p-1 bg-stone-100/80 backdrop-blur-md rounded-2xl border border-stone-200 w-fit overflow-x-auto max-w-[calc(100vw-120px)] scrollbar-hide">
            {STEPS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveTab(s.id)}
                className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 whitespace-nowrap shrink-0 ${
                  activeTab === s.id ? "bg-white text-stone-900 shadow-md border border-stone-200" : "text-stone-500 hover:text-stone-800 hover:bg-white/70"
                }`}
              >
                <span className="text-[10px] tracking-wider font-semibold opacity-50">{s.no}</span>
                <div className="flex items-center gap-1.5">
                  {s.icon}
                  <span>{s.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="w-full mx-auto">
          <div className="bg-white/70 backdrop-blur-xl border border-stone-200 rounded-3xl p-8 shadow-xl">
            {activeTab === "curriculum" && (
              <CurriculumStep
                activeGrade={activeGrade}
                setActiveGrade={setActiveGrade}
                setIsExampleModalOpen={setIsExampleModalOpen}
                handleCurriculumUpload={handleCurriculumUpload}
                isCurriculumParsed={isCurriculumParsed}
                parsedCurriculumList={parsedCurriculumList}
                editingDetailedCategory={editingDetailedCategory}
                setEditingDetailedCategory={setEditingDetailedCategory}
                detailedCategoryEditValue={detailedCategoryEditValue}
                setDetailedCategoryEditValue={setDetailedCategoryEditValue}
                handleDetailedCategoryUpdate={handleDetailedCategoryUpdate}
                setActiveTab={goTo}
                gradeLabels={cohortLabels(workYear)}
                afterTitle={<WorkYearSetting />}
              />
            )}
            {activeTab === "hierarchy" && (
              <HierarchyStep
                activeGrade={activeGrade}
                setActiveGrade={setActiveGrade}
                isCurriculumParsed={isCurriculumParsed}
                subjectMap={subjectMap}
                hierarchyRules={hierarchyRules}
                setHierarchyRules={setHierarchyRules}
                setActiveTab={goTo}
                gradeLabels={cohortLabels(workYear)}
              />
            )}
            {activeTab === "promotion" && <StudentRosterStep />}
          </div>
        </div>
      </div>
      <ExampleModal isOpen={isExampleModalOpen} onClose={() => setIsExampleModalOpen(false)} />
    </>
  );
}
