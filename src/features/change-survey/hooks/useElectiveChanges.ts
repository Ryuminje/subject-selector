import { useEffect, useMemo, useState } from "react";
import type { ChangeGradeKey, GradeStringArrays, TimetableData } from "../types";
import type { StudentTimeData } from "../../../types";

const normalizeSubject = (subject: string): string => {
  return subject.replace(/\s+/g, '')
    .replace(/Ⅰ/g, 'I')
    .replace(/Ⅱ/g, 'II')
    .replace(/Ⅲ/g, 'III')
    .replace(/Ⅳ/g, 'IV');
};

export function useElectiveChanges(
  changeActiveGrade: ChangeGradeKey,
  parsedSampleData: { grade2: StudentTimeData[]; grade3: StudentTimeData[] },
  timetableData: TimetableData,
  timeSlots: GradeStringArrays,
  classCols: GradeStringArrays,
) {
  const [electiveChanges, setElectiveChanges] = useState<Record<string, any[]>>({ grade2: [], grade3: [] });
  const [electiveChangesArbitrary, setElectiveChangesArbitrary] = useState<Record<string, any[]>>({ grade2: [], grade3: [] });
  const [enableOptimization, setEnableOptimization] = useState(false);

  // --- Global Load Balancer (Auto-Balancing) ---
  useEffect(() => {
    if (!enableOptimization) {
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

  return {
    electiveChanges, setElectiveChanges,
    electiveChangesArbitrary, setElectiveChangesArbitrary,
    enableOptimization, setEnableOptimization,
    adjustmentLog,
  };
}
