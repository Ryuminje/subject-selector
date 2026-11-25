"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import { Upload, FileText, Settings, Download, Save, FolderOpen, Users } from "lucide-react";
import { useTimetableData } from "../../features/change-survey/hooks/useTimetableData";
import { useChangeCurriculum } from "../../features/change-survey/hooks/useChangeCurriculum";
import { useChangeUploads } from "../../features/change-survey/hooks/useChangeUploads";
import { useElectiveChanges } from "../../features/change-survey/hooks/useElectiveChanges";
import { useStep6Data } from "../../features/change-survey/hooks/useStep6Data";
import { useChangeExports } from "../../features/change-survey/hooks/useChangeExports";
import { BaseDataNotice } from "../../features/year-data/components/BaseDataNotice";
import { useYearData } from "../../features/year-data/YearDataContext";
import { parseSampleBinary } from "../../features/change-survey/hooks/useChangeUploads";
import type { TimeAllocTransfer } from "../../features/time-allocation/lib/exportTimetable";
import { excludedIdSet } from "../../features/year-data/lib/roster";
import { CHANGE_OFFSETS, cohortKey } from "../../features/year-data/lib/cohortStore";
import { collectPreviousRounds, describePreviousRounds } from "../../features/year-data/lib/previousRounds";
import { SemesterBar } from "../../features/change-survey/components/SemesterBar";
import { buildCarryOver, changeStoreName, SEMESTER_LABEL, semesterFromLabel, type ChangeSemester } from "../../features/change-survey/lib/semester";
import type { ChangeGradeKey, TimetableGradeData } from "../../features/change-survey/types";
import type { StudentTimeData } from "../../types";
import { UploadStep } from "../../features/change-survey/components/UploadStep";
import { TimetableStep } from "../../features/change-survey/components/TimetableStep";
import { ApplicationStep } from "../../features/change-survey/components/ApplicationStep";
import { RosterStep } from "../../features/change-survey/components/RosterStep";
import { RosterAfterStep } from "../../features/change-survey/components/RosterAfterStep";
import { AnalysisStep } from "../../features/change-survey/components/AnalysisStep";
import { RiroschoolStep } from "../../features/change-survey/components/RiroschoolStep";
import { subjectOptionsOf } from "../../features/change-survey/lib/subjectMatch";
import { GuideLink } from "@/features/guide/components/GuideLink";
import { WorkYearSelect } from "../../features/year-data/components/WorkYearSelect";

