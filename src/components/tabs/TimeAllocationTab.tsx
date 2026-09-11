"use client";

// 선택과목 타임(구획) 배정 탭 — enrollment-helper 4번째 사이드바 탭.
// 3단계(데이터 입력 / 타임 배정 / 학생별 결과) + 학년 전환(pre1/grade1/grade2).
// 저장은 기존 탭들의 "저장/불러오기" 번들에 window.getTimeAllocBackup/loadTimeAllocBackup 로 합류.

import React from "react";
import { CalendarClock } from "lucide-react";
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

  return (
    <>
      <header className="flex-none px-10 py-5 border-b border-stone-200 bg-white/60 backdrop-blur-sm flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap w-full">
          <h1 className="text-2xl font-extrabold tracking-tight text-stone-900 break-keep flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-amber-600 shrink-0" />
            선택과목 타임(구획) 배정
          </h1>
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
          <StudentResultStep api={api} fileLabel={GRADE_FILE_LABEL[api.activeGrade]} />
        )}
      </div>
    </>
  );
}
