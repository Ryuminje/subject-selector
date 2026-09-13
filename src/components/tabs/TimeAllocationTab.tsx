"use client";

// 선택과목 타임(구획) 배정 탭 — enrollment-helper 4번째 사이드바 탭.
// 3단계(데이터 입력 / 타임 배정 / 학생별 결과) + 학년 전환(pre1/grade1/grade2).
// 저장은 기존 탭들의 "저장/불러오기" 번들에 window.getTimeAllocBackup/loadTimeAllocBackup 로 합류.

import React, { useRef } from "react";
import { CalendarClock, FolderOpen, Save } from "lucide-react";
import type { GradeKey } from "../../types";
import { GradeTabs } from "../../features/main-survey/components/GradeTabs";
import { useTimeAllocation } from "../../features/time-allocation/hooks/useTimeAllocation";
import { DataInputStep } from "../../features/time-allocation/components/DataInputStep";
import { AllocationGridStep } from "../../features/time-allocation/components/AllocationGridStep";
import { StudentResultStep } from "../../features/time-allocation/components/StudentResultStep";
import type { MainSurveySnapshot } from "../../features/time-allocation/lib/fromMainSurvey";

const STEPS = [
  { key: "input", label: "① 데이터 입력" },
  { key: "alloc", label: "② 타임 배정" },
  { key: "student", label: "③ 학생별 결과" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

const GRADE_FILE_LABEL: Record<GradeKey, string> = {
  pre1: "예비1학년",
  grade1: "1학년",
  grade2: "2학년",
};

export function TimeAllocationTab() {
  const api = useTimeAllocation();
  const [step, setStep] = React.useState<StepKey>("input");

  // 프로젝트 JSON 저장 번들에 합류 (기존 탭들의 handleSaveBackup / handleLoadBackup 가 호출).
  React.useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.getTimeAllocBackup = () => api.getBackup();
    w.loadTimeAllocBackup = (obj: unknown) => api.loadBackup(obj);
    return () => {
      delete w.getTimeAllocBackup;
      delete w.loadTimeAllocBackup;
    };
  }, [api]);

  const loadFromMain = () => {
    const getMain = (window as unknown as { getMainBackup?: () => MainSurveySnapshot }).getMainBackup;
    if (!getMain) {
      window.alert("본조사 탭을 찾을 수 없습니다.");
      return;
    }
    api.loadFromMain(getMain() ?? {});
  };

  // 리로스쿨용 내보내기는 본조사 탭이 들고 있는 "원본 업로드 파일"을 그대로 다시 엽니다.
  const mainFileData = () => {
    const getMain = (window as unknown as { getMainBackup?: () => MainSurveySnapshot }).getMainBackup;
    return getMain?.()?.uploadedFiles?.[api.activeGrade]?.data;
  };

  // 다른 탭들과 동일한 저장/불러오기 번들 — MainSurveyTab.tsx 의 handleSaveBackup/handleLoadBackup 과 같은 로직.
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveBackup = async () => {
    const w = window as unknown as Record<string, () => unknown>;
    const fullBackup = {
      version: 3,
      demand: w.getDemandBackup?.() || {},
      main: w.getMainBackup?.() || {},
      change: w.getChangeBackup?.() || {},
      timeAlloc: w.getTimeAllocBackup?.() || {},
    };

    const jsonString = JSON.stringify(fullBackup, null, 2);
    const suggestedName = "2026학년도 타임(구획) 배정.json";

    // 저장 위치를 직접 고르게 showSaveFilePicker를 먼저 시도합니다. 이게 실패하는
    // 환경(임베디드 미리보기 등, iframe 여부로는 못 잡아내는 플랫폼 제약)에서는 사용자가
    // 취소한 게 아닌 한 일반 다운로드로 자동 대체합니다 — 실패한 저장이 빈 파일을 남기고
    // 그 빈 파일을 나중에 불러오면 JSON 파싱 오류가 나는 걸 막기 위함입니다(실제로 겪음).
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
        if ((err as Error).name === "AbortError") return; // 사용자가 대화상자를 닫음 — 조용히 종료
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
        const content = evt.target?.result as string;
        const parsed = JSON.parse(content);
        const w = window as unknown as Record<string, (obj: unknown) => void>;

        if (parsed.version >= 2) {
          w.loadDemandBackup?.(parsed.demand || {});
          w.loadMainBackup?.(parsed.main || {});
          w.loadChangeBackup?.(parsed.change || {});
          w.loadTimeAllocBackup?.(parsed.timeAlloc || {});
        } else {
          w.loadDemandBackup?.(parsed);
          w.loadMainBackup?.(parsed);
          w.loadChangeBackup?.(parsed);
        }

        window.alert("작업 내역을 성공적으로 불러왔습니다.");
      } catch (err) {
        console.error("Failed to parse file:", err);
        window.alert("파일 형식이 잘못되었습니다.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      <header className="flex-none px-10 py-5 border-b border-stone-200 bg-white/60 backdrop-blur-sm flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap w-full">
          <h1 className="text-2xl font-extrabold tracking-tight text-stone-900 break-keep flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-amber-600 shrink-0" />
            선택과목 타임(구획) 배정
          </h1>
          <div className="flex gap-2 shrink-0">
            <input
              type="file"
              accept=".json"
              className="hidden"
              ref={fileInputRef}
              onChange={handleLoadBackup}
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
        <div className="flex flex-wrap gap-2">
          {STEPS.map((s) => (
            <button
              key={s.key}
              onClick={() => setStep(s.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                step === s.key ? "bg-amber-500 text-white shadow" : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </header>

      <div className="px-10 py-6">
        <GradeTabs activeGrade={api.activeGrade} setActiveGrade={api.setActiveGrade} />
        {step === "input" && <DataInputStep api={api} onLoadFromMain={loadFromMain} />}
        {step === "alloc" && <AllocationGridStep api={api} />}
        {step === "student" && (
          <StudentResultStep
            api={api}
            fileLabel={GRADE_FILE_LABEL[api.activeGrade]}
            getMainFileData={mainFileData}
          />
        )}
      </div>
    </>
  );
}