export function ChangeSurveyTab() {
  const [changeActiveTab, setChangeActiveTab] = useState<"upload" | "timetable" | "roster" | "application" | "roster_after" | "analysis" | "riroschool">("upload");
  const [changeActiveGrade, setChangeActiveGrade] = useState<"grade2" | "grade3">("grade2");
  // 1학기/2학기 — 시간표·학생 타임·신청·확정이 학기마다 따로 보관된다(lib/semester.ts). 학기 구분이 없던 옛 데이터는 2학기에 들어간다.
  const [semester, setSemester] = useState<ChangeSemester>("s1");
  const [showOnlyApplicants, setShowOnlyApplicants] = useState(false);
  const [changeRosterTimeSlot, setChangeRosterTimeSlot] = useState("A");
  const [rosterAfterSubjectFilter, setRosterAfterSubjectFilter] = useState<string>("전체");
  const [rosterSubjectFilter, setRosterSubjectFilter] = useState<string>("전체");


  const {
    timeSlots,
    classCols,
    timetableData,
    handleTimetablePaste,
    addTimeSlot,
    addClassCol,
    removeTimeSlot,
    removeClassCol,
    updateTimetableCell,
    clearTimetable,
  } = useTimetableData(changeActiveGrade, semester);

  const {
    sampleRawData,
    parsedSampleData: rawParsedSampleData,
    grade2HistoryData,
    grade3Sem1HistoryData,
    extraUploads,
    changeUploadNames,
    handleDeleteSampleUpload,
    handleDeleteExtraUpload,
    handleExtraUpload,
    handleChangeSampleUpload,
  } = useChangeUploads(changeActiveGrade, semester);

  // 기초자료 학생 명단에서 전출·퇴학으로 표시된 학생은 이 탭의 계산에서 뺀다(업로드한 원본 데이터는 그대로 보존)
  const { roster, workYear, cohortStore, updateCohortStore, setCohortStore, demandResults } = useYearData();
  const excludedIds = useMemo(() => excludedIdSet(roster), [roster]);
  const parsedSampleData = useMemo(
    () => ({
      grade2: rawParsedSampleData.grade2.filter((s) => !excludedIds.has(s.id)),
      grade3: rawParsedSampleData.grade3.filter((s) => !excludedIds.has(s.id)),
    }),
    [rawParsedSampleData, excludedIds],
  );

  const {
    electiveChanges, setElectiveChanges,
    electiveChangesArbitrary, setElectiveChangesArbitrary,
    enableOptimization, setEnableOptimization,
    lockedSubjects, setLockedSubjects,
    adjustmentLog,
    adjustmentLogByGrade,
    confirmedBaseSchedules,
    confirmedLog,
    confirmHistory,
    canUndoConfirm,
    handleConfirm,
    handleUndoConfirm,
    handleClearConfirmed,
    finalSubjects,
  } = useElectiveChanges(changeActiveGrade, parsedSampleData, timetableData, timeSlots, classCols, grade2HistoryData, grade3Sem1HistoryData, semester);

  // 학기·학년 자리를 지정해 저장소에 바로 읽고 쓴다(지금 보는 학기와 다른 학기에도 쓸 수 있게 훅의 setter 를 거치지 않는다).
  const readGrade = <T,>(sem: ChangeSemester, field: string, grade: ChangeGradeKey, def: T): T => {
    const v = cohortStore[changeStoreName(sem, field)]?.[cohortKey(workYear, CHANGE_OFFSETS[grade])];
    return v === undefined ? def : (v as T);
  };
  const patchGrade = <T,>(sem: ChangeSemester, field: string, grade: ChangeGradeKey, def: T, fn: (cur: T) => T) =>
    updateCohortStore(changeStoreName(sem, field), (cur, W) => {
      const key = cohortKey(W, CHANGE_OFFSETS[grade]);
      const before = (cur?.[key] === undefined ? def : cur[key]) as T;
      return { ...(cur ?? {}), [key]: fn(before) };
    });

  // 1학기 변경 후 수강과목 → 2학기 "이전 수강과목". 2학년 자리는 "2학년 수강과목(1학기)", 3학년 자리는 "3학년 1학기 수강과목" 칸으로 들어간다.
  const handleCarryOver = () => {
    const grades = (["grade2", "grade3"] as ChangeGradeKey[]).filter((g) => (parsedSampleData[g] || []).length > 0);
    if (grades.length === 0) return;
    const summary = grades.map((g) => `${g === "grade2" ? "2학년" : "3학년"} ${parsedSampleData[g].length}명`).join(", ");
    if (!window.confirm(`1학기 변경 후 수강과목(${summary})을 2학기 변경의 "이전 수강과목"으로 넘깁니다.\n2학기에 이미 올려 둔 같은 항목이 있으면 바뀝니다. 계속할까요?`)) return;
    const label = "1학기 변경 결과에서 넘어옴";
    grades.forEach((g) => {
      const map = buildCarryOver(finalSubjects[g], parsedSampleData[g], roster);
      const field = g === "grade2" ? "grade2HistoryData" : "grade3Sem1HistoryData";
      const flag = g === "grade2" ? "grade2Optional" : "grade3Sem1";
      patchGrade("s2", field, g, {} as Record<string, string[]>, () => map);
      patchGrade("s2", "extraUploads", g, { grade2Optional: false, grade3Sem1: false }, (cur) => ({ ...cur, [flag]: true }));
      patchGrade("s2", "changeUploadNames", g, { timetable: null, grade2Optional: null, grade3Sem1: null } as Record<string, string | null>, (cur) => ({ ...cur, [flag]: label }));
    });
    window.alert(`2학기 "이전 수강과목"으로 넘겼습니다(${summary}). 2학기 변경 화면의 1단계에서 확인할 수 있습니다.`);
  };

  // 지금 보는 학기의 "변경 후" 결과(5단계 변경 후 타임별 학생 명단과 같은 값)를 수강신청 회차별로 저장해 둔다.
  // 다음 회차(작업 학년도를 올린 뒤)가 이 값을 이전 수강과목으로 가져온다(lib/previousRounds). 값이 같으면 다시 쓰지 않는다.
  useEffect(() => {
    (["grade2", "grade3"] as ChangeGradeKey[]).forEach((g) => {
      const next = finalSubjects[g];
      updateCohortStore(changeStoreName(semester, "finalSubjects"), (cur, W) => {
        const key = cohortKey(W, CHANGE_OFFSETS[g]);
        const before = cur?.[key] as Record<string, string[]> | undefined;
        if (Object.keys(next).length === 0 && (!before || Object.keys(before).length === 0)) return cur;
        if (JSON.stringify(before ?? {}) === JSON.stringify(next)) return cur;
        return { ...(cur ?? {}), [key]: next };
      });
    });
  }, [finalSubjects, semester, updateCohortStore]);

  // 3학년 자리의 "2학년 수강과목" — 같은 입학생의 2학년 회차 결과(변경 후 결과 → 없으면 본조사 신청)로 채운다. 1·2학기 모두 같은 값.
  const handleImportPreviousSecondGrade = () => {
    const r = collectPreviousRounds({ store: cohortStore, roster, demandResults, cohort: workYear - CHANGE_OFFSETS.grade3, grades: [2] });
    const detail = describePreviousRounds(r);
    if (r.students === 0) {
      window.alert(`가져올 2학년 회차 자료가 없습니다.\n${detail}`);
      return;
    }
    const existing = Object.keys(grade2HistoryData.grade3 || {}).length;
    if (existing > 0 && !window.confirm(`이미 올려 둔 2학년 수강과목이 있습니다. 지난 수강신청 회차 결과로 바꿀까요?\n(${detail})`)) return;
    const map: Record<string, string[]> = Object.fromEntries(Object.entries(r.map).map(([id, v]) => [id, v.subjects]));
    const label = "지난 수강신청 회차에서 가져옴";
    (["s1", "s2"] as ChangeSemester[]).forEach((sem) => {
      patchGrade(sem, "grade2HistoryData", "grade3", {} as Record<string, string[]>, () => map);
      patchGrade(sem, "extraUploads", "grade3", { grade2Optional: false, grade3Sem1: false }, (cur) => ({ ...cur, grade2Optional: true }));
      patchGrade(sem, "changeUploadNames", "grade3", { timetable: null, grade2Optional: null, grade3Sem1: null } as Record<string, string | null>, (cur) => ({ ...cur, grade2Optional: label }));
    });
    window.alert(`3학년 자리의 2학년 수강과목으로 ${r.students}명, 과목 ${r.subjectCount}개를 가져왔습니다.\n${detail}`);
  };

  const {
    changeParsedCurriculumList, setChangeParsedCurriculumList,
    changeSubjectMap, setChangeSubjectMap,
    changeIsCurriculumParsed, setChangeIsCurriculumParsed,
    changeHierarchyRules, setChangeHierarchyRules,
    getChangeSubjectCategory,
  } = useChangeCurriculum(changeActiveGrade);

  if (typeof window !== "undefined") {
    (window as any).getChangeBackup = () => ({
    changeActiveGrade,
    semester,
    changeParsedCurriculumList,
    changeSubjectMap,
    changeIsCurriculumParsed,
    changeHierarchyRules,
    parsedSampleData: rawParsedSampleData,
    timetableData,
    electiveChanges,
    timeSlots,
    classCols,
    grade2HistoryData,
    grade3Sem1HistoryData,
    extraUploads,
    changeUploadNames,
    sampleRawData,
    confirmedLog,
    confirmedBaseSchedules,
    confirmHistory,
    lockedSubjects
  });

  (window as any).loadChangeBackup = (parsed: any) => {
    // 학기 구분이 없던 옛 파일의 값은 2학기 자리(옛 이름)에 넣는다. 새 파일은 이어서 불러오는 기초자료(cohortStore)가 1·2학기 모두 다시 채운다.
    // 훅의 setter 는 지금 보는 학기에 묶여 있어 쓰지 않고 저장소에 직접 쓴다.
    const putBoth = (field: string, v: Record<string, unknown>) =>
      updateCohortStore(changeStoreName("s2", field), (cur, W) => {
        const out: Record<string, unknown> = { ...(cur ?? {}) };
        (["grade2", "grade3"] as ChangeGradeKey[]).forEach((g) => {
          if (v[g] !== undefined) out[cohortKey(W, CHANGE_OFFSETS[g])] = v[g];
        });
        return out;
      });
    setSemester(parsed.semester === "s1" ? "s1" : "s2");
    // 학기 구분이 없던 옛 파일에는 1학기 데이터가 없다 — 불러오기 전 작업의 1학기 데이터가 남아 섞이지 않게 비운다(새 파일은 cohortStore 가 통째로 덮어쓴다).
    if (!parsed.semester) {
      setCohortStore((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith("change.s1."))));
    }
    if (parsed.changeActiveGrade) setChangeActiveGrade(parsed.changeActiveGrade);
    if (parsed.changeParsedCurriculumList) setChangeParsedCurriculumList(parsed.changeParsedCurriculumList);
    if (parsed.changeSubjectMap) setChangeSubjectMap(parsed.changeSubjectMap);
    if (parsed.changeIsCurriculumParsed) setChangeIsCurriculumParsed(parsed.changeIsCurriculumParsed);
    if (parsed.changeHierarchyRules) setChangeHierarchyRules(parsed.changeHierarchyRules);
    if (parsed.parsedSampleData) putBoth("parsedSampleData", parsed.parsedSampleData);
    if (parsed.sampleRawData) putBoth("sampleRawData", parsed.sampleRawData);
    if (parsed.timetableData) putBoth("timetableData", parsed.timetableData);
    if (parsed.electiveChanges) putBoth("electiveChanges", parsed.electiveChanges);
    if (parsed.timeSlots) putBoth("timeSlots", parsed.timeSlots);
    if (parsed.classCols) putBoth("classCols", parsed.classCols);
    // 교체 불가 과목: 없는 옛 백업은 "지정 없음"으로 초기화해 직전 화면의 지정이 남지 않게 한다
    putBoth("lockedSubjects", parsed.lockedSubjects ?? { grade2: [], grade3: [] });
    // 확정 관련 세 필드는 (다른 필드와 달리) 파일에 없으면 메모리에 남은 값을
    // 그대로 두지 않고 명시적으로 "확정 없음" 상태로 초기화한다 — 그래야 확정
    // 기능이 없던(또는 확정을 한 번도 안 한) 옛 백업을 불러왔을 때, 방금 전까지
    // 화면에 떠 있던 확정 상태가 유령처럼 남아있지 않는다.
    putBoth("confirmedLog", parsed.confirmedLog ?? { grade2: {}, grade3: {} });
    putBoth("confirmedBaseSchedules", parsed.confirmedBaseSchedules ?? { grade2: {}, grade3: {} });
    if (parsed.confirmHistory) {
      // 새 형식: 확정마다 쌓인 스냅샷 스택을 그대로 복원
      putBoth("confirmHistory", parsed.confirmHistory);
    } else if (parsed.preConfirmSnapshot) {
      // 옛 형식(확정 1회분만 저장): 단일 스냅샷을 스택의 1개짜리 항목으로 변환
      putBoth("confirmHistory", {
        grade2: parsed.preConfirmSnapshot.grade2 ? [parsed.preConfirmSnapshot.grade2] : [],
        grade3: parsed.preConfirmSnapshot.grade3 ? [parsed.preConfirmSnapshot.grade3] : [],
      });
    } else {
      putBoth("confirmHistory", { grade2: [], grade3: [] });
    }
    if (parsed.grade2HistoryData) {
      if (parsed.grade2HistoryData.grade2 || parsed.grade2HistoryData.grade3) {
        const trimmed: Record<string, Record<string, string[]>> = { grade2: {}, grade3: {} };
        for (const g of ["grade2", "grade3"]) {
          if (parsed.grade2HistoryData[g]) {
            for (const k in parsed.grade2HistoryData[g]) trimmed[g][k.trim()] = parsed.grade2HistoryData[g][k];
          }
        }
        putBoth("grade2HistoryData", trimmed);
      } else {
        const trimmed: Record<string, string[]> = {};
        for (const k in parsed.grade2HistoryData) trimmed[k.trim()] = parsed.grade2HistoryData[k];
        putBoth("grade2HistoryData", { grade2: trimmed, grade3: trimmed });
      }
    }
    if (parsed.grade3Sem1HistoryData) {
      if (parsed.grade3Sem1HistoryData.grade2 || parsed.grade3Sem1HistoryData.grade3) {
        const trimmed: Record<string, Record<string, string[]>> = { grade2: {}, grade3: {} };
        for (const g of ["grade2", "grade3"]) {
          if (parsed.grade3Sem1HistoryData[g]) {
            for (const k in parsed.grade3Sem1HistoryData[g]) trimmed[g][k.trim()] = parsed.grade3Sem1HistoryData[g][k];
          }
        }
        putBoth("grade3Sem1HistoryData", trimmed);
      } else {
        const trimmed: Record<string, string[]> = {};
        for (const k in parsed.grade3Sem1HistoryData) trimmed[k.trim()] = parsed.grade3Sem1HistoryData[k];
        putBoth("grade3Sem1HistoryData", { grade2: trimmed, grade3: trimmed });
      }
    }
    if (parsed.extraUploads) {
      if (parsed.extraUploads.grade2 || parsed.extraUploads.grade3) {
        putBoth("extraUploads", parsed.extraUploads);
      } else {
        putBoth("extraUploads", { grade2: parsed.extraUploads, grade3: parsed.extraUploads });
      }
    }
    if (parsed.changeUploadNames) {
      putBoth("changeUploadNames", parsed.changeUploadNames);
    }
  };
  }

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveBackup = async () => {
    const fullBackup = {
      version: 3,
      demand: (window as any).getDemandBackup?.() || {},
      main: (window as any).getMainBackup?.() || {},
      change: (window as any).getChangeBackup?.() || {},
      timeAlloc: (window as any).getTimeAllocBackup?.() || {},
      base: (window as any).getBaseBackup?.() || {}
    };
    
    const jsonString = JSON.stringify(fullBackup, null, 2);
    const suggestedName = "2026학년도 수요조사 및 선택과목 변경.json";

    // 저장 위치를 직접 고르게 showSaveFilePicker를 먼저 시도합니다. 이게 실패하는
    // 환경(임베디드 미리보기 등, iframe 여부로는 못 잡아내는 플랫폼 제약)에서는 사용자가
    // 취소한 게 아닌 한 일반 다운로드로 자동 대체합니다 — 실패한 저장이 빈 파일을 남기고
    // 그 빈 파일을 나중에 불러오면 JSON 파싱 오류가 나는 걸 막기 위함입니다(실제로 겪음).
    let savedViaPicker = false;
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName,
          types: [{
            description: 'JSON 파일',
            accept: { 'application/json': ['.json'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(jsonString);
        await writable.close();
        savedViaPicker = true;
      } catch (err: any) {
        if (err?.name === 'AbortError') return; // 사용자가 대화상자를 닫음 — 조용히 종료
        console.warn('showSaveFilePicker 저장 실패, 다운로드로 대체합니다:', err);
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
        console.error('Failed to save file:', err);
        alert('파일 저장 중 오류가 발생했습니다.');
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
        
        if (parsed.version >= 2) {
          (window as any).loadDemandBackup?.(parsed.demand || {});
          (window as any).loadMainBackup?.(parsed.main || {});
          (window as any).loadChangeBackup?.(parsed.change || {});
          (window as any).loadTimeAllocBackup?.(parsed.timeAlloc || {});
          (window as any).loadBaseBackup?.(parsed.base || {});
        } else {
          (window as any).loadDemandBackup?.(parsed);
          (window as any).loadMainBackup?.(parsed);
          (window as any).loadChangeBackup?.(parsed);
        }
        
        alert("작업 내역을 성공적으로 불러왔습니다.");
      } catch (err) {
        console.error("Failed to parse file:", err);
        alert("파일 형식이 잘못되었습니다.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const step6Data = useStep6Data(
    changeActiveTab,
    changeActiveGrade,
    parsedSampleData,
    grade2HistoryData,
    grade3Sem1HistoryData,
    adjustmentLog,
    changeHierarchyRules,
    timeSlots,
    getChangeSubjectCategory,
  );

  const {
    handleExportRoster,
    handleExportAttendanceRoster,
    handleExportChanges,
    handleDownloadRiroschool,
    handleExportStep6,
    handleExportTimetable,
  } = useChangeExports(
    changeActiveGrade,
    parsedSampleData,
    sampleRawData,
    timetableData,
    timeSlots,
    classCols,
    adjustmentLogByGrade,
    electiveChanges,
    electiveChangesArbitrary,
    step6Data,
  );

  // 타임(구획) 배정 탭의 "선택과목 변경 탭으로 보내기"가 부르는 함수 — 파일을 내려받아 다시 올리지 않고 같은 내용을 바로 받는다.
  // 학생별 타임(업로드한 파일과 같은 해석)·타임별 시간표·원본 엑셀(리로스쿨용 파일 만들 때 씀)을 한 번에 채운다.
  if (typeof window !== "undefined") {
    (window as unknown as { receiveTimeAllocation?: (p: TimeAllocTransfer) => boolean }).receiveTimeAllocation = (p) => {
      const cg: "grade2" | "grade3" = p.grade === "grade1" ? "grade2" : "grade3";
      const students = parseSampleBinary(p.binary);
      if (!students) {
        window.alert("타임 배정 결과를 읽지 못했습니다.");
        return false;
      }
      // 보낸 학기("1학기"/"2학기")에 받는다. 학기 구분이 없으면 지금 보는 학기에 받는다.
      const sem = semesterFromLabel(p.semester) ?? semester;
      const hasData =
        readGrade<StudentTimeData[]>(sem, "parsedSampleData", cg, []).length > 0 ||
        Object.values(readGrade<TimetableGradeData>(sem, "timetableData", cg, {})).some((row) => Object.values(row || {}).some((c) => c?.subject));
      if (hasData && !window.confirm(`${SEMESTER_LABEL[sem]}의 이 학년에 이미 올려 둔 학생 데이터·타임별 시간표가 있습니다. 타임 배정 결과로 바꿀까요?`)) return false;
      patchGrade<string | null>(sem, "sampleRawData", cg, null, () => p.binary);
      patchGrade<StudentTimeData[]>(sem, "parsedSampleData", cg, [], () => students);
      patchGrade(sem, "changeUploadNames", cg, { timetable: null, grade2Optional: null, grade3Sem1: null } as Record<string, string | null>, (cur) => ({ ...cur, timetable: p.label }));
      patchGrade<string[]>(sem, "timeSlots", cg, [], () => p.timetable.slots);
      patchGrade<string[]>(sem, "classCols", cg, [], () => p.timetable.cols);
      patchGrade<TimetableGradeData>(sem, "timetableData", cg, {}, () => p.timetable.cells);
      setSemester(sem);
      setChangeActiveGrade(cg);
      return true;
    };
  }

  return ( <>
        {/* Global Header */}
        <header className="flex-none px-10 py-5 border-b border-stone-200 bg-white/60 backdrop-blur-sm flex flex-col gap-4">
          {/* DemandSurveyTab.tsx와 같은 이유로 flex-wrap·break-keep을 둡니다 — 자세한 설명은 그쪽 주석 참고. */}
          <div className="flex items-center justify-between gap-3 flex-wrap w-full">
            <h1 className="text-2xl font-extrabold tracking-tight text-stone-900 break-keep">
              명신고등학교 선택과목 변경 시스템
            </h1>
            
            <div className="flex flex-wrap gap-2 min-w-0 sm:shrink-0">
              <input
                type="file"
                accept=".json"
                className="hidden"
                ref={fileInputRef}
                onChange={handleLoadBackup}
              />
              <WorkYearSelect />
              <GuideLink slug="enrollment" className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-stone-50 text-stone-700 text-sm font-medium rounded-xl transition-all border border-stone-300 shadow-sm whitespace-nowrap" />
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
                  <button onClick={() => setChangeActiveTab('upload')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 whitespace-nowrap shrink-0 ${changeActiveTab === 'upload' ? 'bg-white text-stone-900 shadow-md border border-stone-200' : 'text-stone-500 hover:text-stone-800 hover:bg-white/70'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">1단계</span><div className="flex items-center gap-1.5"><Upload className="w-4 h-4" /><span>데이터 업로드</span></div></button>
                  <button onClick={() => setChangeActiveTab('timetable')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 whitespace-nowrap shrink-0 ${changeActiveTab === 'timetable' ? 'bg-white text-stone-900 shadow-md border border-stone-200' : 'text-stone-500 hover:text-stone-800 hover:bg-white/70'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">2단계</span><div className="flex items-center gap-1.5"><Settings className="w-4 h-4" /><span>타임별 시간표 입력</span></div></button>
                  <button onClick={() => setChangeActiveTab('roster')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 whitespace-nowrap shrink-0 ${changeActiveTab === 'roster' ? 'bg-white text-stone-900 shadow-md border border-stone-200' : 'text-stone-500 hover:text-stone-800 hover:bg-white/70'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">3단계</span><div className="flex items-center gap-1.5"><Users className="w-4 h-4" /><span>타임별 학생 명단</span></div></button>
                  <button onClick={() => setChangeActiveTab('application')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 whitespace-nowrap shrink-0 ${changeActiveTab === 'application' ? 'bg-white text-stone-900 shadow-md border border-stone-200' : 'text-stone-500 hover:text-stone-800 hover:bg-white/70'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">4단계</span><div className="flex items-center gap-1.5"><FileText className="w-4 h-4" /><span>선택과목 변경 데이터 입력</span></div></button>
                  <button onClick={() => setChangeActiveTab('roster_after')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 whitespace-nowrap shrink-0 ${changeActiveTab === 'roster_after' ? 'bg-white text-stone-900 shadow-md border border-stone-200' : 'text-stone-500 hover:text-stone-800 hover:bg-white/70'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">5단계</span><div className="flex items-center gap-1.5"><Users className="w-4 h-4" /><span>변경 후 타임별 학생 명단</span></div></button>
                  <button onClick={() => setChangeActiveTab('analysis')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 whitespace-nowrap shrink-0 ${changeActiveTab === 'analysis' ? 'bg-white text-stone-900 shadow-md border border-stone-200' : 'text-stone-500 hover:text-stone-800 hover:bg-white/70'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">6단계</span><div className="flex items-center gap-1.5"><FileText className="w-4 h-4" /><span>다년도 분석</span></div></button>
                  <button onClick={() => setChangeActiveTab('riroschool')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 whitespace-nowrap shrink-0 ${changeActiveTab === 'riroschool' ? 'bg-white text-stone-900 shadow-md border border-stone-200' : 'text-stone-500 hover:text-stone-800 hover:bg-white/70'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">7단계</span><div className="flex items-center gap-1.5"><Download className="w-4 h-4" /><span>리로스쿨용 파일</span></div></button>
                </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 pb-24">
          <div className="w-full mx-auto">

                {/* 변경 탭의 grade2/grade3 는 기초자료(공유 저장소)의 grade1/grade2 와 같은 학년 */}
                <BaseDataNotice
                  grade={changeActiveGrade === "grade2" ? "grade1" : "grade2"}
                  students={(rawParsedSampleData[changeActiveGrade] || []).map((s) => ({ id: s.id, name: s.name }))}
                />
                <SemesterBar
                  semester={semester}
                  onChange={setSemester}
                  onCarryOver={handleCarryOver}
                  hasStudents={(parsedSampleData.grade2.length + parsedSampleData.grade3.length) > 0}
                />
                <div className="bg-white/70 backdrop-blur-xl border border-stone-200 rounded-3xl p-8 shadow-xl">
{changeActiveTab === "upload" && (
                    <UploadStep
                      changeActiveGrade={changeActiveGrade}
                      setChangeActiveGrade={setChangeActiveGrade}
                      parsedSampleData={parsedSampleData}
                      changeUploadNames={changeUploadNames}
                      extraUploads={extraUploads}
                      handleDeleteSampleUpload={handleDeleteSampleUpload}
                      handleChangeSampleUpload={handleChangeSampleUpload}
                      handleDeleteExtraUpload={handleDeleteExtraUpload}
                      handleExtraUpload={handleExtraUpload}
                      setChangeActiveTab={setChangeActiveTab}
                      grade2HistoryData={grade2HistoryData}
                      grade3Sem1HistoryData={grade3Sem1HistoryData}
                      onImportPreviousSecondGrade={handleImportPreviousSecondGrade}
                    />
                  )}

                  {changeActiveTab === "timetable" && (
                    <TimetableStep
                      subjectOptions={subjectOptionsOf(parsedSampleData[changeActiveGrade] || [])}
                      changeActiveGrade={changeActiveGrade}
                      setChangeActiveGrade={setChangeActiveGrade}
                      handleExportTimetable={handleExportTimetable}
                      addTimeSlot={addTimeSlot}
                      addClassCol={addClassCol}
                      removeClassCol={removeClassCol}
                      removeTimeSlot={removeTimeSlot}
                      clearTimetable={clearTimetable}
                      classCols={classCols}
                      timeSlots={timeSlots}
                      timetableData={timetableData}
                      updateTimetableCell={updateTimetableCell}
                      handleTimetablePaste={handleTimetablePaste}
                    />
                  )}

                  {changeActiveTab === "application" && (
                    <ApplicationStep
                      changeActiveGrade={changeActiveGrade}
                      setChangeActiveGrade={setChangeActiveGrade}
                      electiveChanges={electiveChanges}
                      setElectiveChanges={setElectiveChanges}
                      electiveChangesArbitrary={electiveChangesArbitrary}
                      setElectiveChangesArbitrary={setElectiveChangesArbitrary}
                      enableOptimization={enableOptimization}
                      lockedSubjects={lockedSubjects}
                      setLockedSubjects={setLockedSubjects}
                      setEnableOptimization={setEnableOptimization}
                      handleExportChanges={handleExportChanges}
                      adjustmentLog={adjustmentLog}
                      parsedSampleData={parsedSampleData}
                      timetableData={timetableData}
                      timeSlots={timeSlots}
                      classCols={classCols}
                      confirmedBaseSchedules={confirmedBaseSchedules}
                      canUndoConfirm={canUndoConfirm}
                      onConfirm={handleConfirm}
                      onUndoConfirm={handleUndoConfirm}
                      onClearConfirmed={handleClearConfirmed}
                    />
                  )}

                  {changeActiveTab === "roster_after" && (
                    <RosterAfterStep
                      changeActiveGrade={changeActiveGrade}
                      setChangeActiveGrade={setChangeActiveGrade}
                      handleExportAttendanceRoster={handleExportAttendanceRoster}
                      handleExportRoster={handleExportRoster}
                      timeSlots={timeSlots}
                      classCols={classCols}
                      timetableData={timetableData}
                      rosterAfterSubjectFilter={rosterAfterSubjectFilter}
                      setRosterAfterSubjectFilter={setRosterAfterSubjectFilter}
                      changeRosterTimeSlot={changeRosterTimeSlot}
                      setChangeRosterTimeSlot={setChangeRosterTimeSlot}
                      parsedSampleData={parsedSampleData}
                      adjustmentLog={adjustmentLog}
                    />
                  )}


                  {changeActiveTab === "roster" && (
                    <RosterStep
                      changeActiveGrade={changeActiveGrade}
                      setChangeActiveGrade={setChangeActiveGrade}
                      handleExportRoster={handleExportRoster}
                      timeSlots={timeSlots}
                      classCols={classCols}
                      timetableData={timetableData}
                      rosterSubjectFilter={rosterSubjectFilter}
                      setRosterSubjectFilter={setRosterSubjectFilter}
                      changeRosterTimeSlot={changeRosterTimeSlot}
                      setChangeRosterTimeSlot={setChangeRosterTimeSlot}
                      parsedSampleData={parsedSampleData}
                    />
                  )}
                  {changeActiveTab === "analysis" && (
                    <AnalysisStep
                      changeActiveGrade={changeActiveGrade}
                      setChangeActiveGrade={setChangeActiveGrade}
                      handleExportStep6={handleExportStep6}
                      step6Data={step6Data}
                      showOnlyApplicants={showOnlyApplicants}
                      setShowOnlyApplicants={setShowOnlyApplicants}
                      timeSlots={timeSlots}
                      adjustmentLog={adjustmentLog}
                    />
                  )}
                  
                  {changeActiveTab === "riroschool" && (
                    <RiroschoolStep
                      sampleRawData={sampleRawData}
                      handleDownloadRiroschool={handleDownloadRiroschool}
                    />
                  )}

                </div>

          </div>
        </div>
      </> );
}
