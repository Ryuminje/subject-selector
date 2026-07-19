"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Upload, FileText, Settings, Download, Save, FolderOpen, Users } from "lucide-react";
import * as XLSX from "xlsx-js-style";
import { useTimetableData } from "../../features/change-survey/hooks/useTimetableData";
import { useChangeCurriculum, normalizeSubjectName } from "../../features/change-survey/hooks/useChangeCurriculum";
import { useChangeUploads } from "../../features/change-survey/hooks/useChangeUploads";
import { BasicStep } from "../../features/change-survey/components/BasicStep";
import { UploadStep } from "../../features/change-survey/components/UploadStep";
import { TimetableStep } from "../../features/change-survey/components/TimetableStep";
import { ApplicationStep } from "../../features/change-survey/components/ApplicationStep";
import { RosterStep } from "../../features/change-survey/components/RosterStep";
import { RosterAfterStep } from "../../features/change-survey/components/RosterAfterStep";
import { AnalysisStep } from "../../features/change-survey/components/AnalysisStep";
import { RiroschoolStep } from "../../features/change-survey/components/RiroschoolStep";

export function ChangeSurveyTab() {
  const [changeActiveTab, setChangeActiveTab] = useState<"basic" | "upload" | "timetable" | "roster" | "application" | "roster_after" | "analysis" | "riroschool">("basic");
  const [changeActiveGrade, setChangeActiveGrade] = useState<"grade2" | "grade3">("grade2");
  const [showOnlyApplicants, setShowOnlyApplicants] = useState(false);
  const [changeRosterTimeSlot, setChangeRosterTimeSlot] = useState("A");
  const [rosterAfterSubjectFilter, setRosterAfterSubjectFilter] = useState<string>("전체");
  const [rosterSubjectFilter, setRosterSubjectFilter] = useState<string>("전체");


  const {
    timeSlots, setTimeSlots,
    classCols, setClassCols,
    timetableData, setTimetableData,
    handleTimetablePaste,
    addTimeSlot,
    addClassCol,
    removeTimeSlot,
    removeClassCol,
    updateTimetableCell,
  } = useTimetableData(changeActiveGrade);

  const {
    sampleRawData, setSampleRawData,
    parsedSampleData, setParsedSampleData,
    grade2HistoryData, setGrade2HistoryData,
    grade3Sem1HistoryData, setGrade3Sem1HistoryData,
    extraUploads, setExtraUploads,
    changeUploadNames, setChangeUploadNames,
    handleDeleteSampleUpload,
    handleDeleteExtraUpload,
    handleExtraUpload,
    handleChangeSampleUpload,
  } = useChangeUploads(changeActiveGrade);

  const [electiveChanges, setElectiveChanges] = useState<Record<string, any[]>>({ grade2: [], grade3: [] });
  const [electiveChangesArbitrary, setElectiveChangesArbitrary] = useState<Record<string, any[]>>({ grade2: [], grade3: [] });
  const [enableOptimization, setEnableOptimization] = useState(false);

  const {
    changeParsedCurriculumList, setChangeParsedCurriculumList,
    changeSubjectMap, setChangeSubjectMap,
    changeIsCurriculumParsed, setChangeIsCurriculumParsed,
    changeHierarchyRules, setChangeHierarchyRules,
    handleChangeCurriculumUpload,
    getChangeSubjectCategory,
  } = useChangeCurriculum(changeActiveGrade);

  if (typeof window !== "undefined") {
    (window as any).getChangeBackup = () => ({
    changeActiveGrade,
    changeParsedCurriculumList,
    changeSubjectMap,
    changeIsCurriculumParsed,
    changeHierarchyRules,
    parsedSampleData,
    timetableData,
    electiveChanges,
    timeSlots,
    classCols,
    grade2HistoryData,
    grade3Sem1HistoryData,
    extraUploads,
    changeUploadNames,
    sampleRawData
  });

  (window as any).loadChangeBackup = (parsed: any) => {
    if (parsed.changeActiveGrade) setChangeActiveGrade(parsed.changeActiveGrade);
    if (parsed.changeParsedCurriculumList) setChangeParsedCurriculumList(parsed.changeParsedCurriculumList);
    if (parsed.changeSubjectMap) setChangeSubjectMap(parsed.changeSubjectMap);
    if (parsed.changeIsCurriculumParsed) setChangeIsCurriculumParsed(parsed.changeIsCurriculumParsed);
    if (parsed.changeHierarchyRules) setChangeHierarchyRules(parsed.changeHierarchyRules);
    if (parsed.parsedSampleData) setParsedSampleData(parsed.parsedSampleData);
    if (parsed.sampleRawData) setSampleRawData(parsed.sampleRawData);
    if (parsed.timetableData) setTimetableData(parsed.timetableData);
    if (parsed.electiveChanges) setElectiveChanges(parsed.electiveChanges);
    if (parsed.timeSlots) setTimeSlots(parsed.timeSlots);
    if (parsed.classCols) setClassCols(parsed.classCols);
    if (parsed.grade2HistoryData) {
      if (parsed.grade2HistoryData.grade2 || parsed.grade2HistoryData.grade3) {
        const trimmed: Record<string, Record<string, string[]>> = { grade2: {}, grade3: {} };
        for (const g of ["grade2", "grade3"]) {
          if (parsed.grade2HistoryData[g]) {
            for (const k in parsed.grade2HistoryData[g]) trimmed[g][k.trim()] = parsed.grade2HistoryData[g][k];
          }
        }
        setGrade2HistoryData(trimmed);
      } else {
        const trimmed: Record<string, string[]> = {};
        for (const k in parsed.grade2HistoryData) trimmed[k.trim()] = parsed.grade2HistoryData[k];
        setGrade2HistoryData({ grade2: trimmed, grade3: trimmed });
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
        setGrade3Sem1HistoryData(trimmed);
      } else {
        const trimmed: Record<string, string[]> = {};
        for (const k in parsed.grade3Sem1HistoryData) trimmed[k.trim()] = parsed.grade3Sem1HistoryData[k];
        setGrade3Sem1HistoryData({ grade2: trimmed, grade3: trimmed });
      }
    }
    if (parsed.extraUploads) {
      if (parsed.extraUploads.grade2 || parsed.extraUploads.grade3) {
        setExtraUploads(parsed.extraUploads);
      } else {
        setExtraUploads({ grade2: parsed.extraUploads, grade3: parsed.extraUploads });
      }
    }
    if (parsed.changeUploadNames) {
      setChangeUploadNames(parsed.changeUploadNames);
    }
  };
  }

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveBackup = async () => {
    const fullBackup = {
      version: 2,
      demand: (window as any).getDemandBackup?.() || {},
      main: (window as any).getMainBackup?.() || {},
      change: (window as any).getChangeBackup?.() || {}
    };
    
    const jsonString = JSON.stringify(fullBackup, null, 2);
    const suggestedName = "2026학년도 수요조사 및 선택과목 변경.json";

    try {
      if ('showSaveFilePicker' in window) {
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
      } else {
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = suggestedName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
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
        
        if (parsed.version === 2) {
          (window as any).loadDemandBackup?.(parsed.demand || {});
          (window as any).loadMainBackup?.(parsed.main || {});
          (window as any).loadChangeBackup?.(parsed.change || {});
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

  // --- Global Load Balancer (Auto-Balancing) ---
  useEffect(() => {
    if (!enableOptimization) {
      setElectiveChangesArbitrary(prev => ({ ...prev, [changeActiveGrade]: [] }));
      return;
    }

    const normalizeSubject = (subject: string) => {
      return subject.replace(/\s+/g, '')
        .replace(/Ⅰ/g, 'I')
        .replace(/Ⅱ/g, 'II')
        .replace(/Ⅲ/g, 'III')
        .replace(/Ⅳ/g, 'IV');
    };

    const students = parsedSampleData[changeActiveGrade] || [];
    if (students.length === 0) return;

    const manualChanges = electiveChanges[changeActiveGrade] || [];
    const gradeTimetable = timetableData[changeActiveGrade] || {};
    const gradeTimeSlots = timeSlots[changeActiveGrade] || [];
    const gradeCols = classCols[changeActiveGrade] || [];

    const subjectsInTimeSlot: Record<string, Set<string>> = {};
    gradeTimeSlots.forEach((slot) => {
      subjectsInTimeSlot[slot] = new Set();
      gradeCols.forEach((col) => {
        const subj = gradeTimetable[slot]?.[col]?.subject?.trim();
        if (subj) subjectsInTimeSlot[slot].add(subj);
      });
    });

    const subjectExistsInSlot = (subject: string, slot: string) => {
      const subjects = subjectsInTimeSlot[slot];
      if (!subjects) return false;
      const clean = normalizeSubject(subject);
      for (const s of subjects) {
        const cleanS = normalizeSubject(s);
        if (cleanS === clean || cleanS.includes(clean) || clean.includes(cleanS)) return true;
      }
      return false;
    };

    const vSchedules: Record<string, Record<string, string>> = {};
    const lockedStudents = new Set(manualChanges.map(c => String(c.studentId)));

    students.forEach(s => {
      vSchedules[s.id] = { ...s.timeSlotMap };
    });

    const computeSizes = (schedules: Record<string, Record<string, string>>) => {
      const sizes: Record<string, number> = {};
      Object.entries(schedules).forEach(([sId, sched]) => {
         Object.entries(sched).forEach(([slot, subj]) => {
            const key = slot + "::" + normalizeSubject(subj);
            sizes[key] = (sizes[key] || 0) + 1;
         });
      });
      return sizes;
    };

    const getSubjectStats = (sizes: Record<string, number>) => {
       const subjTotal: Record<string, number> = {};
       const subjSlots: Record<string, Set<string>> = {};
       
       Object.keys(sizes).forEach(key => {
          const [slot, subj] = key.split('::');
          subjTotal[subj] = (subjTotal[subj] || 0) + sizes[key];
          if (!subjSlots[subj]) subjSlots[subj] = new Set();
          subjSlots[subj].add(slot);
       });
       
       const ideal: Record<string, number> = {};
       Object.keys(subjTotal).forEach(subj => {
          ideal[subj] = subjTotal[subj] / subjSlots[subj].size;
       });
       return ideal;
    };

    const calcCost = (sizes: Record<string, number>, ideal: Record<string, number>) => {
       let cost = 0;
       Object.keys(sizes).forEach(key => {
          const [slot, subj] = key.split('::');
          if (ideal[subj]) {
             cost += Math.pow(sizes[key] - ideal[subj], 2);
          }
       });
       return cost;
    };

    const MAX_ITER = 2000;
    let iterations = 0;
    
    let currentSizes = computeSizes(vSchedules);
    const idealSizes = getSubjectStats(currentSizes);
    const generated: any[] = [];

    while (iterations < MAX_ITER) {
       // Calculate deviations for all class slots
       const deviations: { key: string; slot: string; subj: string; diff: number; rawDiff: number }[] = [];
       Object.keys(currentSizes).forEach(key => {
          const [slot, subj] = key.split('::');
          if (idealSizes[subj]) {
             const rawDiff = currentSizes[key] - idealSizes[subj];
             deviations.push({ key, slot, subj, diff: Math.abs(rawDiff), rawDiff });
          }
       });

       // Sort by largest absolute deviation first
       deviations.sort((a, b) => b.diff - a.diff);

       let swapMade = false;

       for (const target of deviations) {
           // Skip if this class is already well-balanced (difference <= 1.0)
           // This prevents the algorithm from making trivial swaps just to fix fractions of a student.
           if (target.diff <= 1.0) continue; 
           
           let bestSwap = null;
           let bestCostReduction = 0;

           for (const s of students) {
              if (lockedStudents.has(String(s.id))) continue;
              
              const sched = vSchedules[s.id];
              const slots = Object.keys(sched);
              
              for (let i = 0; i < slots.length; i++) {
                 for (let j = i + 1; j < slots.length; j++) {
                    const slotA = slots[i];
                    const slotB = slots[j];
                    const subjA = sched[slotA];
                    const subjB = sched[slotB];
                    
                    if (!subjA || !subjB) continue;

                    const normA = normalizeSubject(subjA);
                    const normB = normalizeSubject(subjB);
                    if (normA === normB) continue;
                    
                    // Does this swap involve the target class?
                    const involvesTarget = (slotA === target.slot && normA === target.subj) || 
                                           (slotB === target.slot && normB === target.subj) ||
                                           (slotA === target.slot && normB === target.subj) ||
                                           (slotB === target.slot && normA === target.subj);
                                           
                    if (!involvesTarget) continue;

                    if (subjectExistsInSlot(subjA, slotB) && subjectExistsInSlot(subjB, slotA)) {
                       const sizes = { ...currentSizes };
                       sizes[slotA + "::" + normA]--;
                       sizes[slotB + "::" + normB]--;
                       sizes[slotB + "::" + normA] = (sizes[slotB + "::" + normA] || 0) + 1;
                       sizes[slotA + "::" + normB] = (sizes[slotA + "::" + normB] || 0) + 1;

                       const oldCost = calcCost(currentSizes, idealSizes);
                       const newCost = calcCost(sizes, idealSizes);
                       const reduction = oldCost - newCost;
                       
                       if (reduction > 0.01 && reduction > bestCostReduction) {
                           bestCostReduction = reduction;
                           bestSwap = { studentId: s.id, slotA, slotB, subjA, subjB, normA, normB };
                       }
                    }
                 }
              }
           }

           if (bestSwap) {
              vSchedules[bestSwap.studentId][bestSwap.slotA] = bestSwap.subjB;
              vSchedules[bestSwap.studentId][bestSwap.slotB] = bestSwap.subjA;
              
              currentSizes[bestSwap.slotA + "::" + bestSwap.normA]--;
              currentSizes[bestSwap.slotB + "::" + bestSwap.normB]--;
              currentSizes[bestSwap.slotB + "::" + bestSwap.normA] = (currentSizes[bestSwap.slotB + "::" + bestSwap.normA] || 0) + 1;
              currentSizes[bestSwap.slotA + "::" + bestSwap.normB] = (currentSizes[bestSwap.slotA + "::" + bestSwap.normB] || 0) + 1;
              
              generated.push({
                 id: Date.now() + Math.random().toString(),
                 studentId: bestSwap.studentId,
                 studentName: students.find(s => s.id === bestSwap.studentId)?.name || "",
                 beforeSubject: bestSwap.subjA,
                 afterSubject: bestSwap.subjA,
                 _targetSlot: bestSwap.slotB
              });

              swapMade = true;
              break; 
           }
       }

       if (!swapMade) {
           break; // Local minimum or fully balanced
       }
       iterations++;
    }

    const sortedGenerated = generated.sort((a, b) => {
       const valA = String(a.studentId || "");
       const valB = String(b.studentId || "");
       if (valA === "" && valB !== "") return 1;
       if (valA !== "" && valB === "") return -1;
       return valA.localeCompare(valB);
    });

    setElectiveChangesArbitrary(prev => ({
       ...prev,
       [changeActiveGrade]: sortedGenerated
    }));

  }, [enableOptimization, electiveChanges, parsedSampleData, timetableData, timeSlots, classCols, changeActiveGrade]);

  const adjustmentLog = useMemo(() => {
    const log: Record<string, { beforeStr: string; afterStr: string; status: 'success' | 'failed'; reason?: string; source?: 'applicant' | 'arbitrary' }[]> = {};
    if (!parsedSampleData || (!parsedSampleData.grade2.length && !parsedSampleData.grade3.length) || !electiveChanges) return log;

    (['grade2', 'grade3'] as ('grade2' | 'grade3')[]).forEach(grade => {
      const upperChanges = (electiveChanges[grade] || []).map(c => ({ ...c, source: 'applicant' as const }));
      const lowerChanges = (electiveChangesArbitrary[grade] || []).map(c => ({ ...c, source: 'arbitrary' as const }));
      const changes = [...upperChanges, ...lowerChanges];
      const studentsInGrade = parsedSampleData[grade] || [];
      const gradeTimetable = timetableData[grade] || {};
      const gradeTimeSlots = timeSlots[grade] || [];
      const gradeCols = classCols[grade] || [];

      // Build a map: timeslot -> Set of subjects available in that timeslot
      const subjectsInTimeSlot: Record<string, Set<string>> = {};
      gradeTimeSlots.forEach((slot: string) => {
        subjectsInTimeSlot[slot] = new Set<string>();
        gradeCols.forEach((col: string) => {
          const subj = gradeTimetable[slot]?.[col]?.subject?.trim();
          if (subj) {
            subjectsInTimeSlot[slot].add(subj);
          }
        });
      });

      // Normalize subject names for fuzzy matching
      const normalizeSubject = (subject: string): string => {
        return subject.replace(/\s+/g, '')
          .replace(/Ⅰ/g, 'I')
          .replace(/Ⅱ/g, 'II')
          .replace(/Ⅲ/g, 'III')
          .replace(/Ⅳ/g, 'IV');
      };

      const subjectExistsInSlot = (subject: string, slot: string): boolean => {
        const subjects = subjectsInTimeSlot[slot];
        if (!subjects) return false;
        const clean = normalizeSubject(subject);
        for (const s of subjects) {
          const cleanS = normalizeSubject(s);
          if (cleanS === clean || cleanS.includes(clean) || clean.includes(cleanS)) return true;
        }
        return false;
      };

      const findSlotsWithSubject = (subject: string): string[] => {
        const slots: string[] = [];
        for (const slot of gradeTimeSlots) {
          if (subjectExistsInSlot(subject, slot)) slots.push(slot);
        }
        return slots;
      };

      if (!enableOptimization) {
        // --- 기존 순차 매칭 알고리즘 (Original sequential greedy matching) ---
        const studentSchedules: Record<string, Record<string, string>> = {};

        changes.forEach(c => {
          if (!c.studentId || !c.beforeSubject || !c.afterSubject) return;

          const targetStudent = studentsInGrade.find(s => s.id === c.studentId);
          if (!targetStudent) {
            if (!log[c.studentId]) log[c.studentId] = [];
            log[c.studentId].push({ beforeStr: c.beforeSubject, afterStr: c.afterSubject, status: 'failed', reason: '학생을 찾을 수 없음', source: c.source });
            return;
          }

          if (!studentSchedules[c.studentId]) {
            studentSchedules[c.studentId] = { ...targetStudent.timeSlotMap };
          }
          const currentSchedule = studentSchedules[c.studentId];

          let beforeSlot: string | null = null;
          const cleanBefore = normalizeSubject(c.beforeSubject);
          for (const [slot, subject] of Object.entries(currentSchedule)) {
            const cleanSubject = normalizeSubject(subject as string);
            if (cleanSubject === cleanBefore || cleanSubject.includes(cleanBefore) || cleanBefore.includes(cleanSubject)) {
              beforeSlot = slot;
              break;
            }
          }
          if (!beforeSlot) {
            if (!log[c.studentId]) log[c.studentId] = [];
            log[c.studentId].push({ beforeStr: c.beforeSubject, afterStr: c.afterSubject, status: 'failed', reason: `현재 수강중인 과목이 아님`, source: c.source });
            return;
          }

          if (subjectExistsInSlot(c.afterSubject, beforeSlot)) {
            if (!log[c.studentId]) log[c.studentId] = [];
            log[c.studentId].push({
              beforeStr: `${c.beforeSubject}(${beforeSlot})`,
              afterStr: `${c.afterSubject}(${beforeSlot})`,
              status: 'success',
              source: c.source
            });
            currentSchedule[beforeSlot] = c.afterSubject;
            return;
          }

          let afterSlots = findSlotsWithSubject(c.afterSubject);
          if (c._targetSlot) {
            afterSlots = afterSlots.filter(s => s === c._targetSlot);
          }
          if (afterSlots.length === 0) {
            if (!log[c.studentId]) log[c.studentId] = [];
            log[c.studentId].push({ beforeStr: c.beforeSubject, afterStr: c.afterSubject, status: 'failed', reason: `시간표에 개설되지 않은 과목`, source: c.source });
            return;
          }

          let swapSuccess = false;
          let lastFailedReason = "";

          for (const afterSlot of afterSlots) {
            const studentSubjectInAfterSlot = currentSchedule[afterSlot] as string;
            if (!studentSubjectInAfterSlot) {
              lastFailedReason = `${afterSlot}타임 수강 과목 없음`;
              continue;
            }

            if (subjectExistsInSlot(studentSubjectInAfterSlot, beforeSlot)) {
              if (!log[c.studentId]) log[c.studentId] = [];
              log[c.studentId].push({
                beforeStr: `${studentSubjectInAfterSlot}(${afterSlot})`,
                afterStr: `${studentSubjectInAfterSlot}(${beforeSlot})`,
                status: 'success',
                source: c.source
              });
              log[c.studentId].push({
                beforeStr: `${c.beforeSubject}(${beforeSlot})`,
                afterStr: `${c.afterSubject}(${afterSlot})`,
                status: 'success',
                source: c.source
              });

              currentSchedule[beforeSlot] = studentSubjectInAfterSlot;
              currentSchedule[afterSlot] = c.afterSubject;

              swapSuccess = true;
              break;
            } else {
              lastFailedReason = `2단계 변경 불가: '${studentSubjectInAfterSlot}' 과목이 ${beforeSlot}타임에 개설되지 않음`;
            }
          }

          if (!swapSuccess) {
            if (!log[c.studentId]) log[c.studentId] = [];
            log[c.studentId].push({
              beforeStr: c.beforeSubject,
              afterStr: c.afterSubject,
              status: 'failed',
              reason: afterSlots.length > 1 ? `모든 가능한 타임(${afterSlots.join(', ')})에서 2단계 교환 실패` : lastFailedReason,
              source: c.source
            });
          }
        });
      } else {
        // --- 동적 밸런싱 최적화 알고리즘 (Dynamic Balancing Optimization) ---
        const classSizes: Record<string, number> = {};
        
        // 초기 모든 학생의 반별 인원수 계산
        studentsInGrade.forEach(student => {
          Object.entries(student.timeSlotMap).forEach(([slot, subject]) => {
             const key = `${slot}::${normalizeSubject(subject as string)}`;
             classSizes[key] = (classSizes[key] || 0) + 1;
          });
        });

        // 수강정정 신청자 목록 (고유값)
        const studentsWithChanges = Array.from(new Set(changes.map(c => c.studentId)));
        
        // 신청자별 현재 최적 스케줄 및 로그 관리
        const optimizedSchedules: Record<string, Record<string, string>> = {};
        const optimizedLogs: Record<string, any[]> = {};

        // 1. 초기값: 모든 신청자의 시간표를 원본으로 설정
        studentsWithChanges.forEach(id => {
           const student = studentsInGrade.find(s => s.id === id);
           if (student) optimizedSchedules[id] = { ...student.timeSlotMap };
        });

        let isOptimized = false;
        let iterations = 0;

        // Hill Climbing: 인원수 편차를 최소화하는 방향으로 반복 탐색
        while (!isOptimized && iterations < 5) {
          isOptimized = true;

          studentsWithChanges.forEach(studentId => {
            const student = studentsInGrade.find(s => s.id === studentId);
            if (!student) return;

            // 1. 현재 이 학생이 기여하고 있는 인원수를 뺀다 (시뮬레이션을 위해)
            const currentSched = optimizedSchedules[studentId];
            Object.entries(currentSched).forEach(([slot, subject]) => {
               const key = `${slot}::${normalizeSubject(subject as string)}`;
               if (classSizes[key] > 0) classSizes[key]--;
            });

            // 2. 이 학생의 원래 시간표에서부터 변경 신청을 순차적으로 적용하여 최적의 경로 찾기
            let newSched = { ...student.timeSlotMap };
            const studentLog: any[] = [];
            const studentChanges = changes.filter(c => c.studentId === studentId);

            let bestSequence: { sched: Record<string, string>, logs: any[], maxCost: number, successCount: number } | null = null;

            const dfs = (changeIndex: number, currentSched: Record<string, string>, currentLogs: any[], currentMaxCost: number, successCount: number) => {
              if (changeIndex >= studentChanges.length) {
                if (!bestSequence || 
                    successCount > bestSequence.successCount || 
                    (successCount === bestSequence.successCount && currentMaxCost < bestSequence.maxCost)) {
                  bestSequence = { sched: currentSched, logs: currentLogs, maxCost: currentMaxCost, successCount };
                }
                return;
              }

              const c = studentChanges[changeIndex];
              let beforeSlot: string | null = null;
              const cleanBefore = normalizeSubject(c.beforeSubject);
              for (const [slot, subject] of Object.entries(currentSched)) {
                const cleanSubject = normalizeSubject(subject as string);
                if (cleanSubject === cleanBefore || cleanSubject.includes(cleanBefore) || cleanBefore.includes(cleanSubject)) {
                  beforeSlot = slot;
                  break;
                }
              }

              if (!beforeSlot) {
                dfs(changeIndex + 1, currentSched, [...currentLogs, { beforeStr: c.beforeSubject, afterStr: c.afterSubject, status: 'failed', reason: `현재 수강중인 과목이 아님`, source: c.source }], currentMaxCost, successCount);
                return;
              }

              let afterSlots = findSlotsWithSubject(c.afterSubject);
              if (c._targetSlot) {
                afterSlots = afterSlots.filter(s => s === c._targetSlot);
              }

              if (afterSlots.length === 0) {
                dfs(changeIndex + 1, currentSched, [...currentLogs, { beforeStr: c.beforeSubject, afterStr: c.afterSubject, status: 'failed', reason: `시간표에 개설되지 않은 과목`, source: c.source }], currentMaxCost, successCount);
                return;
              }

              let validChoiceFound = false;
              let lastFailedReason = "";

              for (const afterSlot of afterSlots) {
                if (afterSlot === beforeSlot) {
                   const costKey = `${beforeSlot}::${normalizeSubject(c.afterSubject)}`;
                   const cost = classSizes[costKey] || 0;
                   const nextSched = { ...currentSched };
                   nextSched[beforeSlot] = c.afterSubject;
                   const nextLogs = [...currentLogs];
                   if (c.beforeSubject !== c.afterSubject) {
                     nextLogs.push({ beforeStr: `${c.beforeSubject}(${beforeSlot})`, afterStr: `${c.afterSubject}(${beforeSlot})`, status: 'success', source: c.source });
                   }
                   validChoiceFound = true;
                   dfs(changeIndex + 1, nextSched, nextLogs, Math.max(currentMaxCost, cost), successCount + 1);
                   continue;
                }

                const studentSubjectInAfterSlot = currentSched[afterSlot] as string;
                if (!studentSubjectInAfterSlot) {
                  lastFailedReason = `${afterSlot}타임 수강 과목 없음`;
                  continue;
                }

                if (subjectExistsInSlot(studentSubjectInAfterSlot, beforeSlot)) {
                   const cost1Key = `${afterSlot}::${normalizeSubject(c.afterSubject)}`;
                   const cost2Key = `${beforeSlot}::${normalizeSubject(studentSubjectInAfterSlot)}`;
                   const cost = Math.max(classSizes[cost1Key] || 0, classSizes[cost2Key] || 0);
                   
                   const nextSched = { ...currentSched };
                   nextSched[beforeSlot] = studentSubjectInAfterSlot;
                   nextSched[afterSlot] = c.afterSubject;
                   
                   const nextLogs = [...currentLogs];
                   nextLogs.push({ beforeStr: `${studentSubjectInAfterSlot}(${afterSlot})`, afterStr: `${studentSubjectInAfterSlot}(${beforeSlot})`, status: 'success', source: c.source });
                   nextLogs.push({ beforeStr: `${c.beforeSubject}(${beforeSlot})`, afterStr: `${c.afterSubject}(${afterSlot})`, status: 'success', source: c.source });
                   
                   validChoiceFound = true;
                   dfs(changeIndex + 1, nextSched, nextLogs, Math.max(currentMaxCost, cost), successCount + 1);
                } else {
                   lastFailedReason = `2단계 변경 불가: '${studentSubjectInAfterSlot}' 과목이 ${beforeSlot}타임에 개설되지 않음`;
                }
              }

              if (!validChoiceFound) {
                 dfs(changeIndex + 1, currentSched, [...currentLogs, { beforeStr: c.beforeSubject, afterStr: c.afterSubject, status: 'failed', reason: afterSlots.length > 1 ? `모든 가능한 타임(${afterSlots.join(', ')})에서 교환 실패` : lastFailedReason, source: c.source }], currentMaxCost, successCount);
              }
            };

            dfs(0, { ...student.timeSlotMap }, [], 0, 0);

            const finalSeq: any = bestSequence;
            if (finalSeq) {
               newSched = finalSeq.sched;
               studentLog.push(...finalSeq.logs);
            }

            // 3. 새로 계산된 이 학생의 시간표를 전체 인원수에 다시 더함
            Object.entries(newSched).forEach(([slot, subject]) => {
               const key = `${slot}::${normalizeSubject(subject as string)}`;
               classSizes[key] = (classSizes[key] || 0) + 1;
            });

            // 4. 기존 최적 스케줄과 다른 변동사항이 있으면 아직 완벽히 수렴(최적화)된 게 아님
            if (JSON.stringify(currentSched) !== JSON.stringify(newSched)) {
               isOptimized = false;
            }

            optimizedSchedules[studentId] = newSched;
            optimizedLogs[studentId] = studentLog;
          });

          iterations++;
        }

        // 반복이 끝나면 가장 최적화된 로그를 전체 log 객체에 병합
        studentsWithChanges.forEach(studentId => {
          if (!log[studentId]) log[studentId] = [];
          if (optimizedLogs[studentId]) {
            log[studentId].push(...optimizedLogs[studentId]);
          }
        });
      }
    });

    return log;
  }, [parsedSampleData, electiveChanges, electiveChangesArbitrary, timetableData, timeSlots, classCols, enableOptimization]);

  const handleExportRoster = (isAfter: boolean) => {
    const wb = XLSX.utils.book_new();
    const grade = changeActiveGrade;
    const allStudents = parsedSampleData[grade] || [];
    const tSlots = timeSlots[grade] || [];
    const cols = classCols[grade] || [];
    const gTimetable = timetableData[grade] || {};

    if (tSlots.length === 0) {
      alert("다운로드할 데이터가 없습니다.");
      return;
    }

    tSlots.forEach(timeSlot => {
      const colStudents: Record<string, any[]> = {};
      cols.forEach(col => { colStudents[col] = []; });

      const subjectGroups: Record<string, { col: string, num: number, original: string }[]> = {};
      cols.forEach(col => {
        const cellSubject = gTimetable[timeSlot]?.[col]?.subject?.trim();
        if (!cellSubject) return;

        const match = cellSubject.match(/^(.*?)([\d\s]*)$/);
        const base = match ? match[1].trim() : cellSubject;
        const numMatch = cellSubject.match(/\d+/);
        const num = numMatch ? parseInt(numMatch[0], 10) : 1;

        if (!subjectGroups[base]) subjectGroups[base] = [];
        subjectGroups[base].push({ col, num, original: cellSubject });
      });

      Object.values(subjectGroups).forEach(group => {
        group.sort((a, b) => a.num - b.num);
      });

      const studentsByBase: Record<string, any[]> = {};
      allStudents.forEach(student => {
        const chosenSubject = student.timeSlotMap[timeSlot];
        if (!chosenSubject) return;

        let effectiveSubject = chosenSubject;
        if (isAfter) {
          const studentLogs = adjustmentLog[student.id];
          if (studentLogs) {
            let movedInto = null;
            let movedOut = false;
            for (const entry of studentLogs) {
              if (entry.status !== 'success') continue;
              const beforeMatch = entry.beforeStr.match(/^(.+)\(([^)]+)\)$/);
              const afterMatch = entry.afterStr.match(/^(.+)\(([^)]+)\)$/);
              if (beforeMatch && afterMatch) {
                const logBeforeSubject = beforeMatch[1];
                const logBeforeSlot = beforeMatch[2];
                const logAfterSubject = afterMatch[1];
                const logAfterSlot = afterMatch[2];

                if (logBeforeSlot === timeSlot && logBeforeSubject === chosenSubject) {
                  movedOut = true;
                }
                if (logAfterSlot === timeSlot) {
                  movedInto = logAfterSubject;
                }
              }
            }
            if (movedInto) {
              effectiveSubject = movedInto;
            } else if (movedOut) {
              effectiveSubject = '__REMOVED__';
            }
          }
        }
        if (effectiveSubject === '__REMOVED__') return;

        const cleanChosen = effectiveSubject.replace(/[\sⅠⅡⅢⅣ1234]/g, '').toLowerCase();

        let matchedBase = null;
        let matchedPriority = 999;

        for (const base of Object.keys(subjectGroups)) {
          const cleanBase = base.replace(/[\sⅠⅡⅢⅣ1234]/g, '').toLowerCase();
          if (cleanBase === cleanChosen) {
            matchedBase = base;
            matchedPriority = 1;
            break;
          }
          if (cleanChosen.includes(cleanBase)) {
            matchedBase = base;
            matchedPriority = 2;
          } else if (cleanBase.includes(cleanChosen) && matchedPriority > 2) {
            matchedBase = base;
            matchedPriority = 3;
          }
        }

        if (matchedBase) {
          if (!studentsByBase[matchedBase]) studentsByBase[matchedBase] = [];
          studentsByBase[matchedBase].push(student);
        }
      });

      Object.keys(subjectGroups).forEach(base => {
        const students = studentsByBase[base] || [];
        students.sort((a, b) => {
          const numA = parseInt(a.id) || 0;
          const numB = parseInt(b.id) || 0;
          return numA - numB;
        });

        const group = subjectGroups[base];
        const numClasses = group.length;
        if (numClasses === 0) return;

        const baseSize = Math.floor(students.length / numClasses);
        let remainder = students.length % numClasses;

        let studentIndex = 0;
        group.forEach(classInfo => {
          let classSize = baseSize;
          if (remainder > 0) {
            classSize += 1;
            remainder -= 1;
          }
          const assigned = students.slice(studentIndex, studentIndex + classSize);
          colStudents[classInfo.col] = assigned;
          studentIndex += classSize;
        });
      });

      const maxRows = Math.max(0, ...Object.values(colStudents).map(arr => arr.length));
      const wsData: any[][] = [];

      const row1: any[] = ["과목명"];
      const row2: any[] = ["강의실"];
      const row3: any[] = ["교사"];
      const row4: any[] = ["순번"];
      const merges: any[] = [];

      let currentColIdx = 1;
      cols.forEach((col, idx) => {
        const teacher = gTimetable[timeSlot]?.[col]?.teacher || "-";
        const subject = gTimetable[timeSlot]?.[col]?.subject || "-";

        row1.push(subject, "");
        row2.push(col, "");
        row3.push(teacher, "");
        row4.push("학번", "이름");

        merges.push({ s: { r: 0, c: currentColIdx }, e: { r: 0, c: currentColIdx + 1 } });
        merges.push({ s: { r: 1, c: currentColIdx }, e: { r: 1, c: currentColIdx + 1 } });
        merges.push({ s: { r: 2, c: currentColIdx }, e: { r: 2, c: currentColIdx + 1 } });
        currentColIdx += 2;
      });

      wsData.push(row1, row2, row3, row4);

      for (let i = 0; i < maxRows; i++) {
        const dataRow: any[] = [i + 1];
        cols.forEach(col => {
          const student = colStudents[col][i];
          if (student) {
            dataRow.push(student.id, student.name);
          } else {
            dataRow.push("", "");
          }
        });
        wsData.push(dataRow);
      }

      const totalRow: any[] = ["총 인원"];
      let tColIdx = 1;
      cols.forEach(col => {
        const count = colStudents[col].length;
        totalRow.push(`${count}명`, "");
        merges.push({ s: { r: wsData.length, c: tColIdx }, e: { r: wsData.length, c: tColIdx + 1 } });
        tColIdx += 2;
      });
      wsData.push(totalRow);

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!merges'] = merges;

      for (const cell in ws) {
        if (cell[0] === '!') continue;
        if (!ws[cell].s) ws[cell].s = {};
        ws[cell].s = {
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } }
          }
        };
      }

      const wscols = [{ wpx: 60 }];
      for (let i = 0; i < cols.length * 2; i++) {
        wscols.push({ wpx: 80 });
      }
      ws['!cols'] = wscols;

      XLSX.utils.book_append_sheet(wb, ws, `${timeSlot}타임`);
    });

    const prefix = grade === 'grade2' ? '2학년' : '3학년';
    const suffix = isAfter ? '5단계_변경후명단' : '3단계_변경전명단';
    XLSX.writeFile(wb, `${prefix}_${suffix}.xlsx`);
  };

  const handleExportAttendanceRoster = () => {
    const wb = XLSX.utils.book_new();
    const grade = changeActiveGrade;
    const allStudents = parsedSampleData[grade] || [];
    const tSlots = timeSlots[grade] || [];
    const cols = classCols[grade] || [];
    const gTimetable = timetableData[grade] || {};

    if (tSlots.length === 0) {
      alert("다운로드할 데이터가 없습니다.");
      return;
    }

    const wsData: any[][] = [];

    const headerRow: any[] = ["학년", "반"];
    tSlots.forEach(t => headerRow.push(`${t}타임`));
    headerRow.push("교사", "타임", "과목");
    for (let i = 1; i <= 34; i++) headerRow.push(`${i}`);
    for (let i = 1; i <= 34; i++) headerRow.push(`학번${i}`);
    wsData.push(headerRow);

    const tempRows: { gradeNum: number, classNum: number, timeSlot: string, row: any[] }[] = [];

    tSlots.forEach(timeSlot => {
      const colStudents: Record<string, any[]> = {};
      cols.forEach(col => { colStudents[col] = []; });

      const subjectGroups: Record<string, { col: string, num: number, original: string }[]> = {};
      cols.forEach(col => {
        const cellSubject = gTimetable[timeSlot]?.[col]?.subject?.trim();
        if (!cellSubject) return;

        const match = cellSubject.match(/^(.*?)([\d\s]*)$/);
        const base = match ? match[1].trim() : cellSubject;
        const numMatch = cellSubject.match(/\d+/);
        const num = numMatch ? parseInt(numMatch[0], 10) : 1;

        if (!subjectGroups[base]) subjectGroups[base] = [];
        subjectGroups[base].push({ col, num, original: cellSubject });
      });

      Object.values(subjectGroups).forEach(group => {
        group.sort((a, b) => a.num - b.num);
      });

      const studentsByBase: Record<string, any[]> = {};
      allStudents.forEach(student => {
        const chosenSubject = student.timeSlotMap[timeSlot];
        if (!chosenSubject) return;

        let effectiveSubject = chosenSubject;
        const studentLogs = adjustmentLog[student.id];
        if (studentLogs) {
          let movedInto = null;
          let movedOut = false;
          for (const entry of studentLogs) {
            if (entry.status !== 'success') continue;
            const beforeMatch = entry.beforeStr.match(/^(.+)\(([^)]+)\)$/);
            const afterMatch = entry.afterStr.match(/^(.+)\(([^)]+)\)$/);
            if (beforeMatch && afterMatch) {
              const logBeforeSubject = beforeMatch[1];
              const logBeforeSlot = beforeMatch[2];
              const logAfterSubject = afterMatch[1];
              const logAfterSlot = afterMatch[2];

              if (logBeforeSlot === timeSlot && logBeforeSubject === chosenSubject) {
                movedOut = true;
              }
              if (logAfterSlot === timeSlot) {
                movedInto = logAfterSubject;
              }
            }
          }
          if (movedInto) {
            effectiveSubject = movedInto;
          } else if (movedOut) {
            effectiveSubject = '__REMOVED__';
          }
        }
        if (effectiveSubject === '__REMOVED__') return;

        const cleanChosen = effectiveSubject.replace(/[\sⅠⅡⅢⅣ1234]/g, '').toLowerCase();
        let matchedBase = null;
        let matchedPriority = 999;

        for (const base of Object.keys(subjectGroups)) {
          const cleanBase = base.replace(/[\sⅠⅡⅢⅣ1234]/g, '').toLowerCase();
          if (cleanBase === cleanChosen) {
            matchedBase = base;
            matchedPriority = 1;
            break;
          }
          if (cleanChosen.includes(cleanBase)) {
            matchedBase = base;
            matchedPriority = 2;
          } else if (cleanBase.includes(cleanChosen) && matchedPriority > 2) {
            matchedBase = base;
            matchedPriority = 3;
          }
        }

        if (matchedBase) {
          if (!studentsByBase[matchedBase]) studentsByBase[matchedBase] = [];
          studentsByBase[matchedBase].push(student);
        }
      });

      Object.keys(subjectGroups).forEach(base => {
        const students = studentsByBase[base] || [];
        students.sort((a, b) => {
          const numA = parseInt(a.id) || 0;
          const numB = parseInt(b.id) || 0;
          return numA - numB;
        });

        const group = subjectGroups[base];
        const numClasses = group.length;
        if (numClasses === 0) return;

        const baseSize = Math.floor(students.length / numClasses);
        let remainder = students.length % numClasses;

        let studentIndex = 0;
        group.forEach(classInfo => {
          let classSize = baseSize;
          if (remainder > 0) {
            classSize += 1;
            remainder -= 1;
          }
          const assigned = students.slice(studentIndex, studentIndex + classSize);
          colStudents[classInfo.col] = assigned;
          studentIndex += classSize;
        });
      });

      cols.forEach(col => {
        const teacher = gTimetable[timeSlot]?.[col]?.teacher || "-";
        const subjectRaw = gTimetable[timeSlot]?.[col]?.subject;
        if (!subjectRaw) return;
        
        const match = subjectRaw.match(/^(.*?)([\d\s]*)$/);
        const baseSubject = match ? match[1].trim() : subjectRaw;

        const students = colStudents[col] || [];
        
        let gradeStr = "";
        let classStr = "";
        const colMatch = col.match(/^(\d+)-(\d+)$/);
        if (colMatch) {
          gradeStr = colMatch[1];
          classStr = colMatch[2];
        } else {
          gradeStr = col;
        }
        
        const row: any[] = [gradeStr, classStr];
        tSlots.forEach(t => {
          if (t === timeSlot) {
            row.push(baseSubject);
          } else {
            row.push("");
          }
        });
        row.push(teacher, timeSlot, baseSubject);
        
        for (let i = 0; i < 34; i++) {
          row.push(students[i] ? students[i].name : "");
        }
        for (let i = 0; i < 34; i++) {
          row.push(students[i] ? students[i].id : "");
        }
        
        tempRows.push({
          gradeNum: parseInt(gradeStr) || 0,
          classNum: parseInt(classStr) || 0,
          timeSlot: timeSlot,
          row: row
        });
      });
    });

    tempRows.sort((a, b) => {
      if (a.gradeNum !== b.gradeNum) return a.gradeNum - b.gradeNum;
      if (a.classNum !== b.classNum) return a.classNum - b.classNum;
      return a.timeSlot.localeCompare(b.timeSlot);
    });

    tempRows.forEach(item => wsData.push(item.row));

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    for (const cell in ws) {
      if (cell[0] === '!') continue;
      if (!ws[cell].s) ws[cell].s = {};
      ws[cell].s = {
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } }
        }
      };
    }

    const prefix = grade === 'grade2' ? '2학년' : '3학년';
    XLSX.utils.book_append_sheet(wb, ws, `출석부 명단`);
    XLSX.writeFile(wb, `출석부 표지 명단(${prefix}).xlsx`);
  };

  const handleExportChanges = () => {
    const grade = changeActiveGrade;
    const gradeNum = grade === 'grade2' ? '2' : '3';
    
    const dataApplicant = electiveChanges[grade] || [];
    const studentsApplicant = Array.from(new Set(dataApplicant.map(d => d.studentId))).filter(id => id).sort((a, b) => String(a).localeCompare(String(b)));
    
    const dataArbitrary = electiveChangesArbitrary[grade] || [];
    const studentsArbitrary = Array.from(new Set(dataArbitrary.map(d => d.studentId))).filter(id => id).sort((a, b) => String(a).localeCompare(String(b)));

    const createSheet = (title: string, students: string[], dataSrc: any[], sourceFilter: string) => {
      const rows: any[][] = [];
      const merges: any[] = [];
      let changeIndex = 1;
      let count = 0;
      
      students.forEach(studentId => {
        const logs = adjustmentLog[studentId] || [];
        const studentName = dataSrc.find(d => d.studentId === studentId)?.studentName || "";
        const validLogs = logs.filter(log => log.status === 'success' && log.source === sourceFilter);

        if (validLogs.length > 0) {
          validLogs.forEach((log, index) => {
            rows.push([
              index === 0 ? changeIndex : "",
              index === 0 ? studentId : "",
              index === 0 ? studentName : "",
              log.beforeStr,
              "→",
              log.afterStr
            ]);
          });

          if (validLogs.length > 1) {
            const startRow = rows.length - validLogs.length + 2;
            const endRow = rows.length + 1;
            merges.push({ s: { r: startRow, c: 0 }, e: { r: endRow, c: 0 } });
            merges.push({ s: { r: startRow, c: 1 }, e: { r: endRow, c: 1 } });
            merges.push({ s: { r: startRow, c: 2 }, e: { r: endRow, c: 2 } });
          }
          changeIndex++;
          count++;
        }
      });

      if (count === 0) return null;

      const wsData = [
        [`${title} (${count}명)`, "", "", "", "", ""],
        ["순번", "학번", "이름", "변경전", "→", "변경후"],
        ...rows
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } });
      ws['!merges'] = merges;

      for (const cell in ws) {
        if (cell[0] === '!') continue;
        if (!ws[cell].s) ws[cell].s = {};

        const rowIndex = parseInt(cell.replace(/\D/g, '')) - 1;

        ws[cell].s = {
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } }
          }
        };

        if (rowIndex === 0) {
          ws[cell].s.font = { sz: 16, bold: true };
        } else if (rowIndex === 1) {
          ws[cell].s.font = { bold: true };
        }
      }

      ws['!cols'] = [
        { wpx: 40 },
        { wpx: 70 },
        { wpx: 80 },
        { wpx: 180 },
        { wpx: 30 },
        { wpx: 180 },
      ];

      return ws;
    };

    const wsApplicant = createSheet(`${gradeNum}학년 2학기 수동 신청 변경 내역`, studentsApplicant, dataApplicant, 'applicant');
    const wsArbitrary = createSheet(`${gradeNum}학년 2학기 인원 균등 분배 임의 변경 내역`, studentsArbitrary, dataArbitrary, 'arbitrary');

    if (!wsApplicant && !wsArbitrary) {
      alert("다운로드할 변경 내역이 없습니다.");
      return;
    }

    const wb = XLSX.utils.book_new();
    if (wsApplicant) XLSX.utils.book_append_sheet(wb, wsApplicant, "신청자 변경내역");
    if (wsArbitrary) XLSX.utils.book_append_sheet(wb, wsArbitrary, "임의 변경내역");
    
    XLSX.writeFile(wb, `${gradeNum}학년_선택과목_변경내역.xlsx`);
  };

  const step6Data = useMemo(() => {
    if (changeActiveTab !== "analysis") return [];

    const students = parsedSampleData[changeActiveGrade];
    if (!students || students.length === 0) return [];

    const currentRules = changeHierarchyRules[changeActiveGrade] || [];

    const processed = students.map((student) => {
      let completedBefore: string[] = [];
      if (changeActiveGrade === "grade2") {
        const dataMap = grade2HistoryData.grade2 || {};
        completedBefore = dataMap[String(student.id).trim()] || dataMap[student.id] || [];
      } else {
        const g2Map = grade2HistoryData.grade3 || {};
        const g3Map = grade3Sem1HistoryData.grade3 || {};
        const g2History = g2Map[String(student.id).trim()] || g2Map[student.id] || [];
        const g3Sem1History = g3Map[String(student.id).trim()] || g3Map[student.id] || [];
        completedBefore = [...g2History, ...g3Sem1History];
      }

      const currentSubjects: string[] = [];
      const currentSubjectsMap: Record<string, string> = {};
      const timeSlotsForGrade = timeSlots[changeActiveGrade];

      timeSlotsForGrade.forEach(slot => {
        let chosenSubject = student.timeSlotMap[slot];
        if (!chosenSubject) return;

        let effectiveSubject = chosenSubject;
        const studentLogs = adjustmentLog[student.id];
        if (studentLogs) {
          let movedInto = null;
          let movedOut = false;
          for (const entry of studentLogs) {
            if (entry.status !== 'success') continue;
            let logBeforeSubject = entry.beforeStr;
            let logBeforeSlot = '';
            let logAfterSubject = entry.afterStr;
            let logAfterSlot = '';
            
            for (const s of timeSlotsForGrade) {
              if (entry.beforeStr.endsWith(`(${s})`)) {
                logBeforeSubject = entry.beforeStr.slice(0, -(s.length + 2));
                logBeforeSlot = s;
                break;
              }
            }
            if (!logBeforeSlot) {
              const bMatch = entry.beforeStr.match(/^(.+)\(([^)]+)\)$/);
              if (bMatch) { logBeforeSubject = bMatch[1]; logBeforeSlot = bMatch[2]; }
            }

            for (const s of timeSlotsForGrade) {
              if (entry.afterStr.endsWith(`(${s})`)) {
                logAfterSubject = entry.afterStr.slice(0, -(s.length + 2));
                logAfterSlot = s;
                break;
              }
            }
            if (!logAfterSlot) {
              const aMatch = entry.afterStr.match(/^(.+)\(([^)]+)\)$/);
              if (aMatch) { logAfterSubject = aMatch[1]; logAfterSlot = aMatch[2]; }
            }

            if (logBeforeSlot && logAfterSlot) {
              const norm = (s: string) => s.replace(/\s+/g, '').replace(/Ⅰ/g, 'I').replace(/Ⅱ/g, 'II').replace(/Ⅲ/g, 'III');
              if (logBeforeSlot === slot && norm(logBeforeSubject) === norm(chosenSubject as string)) movedOut = true;
              if (logAfterSlot === slot) movedInto = logAfterSubject;
            }
          }
          if (movedInto) effectiveSubject = movedInto;
          else if (movedOut) effectiveSubject = '__REMOVED__';
        }

        if (effectiveSubject && effectiveSubject !== '__REMOVED__') {
          currentSubjects.push(effectiveSubject);
          currentSubjectsMap[slot] = effectiveSubject;
        } else {
          currentSubjectsMap[slot] = '';
        }
      });

      let basicCount = 0;
      let socialCount = 0;
      let scienceCount = 0;

      const prevGradeKey = changeActiveGrade === "grade2" ? "grade1" : "grade2";
      completedBefore.forEach(prevSubj => {
        const matchedCategory = getChangeSubjectCategory(prevSubj, prevGradeKey);
        if (matchedCategory === "기초") basicCount++;
        if (matchedCategory === "사회") socialCount++;
        if (matchedCategory === "과학") scienceCount++;
      });

      currentSubjects.forEach(subject => {
        const matchedCategory = getChangeSubjectCategory(subject, changeActiveGrade as any);
        if (matchedCategory === "기초") basicCount++;
        if (matchedCategory === "사회") socialCount++;
        if (matchedCategory === "과학") scienceCount++;
      });

      const subjectCounts: Record<string, number> = {};
      currentSubjects.forEach(s => {
        subjectCounts[s] = (subjectCounts[s] || 0) + 1;
      });
      const duplicateSubjects = Object.keys(subjectCounts).filter(s => subjectCounts[s] > 1);

      const hierarchyViolations: { subject: string; prereq: string; message: string }[] = [];

      currentRules.forEach(rule => {
        const normAdvanced = normalizeSubjectName(rule.advanced);
        const normPrereq = normalizeSubjectName(rule.prereq);

        const hasAdvanced = currentSubjects.some(s => normalizeSubjectName(s) === normAdvanced) ||
          completedBefore.some(s => normalizeSubjectName(s) === normAdvanced);

        const hasPrereqInPast = completedBefore.some(s => normalizeSubjectName(s) === normPrereq);

        if (hasAdvanced && !hasPrereqInPast) {
          hierarchyViolations.push({ subject: rule.advanced, prereq: rule.prereq, message: `권장 이수 순서: ${rule.prereq} -> ${rule.advanced}` });
        }
      });

      return {
        id: student.id,
        name: student.name,
        completedBefore,
        currentSubjects,
        currentSubjectsMap,
        basicCount,
        socialCount,
        scienceCount,
        duplicateSubjects,
        hierarchyViolations
      };
    });

    processed.sort((a, b) => parseInt(a.id) - parseInt(b.id));
    return processed;
  }, [changeActiveTab, parsedSampleData, changeActiveGrade, grade2HistoryData, grade3Sem1HistoryData, adjustmentLog, changeHierarchyRules, timeSlots, getChangeSubjectCategory]);

  const handleDownloadRiroschool = (grade: "grade2" | "grade3") => {
    const rawData = sampleRawData[grade];
    if (!rawData) {
      alert("원본 엑셀 데이터가 없습니다. 2단계에서 파일을 다시 업로드해주세요.");
      return;
    }

    try {
      const wb = XLSX.read(rawData, { type: "binary" });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
      if (json.length < 2) {
        alert("데이터 형식이 올바르지 않습니다.");
        return;
      }
      
      const subjectHeaders = json[1];
      const norm = (s: string) => s.replace(/\s+/g, '').replace(/Ⅰ/g, 'I').replace(/Ⅱ/g, 'II').replace(/Ⅲ/g, 'III');
      const subjectColMap: Record<string, number> = {};
      
      for (let c = 8; c < subjectHeaders.length; c++) {
        if (subjectHeaders[c]) {
          subjectColMap[norm(String(subjectHeaders[c]).trim())] = c;
        }
      }

      for (let r = 2; r < json.length; r++) {
        const row = json[r];
        if (!row || row.length === 0 || !row[1]) continue;
        const studentId = String(row[1]).trim();
        
        const logs = adjustmentLog[studentId];
        const hasChanges = logs && logs.some(l => l.status === 'success' && (l.source === 'applicant' || l.source === 'arbitrary'));
        
        if (hasChanges) {
          const studentInitData = parsedSampleData[grade].find(s => s.id === studentId);
          if (!studentInitData) continue;
          
          let finalTimeSlotMap = { ...studentInitData.timeSlotMap };
          
          logs.forEach(l => {
            if (l.status !== 'success' || (l.source !== 'applicant' && l.source !== 'arbitrary')) return;
            
            let beforeSubj = l.beforeStr;
            let afterSubj = l.afterStr;
            let beforeSlot = "";
            let afterSlot = "";
            
            const timeSlotsForGrade = timeSlots[grade] || [];
            for (const slot of timeSlotsForGrade) {
              if (l.beforeStr.endsWith(`(${slot})`)) {
                beforeSubj = l.beforeStr.slice(0, -(slot.length + 2));
                beforeSlot = slot;
              }
              if (l.afterStr.endsWith(`(${slot})`)) {
                afterSubj = l.afterStr.slice(0, -(slot.length + 2));
                afterSlot = slot;
              }
            }
            if (!beforeSlot) {
              const match = l.beforeStr.match(/^(.+)\(([^)]+)\)$/);
              if (match) { beforeSubj = match[1]; beforeSlot = match[2]; }
            }
            if (!afterSlot) {
              const match = l.afterStr.match(/^(.+)\(([^)]+)\)$/);
              if (match) { afterSubj = match[1]; afterSlot = match[2]; }
            }
            
            if (beforeSlot && finalTimeSlotMap[beforeSlot] && norm(finalTimeSlotMap[beforeSlot]) === norm(beforeSubj)) {
              delete finalTimeSlotMap[beforeSlot];
            }
            if (afterSlot) {
              finalTimeSlotMap[afterSlot] = afterSubj;
            }
          });
          
          const range = XLSX.utils.decode_range(sheet['!ref'] || "A1:A1");
          for (let c = 8; c <= range.e.c; c++) {
            const cellRef = XLSX.utils.encode_cell({ r, c });
            if (sheet[cellRef]) {
              delete sheet[cellRef];
            }
          }
          
          Object.entries(finalTimeSlotMap).forEach(([slot, subj]) => {
            const col = subjectColMap[norm(subj)];
            if (col !== undefined) {
              sheet[XLSX.utils.encode_cell({ r, c: col })] = { t: 's', v: slot };
            }
          });
        }
      }

      XLSX.writeFile(wb, `${grade === 'grade2' ? '2학년' : '3학년'}_리로스쿨_업로드용_최종.xlsx`);
    } catch (e) {
      console.error(e);
      alert("엑셀 생성 중 오류가 발생했습니다.");
    }
  };

  const handleExportStep6 = () => {
    if (step6Data.length === 0) return;

    const aoa: any[][] = [];
    const gradeNum = changeActiveGrade === "grade2" ? 2 : 3;

    aoa.push([`${gradeNum}학년 다년도 분석 결과`]);
    const timeSlotsForGrade = timeSlots[changeActiveGrade] || [];
    
    aoa.push([
      "순번", "학번", "이름", "과거 이수 과목", "2학기 과목", ...timeSlotsForGrade.slice(1).map(() => ""), "기초과목", "사회", "과학", "비고(중복/위계)"
    ]);
    aoa.push([
      "", "", "", "", ...timeSlotsForGrade, "", "", "", ""
    ]);

    step6Data.forEach((student, idx) => {
      const remarks: string[] = [];
      if (student.basicCount >= 10) remarks.push("기초과목 최대학점 초과");
      if (student.duplicateSubjects?.length) remarks.push(`중복: ${student.duplicateSubjects.join(", ")}`);
      if (student.hierarchyViolations?.length) remarks.push(student.hierarchyViolations.map((v: any) => v.message).join(", "));

      aoa.push([
        idx + 1,
        student.id,
        student.name,
        student.completedBefore.join(", "),
        ...timeSlotsForGrade.map(slot => student.currentSubjectsMap?.[slot] || ""),
        student.basicCount || 0,
        student.socialCount || 0,
        student.scienceCount || 0,
        remarks.join(" / ")
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    const tc = 4 + timeSlotsForGrade.length;
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: tc + 3 } },
      { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } },
      { s: { r: 1, c: 1 }, e: { r: 2, c: 1 } },
      { s: { r: 1, c: 2 }, e: { r: 2, c: 2 } },
      { s: { r: 1, c: 3 }, e: { r: 2, c: 3 } },
      { s: { r: 1, c: 4 }, e: { r: 1, c: tc - 1 } },
      { s: { r: 1, c: tc }, e: { r: 2, c: tc } },
      { s: { r: 1, c: tc + 1 }, e: { r: 2, c: tc + 1 } },
      { s: { r: 1, c: tc + 2 }, e: { r: 2, c: tc + 2 } },
      { s: { r: 1, c: tc + 3 }, e: { r: 2, c: tc + 3 } }
    ];

    ws["!cols"] = [
      { wch: 6 }, { wch: 10 }, { wch: 10 }, { wch: 40 }, ...timeSlotsForGrade.map(() => ({ wch: 12 })), { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 40 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "다년도분석");
    XLSX.writeFile(wb, `${gradeNum}학년_다년도분석결과.xlsx`);
  };
  const handleExportTimetable = () => {
    const gradeLabel = changeActiveGrade === "grade2" ? "2학년" : "3학년";
    const gradeData = timetableData[changeActiveGrade];
    if (!gradeData) return;

    const cols = classCols[changeActiveGrade] || [];
    const slots = timeSlots[changeActiveGrade] || [];

    const aoa = [];
    
    // Title
    aoa.push([`${gradeLabel} 타임별 시간표`]);
    aoa.push([]);

    // Headers
    const headerRow = ["타임", ...cols];
    aoa.push(headerRow);

    // Data
    slots.forEach(slot => {
      const row1 = [slot]; // Subject row
      const row2 = [""];   // Teacher row
      cols.forEach(col => {
        const subject = gradeData[slot]?.[col]?.subject || "";
        const teacher = gradeData[slot]?.[col]?.teacher || "";
        
        row1.push(subject);
        row2.push(teacher);
      });
      aoa.push(row1);
      aoa.push(row2);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    const merges = [];
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: cols.length } }); // Title

    // Merge time col for each slot
    let currentR = 3;
    slots.forEach(() => {
      merges.push({ s: { r: currentR, c: 0 }, e: { r: currentR + 1, c: 0 } });
      currentR += 2;
    });

    ws["!merges"] = merges;

    // Styles
    const range = XLSX.utils.decode_range(ws["!ref"]!);
    const borderAll = {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    };
    const centerAlign = { vertical: "center", horizontal: "center", wrapText: true };
    const headerFill = { fgColor: { rgb: "E0E7FF" } }; // Light Indigo
    const timeColFill = { fgColor: { rgb: "F1F5F9" } }; // Slate 100

    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };

        ws[cellRef].s = {
          font: { name: "맑은 고딕", sz: 11, color: { rgb: "000000" } },
          alignment: centerAlign,
          border: borderAll
        };

        if (R === 0) {
          ws[cellRef].s.font.sz = 16;
          ws[cellRef].s.font.bold = true;
          ws[cellRef].s.border = {};
        } else if (R === 1) {
          ws[cellRef].s.border = {};
        } else if (R === 2) {
          ws[cellRef].s.fill = headerFill;
          ws[cellRef].s.font.bold = true;
        } else if (C === 0 && R > 2) {
          ws[cellRef].s.fill = timeColFill;
          ws[cellRef].s.font.bold = true;
        }

        // Bold the subject row (odd rows starting from 3)
        if (R % 2 === 1 && R >= 3 && C > 0) {
          ws[cellRef].s.font.bold = true;
        }
      }
    }

    // Col width
    const colWidths = [{ wch: 10 }];
    cols.forEach(() => {
      colWidths.push({ wch: 18 });
    });
    ws["!cols"] = colWidths;
    
    // Row height
    const rowHeights = [];
    for(let i=0; i<=range.e.r; i++) {
        if(i > 2) rowHeights.push({ hpt: 20 }); // Reset back to standard height since it's separate rows now
        else rowHeights.push({ hpt: 20 });
    }
    ws["!rows"] = rowHeights;

    XLSX.utils.book_append_sheet(wb, ws, "타임별시간표");
    XLSX.writeFile(wb, `${gradeLabel}_타임별시간표.xlsx`);
  };

  return ( <>
        {/* Global Header */}
        <header className="flex-none px-10 py-5 border-b border-slate-800/30 bg-slate-950/40 backdrop-blur-sm flex flex-col gap-4">
          <div className="flex items-center justify-between w-full">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              명신고등학교 선택과목 변경 시스템
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
                className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 hover:bg-slate-700/80 text-slate-200 text-sm font-medium rounded-xl transition-all border border-slate-700/60 shadow-sm"
              >
                <FolderOpen className="w-4 h-4" />
                불러오기
              </button>
              <button
                onClick={handleSaveBackup}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600/80 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-all border border-indigo-500/50 shadow-md shadow-indigo-500/20"
              >
                <Save className="w-4 h-4" />
                저장하기
              </button>
            </div>
          </div>
          
          <div className="w-full">
            <div className="flex gap-2 p-1 bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-800/50 w-fit overflow-x-auto max-w-[calc(100vw-120px)] scrollbar-hide">
                  <button onClick={() => setChangeActiveTab('basic')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${changeActiveTab === 'basic' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">1단계</span><div className="flex items-center gap-1.5"><Settings className="w-4 h-4" /><span>기초자료 입력</span></div></button>
                  <button onClick={() => setChangeActiveTab('upload')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${changeActiveTab === 'upload' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">2단계</span><div className="flex items-center gap-1.5"><Upload className="w-4 h-4" /><span>데이터 업로드</span></div></button>
                  <button onClick={() => setChangeActiveTab('timetable')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${changeActiveTab === 'timetable' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">3단계</span><div className="flex items-center gap-1.5"><Settings className="w-4 h-4" /><span>타임별 시간표 입력</span></div></button>
                  <button onClick={() => setChangeActiveTab('roster')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${changeActiveTab === 'roster' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">4단계</span><div className="flex items-center gap-1.5"><Users className="w-4 h-4" /><span>타임별 학생 명단</span></div></button>
                  <button onClick={() => setChangeActiveTab('application')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${changeActiveTab === 'application' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">5단계</span><div className="flex items-center gap-1.5"><FileText className="w-4 h-4" /><span>선택과목 변경 데이터 입력</span></div></button>
                  <button onClick={() => setChangeActiveTab('roster_after')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${changeActiveTab === 'roster_after' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">6단계</span><div className="flex items-center gap-1.5"><Users className="w-4 h-4" /><span>변경 후 타임별 학생 명단</span></div></button>
                  <button onClick={() => setChangeActiveTab('analysis')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${changeActiveTab === 'analysis' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">7단계</span><div className="flex items-center gap-1.5"><FileText className="w-4 h-4" /><span>다년도 분석</span></div></button>
                  <button onClick={() => setChangeActiveTab('riroschool')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${changeActiveTab === 'riroschool' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">8단계</span><div className="flex items-center gap-1.5"><Download className="w-4 h-4" /><span>리로스쿨용 파일</span></div></button>
                </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 pb-24">
          <div className="w-full mx-auto">

                <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/60 rounded-3xl p-8 shadow-2xl">
                                    {changeActiveTab === "basic" && (
                    <BasicStep
                      changeActiveGrade={changeActiveGrade}
                      setChangeActiveGrade={setChangeActiveGrade}
                      handleChangeCurriculumUpload={handleChangeCurriculumUpload}
                      changeIsCurriculumParsed={changeIsCurriculumParsed}
                      changeParsedCurriculumList={changeParsedCurriculumList}
                      changeSubjectMap={changeSubjectMap}
                      changeHierarchyRules={changeHierarchyRules}
                      setChangeHierarchyRules={setChangeHierarchyRules}
                      setChangeActiveTab={setChangeActiveTab}
                    />
                  )}

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
                    />
                  )}

                  {changeActiveTab === "timetable" && (
                    <TimetableStep
                      changeActiveGrade={changeActiveGrade}
                      setChangeActiveGrade={setChangeActiveGrade}
                      handleExportTimetable={handleExportTimetable}
                      addTimeSlot={addTimeSlot}
                      addClassCol={addClassCol}
                      removeClassCol={removeClassCol}
                      removeTimeSlot={removeTimeSlot}
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
                      setEnableOptimization={setEnableOptimization}
                      handleExportChanges={handleExportChanges}
                      adjustmentLog={adjustmentLog}
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
