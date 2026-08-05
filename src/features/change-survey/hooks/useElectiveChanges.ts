import { useEffect, useMemo, useState } from "react";
import type { ChangeGradeKey, ElectiveChange, GradeStringArrays, TimetableData } from "../types";
import type { StudentTimeData } from "../../../types";

const normalizeSubject = (subject: string): string => {
  return subject.replace(/\s+/g, '')
    .replace(/Ⅰ/g, 'I')
    .replace(/Ⅱ/g, 'II')
    .replace(/Ⅲ/g, 'III')
    .replace(/Ⅳ/g, 'IV');
};

export interface ChangeLogEntry {
  beforeStr: string;
  afterStr: string;
  status: 'success' | 'failed';
  reason?: string;
  source?: 'applicant' | 'arbitrary';
  pinned?: boolean;
}

interface PreConfirmSnapshot {
  confirmedLog: Record<string, ChangeLogEntry[]>;
  confirmedBaseSchedules: Record<string, Record<string, string>>;
  electiveChanges: ElectiveChange[];
  electiveChangesArbitrary: ElectiveChange[];
}

export function useElectiveChanges(
  changeActiveGrade: ChangeGradeKey,
  parsedSampleData: { grade2: StudentTimeData[]; grade3: StudentTimeData[] },
  timetableData: TimetableData,
  timeSlots: GradeStringArrays,
  classCols: GradeStringArrays,
) {
  const [electiveChanges, setElectiveChanges] = useState<Record<string, any[]>>({ grade2: [], grade3: [] });
  const [electiveChangesArbitrary, setElectiveChangesArbitrary] = useState<Record<string, any[]>>({ grade2: [], grade3: [] });
  // 학년별로 독립적으로 켜고 끌 수 있도록 학년별 boolean으로 관리한다.
  const [enableOptimization, setEnableOptimization] = useState<Record<ChangeGradeKey, boolean>>({ grade2: false, grade3: false });

  // 확정(freeze): 확정된 학생의 최종 스케줄/로그를 얼려두고, 이후 계산은
  // 이 값을 출발점으로 삼아 확정된 학생을 다시 건드리지 않도록 한다.
  const [confirmedLog, setConfirmedLog] = useState<Record<ChangeGradeKey, Record<string, ChangeLogEntry[]>>>({ grade2: {}, grade3: {} });
  const [confirmedBaseSchedules, setConfirmedBaseSchedules] = useState<Record<ChangeGradeKey, Record<string, Record<string, string>>>>({ grade2: {}, grade3: {} });
  // 확정을 여러 번 반복해도(확정→추가→확정→추가…) 매번의 직전 상태를 스택으로
  // 쌓아두고, 확정 취소를 누를 때마다 한 단계씩 그 이전 상태로 되돌아간다.
  const [confirmHistory, setConfirmHistory] = useState<Record<ChangeGradeKey, PreConfirmSnapshot[]>>({ grade2: [], grade3: [] });

  // --- Global Load Balancer (Auto-Balancing) ---
  useEffect(() => {
    if (!enableOptimization[changeActiveGrade]) {
      setElectiveChangesArbitrary(prev => ({ ...prev, [changeActiveGrade]: [] }));
      return;
    }

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

    const gradeConfirmedSchedules = confirmedBaseSchedules[changeActiveGrade] || {};

    const vSchedules: Record<string, Record<string, string>> = {};
    const lockedStudents = new Set([
      ...manualChanges.map(c => String(c.studentId)),
      ...Object.keys(gradeConfirmedSchedules),
    ]);

    students.forEach(s => {
      vSchedules[s.id] = { ...(gradeConfirmedSchedules[s.id] ?? s.timeSlotMap) };
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

  }, [enableOptimization, electiveChanges, parsedSampleData, timetableData, timeSlots, classCols, changeActiveGrade, confirmedBaseSchedules]);

  const pendingResult = useMemo(() => {
    const log: Record<string, ChangeLogEntry[]> = {};
    const finalSchedules: Record<ChangeGradeKey, Record<string, Record<string, string>>> = { grade2: {}, grade3: {} };
    if (!parsedSampleData || (!parsedSampleData.grade2.length && !parsedSampleData.grade3.length) || !electiveChanges) {
      return { log, finalSchedules };
    }

    (['grade2', 'grade3'] as ('grade2' | 'grade3')[]).forEach(grade => {
      const gradeConfirmedSchedules = confirmedBaseSchedules[grade] || {};
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

      if (!enableOptimization[grade]) {
        // --- 기존 순차 매칭 알고리즘 (Original sequential greedy matching) ---
        const studentSchedules: Record<string, Record<string, string>> = {};

        // 고정(pinnedSlot)된 요청은 같은 학생의 다른 요청보다 항상 먼저 적용해서
        // 이후 요청이 실수로 고정된 타임을 건드리지 않도록 한다.
        const orderedChanges = [...changes].sort((a, b) => {
          const aPinned = (a.pinnedSlot || a._targetSlot) ? 0 : 1;
          const bPinned = (b.pinnedSlot || b._targetSlot) ? 0 : 1;
          return aPinned - bPinned;
        });

        orderedChanges.forEach(c => {
          if (!c.studentId || !c.beforeSubject || !c.afterSubject) return;

          const targetStudent = studentsInGrade.find(s => s.id === c.studentId);
          if (!targetStudent) {
            if (!log[c.studentId]) log[c.studentId] = [];
            log[c.studentId].push({ beforeStr: c.beforeSubject, afterStr: c.afterSubject, status: 'failed', reason: '학생을 찾을 수 없음', source: c.source });
            return;
          }

          if (!studentSchedules[c.studentId]) {
            studentSchedules[c.studentId] = { ...(gradeConfirmedSchedules[c.studentId] ?? targetStudent.timeSlotMap) };
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

          const pinnedSlot = c.pinnedSlot || c._targetSlot;

          if ((!pinnedSlot || pinnedSlot === beforeSlot) && subjectExistsInSlot(c.afterSubject, beforeSlot)) {
            if (!log[c.studentId]) log[c.studentId] = [];
            log[c.studentId].push({
              beforeStr: `${c.beforeSubject}(${beforeSlot})`,
              afterStr: `${c.afterSubject}(${beforeSlot})`,
              status: 'success',
              source: c.source,
              pinned: !!pinnedSlot
            });
            currentSchedule[beforeSlot] = c.afterSubject;
            return;
          }

          let afterSlots = findSlotsWithSubject(c.afterSubject);
          if (pinnedSlot) {
            afterSlots = afterSlots.filter(s => s === pinnedSlot);
          }
          if (afterSlots.length === 0) {
            if (!log[c.studentId]) log[c.studentId] = [];
            log[c.studentId].push({
              beforeStr: c.beforeSubject,
              afterStr: c.afterSubject,
              status: 'failed',
              reason: pinnedSlot ? `고정한 ${pinnedSlot} 타임에 '${c.afterSubject}' 과목이 개설되지 않음` : `시간표에 개설되지 않은 과목`,
              source: c.source,
              pinned: !!pinnedSlot
            });
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
                source: c.source,
                pinned: !!pinnedSlot
              });
              log[c.studentId].push({
                beforeStr: `${c.beforeSubject}(${beforeSlot})`,
                afterStr: `${c.afterSubject}(${afterSlot})`,
                status: 'success',
                source: c.source,
                pinned: !!pinnedSlot
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
              reason: pinnedSlot
                ? `고정한 ${pinnedSlot} 타임으로 변경 불가: ${lastFailedReason}`
                : (afterSlots.length > 1 ? `모든 가능한 타임(${afterSlots.join(', ')})에서 2단계 교환 실패` : lastFailedReason),
              source: c.source,
              pinned: !!pinnedSlot
            });
          }
        });

        Object.entries(studentSchedules).forEach(([sid, sched]) => {
          finalSchedules[grade][sid] = sched;
        });
      } else {
        // --- 동적 밸런싱 최적화 알고리즘 (Dynamic Balancing Optimization) ---
        const classSizes: Record<string, number> = {};

        // 초기 모든 학생의 반별 인원수 계산 (확정된 학생은 확정된 최종 배정 기준)
        studentsInGrade.forEach(student => {
          const sched = gradeConfirmedSchedules[student.id] ?? student.timeSlotMap;
          Object.entries(sched).forEach(([slot, subject]) => {
             const key = `${slot}::${normalizeSubject(subject as string)}`;
             classSizes[key] = (classSizes[key] || 0) + 1;
          });
        });

        // 수강정정 신청자 목록 (고유값)
        const studentsWithChanges = Array.from(new Set(changes.map(c => c.studentId)));

        // 신청자별 현재 최적 스케줄 및 로그 관리
        const optimizedSchedules: Record<string, Record<string, string>> = {};
        const optimizedLogs: Record<string, any[]> = {};

        // 1. 초기값: 모든 신청자의 시간표를 원본(또는 확정된 최종 배정)으로 설정
        studentsWithChanges.forEach(id => {
           const student = studentsInGrade.find(s => s.id === id);
           if (student) optimizedSchedules[id] = { ...(gradeConfirmedSchedules[id] ?? student.timeSlotMap) };
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

            // 2. 이 학생의 원래(또는 확정된) 시간표에서부터 변경 신청을 순차적으로 적용하여 최적의 경로 찾기
            const studentBaseSched = gradeConfirmedSchedules[studentId] ?? student.timeSlotMap;
            let newSched = { ...studentBaseSched };
            const studentLog: any[] = [];
            // 고정(pinnedSlot)된 요청을 먼저 반영해서 항상 그 결과가 유지되도록 한다.
            const studentChanges = changes.filter(c => c.studentId === studentId).sort((a, b) => {
              const aPinned = (a.pinnedSlot || a._targetSlot) ? 0 : 1;
              const bPinned = (b.pinnedSlot || b._targetSlot) ? 0 : 1;
              return aPinned - bPinned;
            });

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

              const pinnedSlot = c.pinnedSlot || c._targetSlot;

              let afterSlots = findSlotsWithSubject(c.afterSubject);
              if (pinnedSlot) {
                afterSlots = afterSlots.filter(s => s === pinnedSlot);
              }

              if (afterSlots.length === 0) {
                dfs(changeIndex + 1, currentSched, [...currentLogs, {
                  beforeStr: c.beforeSubject,
                  afterStr: c.afterSubject,
                  status: 'failed',
                  reason: pinnedSlot ? `고정한 ${pinnedSlot} 타임에 '${c.afterSubject}' 과목이 개설되지 않음` : `시간표에 개설되지 않은 과목`,
                  source: c.source,
                  pinned: !!pinnedSlot
                }], currentMaxCost, successCount);
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
                     nextLogs.push({ beforeStr: `${c.beforeSubject}(${beforeSlot})`, afterStr: `${c.afterSubject}(${beforeSlot})`, status: 'success', source: c.source, pinned: !!pinnedSlot });
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
                   nextLogs.push({ beforeStr: `${studentSubjectInAfterSlot}(${afterSlot})`, afterStr: `${studentSubjectInAfterSlot}(${beforeSlot})`, status: 'success', source: c.source, pinned: !!pinnedSlot });
                   nextLogs.push({ beforeStr: `${c.beforeSubject}(${beforeSlot})`, afterStr: `${c.afterSubject}(${afterSlot})`, status: 'success', source: c.source, pinned: !!pinnedSlot });

                   validChoiceFound = true;
                   dfs(changeIndex + 1, nextSched, nextLogs, Math.max(currentMaxCost, cost), successCount + 1);
                } else {
                   lastFailedReason = `2단계 변경 불가: '${studentSubjectInAfterSlot}' 과목이 ${beforeSlot}타임에 개설되지 않음`;
                }
              }

              if (!validChoiceFound) {
                 dfs(changeIndex + 1, currentSched, [...currentLogs, {
                   beforeStr: c.beforeSubject,
                   afterStr: c.afterSubject,
                   status: 'failed',
                   reason: pinnedSlot
                     ? `고정한 ${pinnedSlot} 타임으로 변경 불가: ${lastFailedReason}`
                     : (afterSlots.length > 1 ? `모든 가능한 타임(${afterSlots.join(', ')})에서 교환 실패` : lastFailedReason),
                   source: c.source,
                   pinned: !!pinnedSlot
                 }], currentMaxCost, successCount);
              }
            };

            dfs(0, { ...studentBaseSched }, [], 0, 0);

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
          if (optimizedSchedules[studentId]) {
            finalSchedules[grade][studentId] = optimizedSchedules[studentId];
          }
        });
      }
    });

    return { log, finalSchedules };
  }, [parsedSampleData, electiveChanges, electiveChangesArbitrary, timetableData, timeSlots, classCols, enableOptimization, confirmedBaseSchedules]);

  // 확정된(얼려둔) 로그와, 지금 표에 남아있는 신청을 계산한 결과를 합쳐서 보여준다.
  const adjustmentLog = useMemo(() => {
    const merged: Record<string, ChangeLogEntry[]> = {};
    (['grade2', 'grade3'] as ChangeGradeKey[]).forEach(grade => {
      Object.entries(confirmedLog[grade] || {}).forEach(([sid, entries]) => {
        merged[sid] = [...(merged[sid] || []), ...entries];
      });
    });
    Object.entries(pendingResult.log).forEach(([sid, entries]) => {
      merged[sid] = [...(merged[sid] || []), ...entries];
    });
    return merged;
  }, [pendingResult, confirmedLog]);

  const handleConfirm = (grade: ChangeGradeKey) => {
    const gradeChanges = electiveChanges[grade] || [];
    const gradeArbitrary = electiveChangesArbitrary[grade] || [];
    const touchedIds = Array.from(new Set(
      [...gradeChanges, ...gradeArbitrary].map(c => String(c.studentId)).filter(Boolean)
    ));
    if (touchedIds.length === 0) return;

    setConfirmHistory(prev => ({
      ...prev,
      [grade]: [
        ...prev[grade],
        {
          confirmedLog: confirmedLog[grade] || {},
          confirmedBaseSchedules: confirmedBaseSchedules[grade] || {},
          electiveChanges: gradeChanges,
          electiveChangesArbitrary: gradeArbitrary,
        },
      ],
    }));

    setConfirmedBaseSchedules(prev => {
      const nextGrade = { ...prev[grade] };
      touchedIds.forEach(id => {
        const sched = pendingResult.finalSchedules[grade]?.[id];
        if (sched) nextGrade[id] = sched;
      });
      return { ...prev, [grade]: nextGrade };
    });

    setConfirmedLog(prev => {
      const nextGrade = { ...prev[grade] };
      touchedIds.forEach(id => {
        const entries = pendingResult.log[id];
        if (entries && entries.length > 0) {
          nextGrade[id] = [...(nextGrade[id] || []), ...entries];
        }
      });
      return { ...prev, [grade]: nextGrade };
    });

    setElectiveChanges(prev => ({ ...prev, [grade]: [] }));
    setElectiveChangesArbitrary(prev => ({ ...prev, [grade]: [] }));
  };

  const handleUndoConfirm = (grade: ChangeGradeKey) => {
    const stack = confirmHistory[grade];
    if (!stack || stack.length === 0) return;
    // 확정 이후 새로 입력된 신청이 있으면, 되돌리기가 그 내용을 스냅샷 값으로
    // 덮어써서 조용히 사라지게 만들 수 있으므로 안전하게 거부한다.
    const hasNewPending = (electiveChanges[grade] || []).length > 0 || (electiveChangesArbitrary[grade] || []).length > 0;
    if (hasNewPending) return;
    const snap = stack[stack.length - 1];
    setConfirmedLog(prev => ({ ...prev, [grade]: snap.confirmedLog }));
    setConfirmedBaseSchedules(prev => ({ ...prev, [grade]: snap.confirmedBaseSchedules }));
    setElectiveChanges(prev => ({ ...prev, [grade]: snap.electiveChanges }));
    setElectiveChangesArbitrary(prev => ({ ...prev, [grade]: snap.electiveChangesArbitrary }));
    setConfirmHistory(prev => ({ ...prev, [grade]: stack.slice(0, -1) }));
  };

  return {
    electiveChanges, setElectiveChanges,
    electiveChangesArbitrary, setElectiveChangesArbitrary,
    enableOptimization, setEnableOptimization,
    adjustmentLog,
    confirmedBaseSchedules, setConfirmedBaseSchedules,
    confirmedLog, setConfirmedLog,
    confirmHistory, setConfirmHistory,
    canUndoConfirm: { grade2: confirmHistory.grade2.length > 0, grade3: confirmHistory.grade3.length > 0 },
    handleConfirm,
    handleUndoConfirm,
  };
}
