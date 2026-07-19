import { useMemo } from "react";
import { normalizeSubjectName } from "./useChangeCurriculum";
import type { ChangeActiveTab, ChangeGradeKey, GradeStringArrays, Step6Row } from "../types";
import type { GradeKey, HierarchyRule, StudentTimeData, SubjectCategory } from "../../../types";

interface AdjustmentLogEntry {
  beforeStr: string;
  afterStr: string;
  status: 'success' | 'failed';
  reason?: string;
  source?: 'applicant' | 'arbitrary';
}

export function useStep6Data(
  changeActiveTab: ChangeActiveTab,
  changeActiveGrade: ChangeGradeKey,
  parsedSampleData: { grade2: StudentTimeData[]; grade3: StudentTimeData[] },
  grade2HistoryData: Record<string, Record<string, string[]>>,
  grade3Sem1HistoryData: Record<string, Record<string, string[]>>,
  adjustmentLog: Record<string, AdjustmentLogEntry[]>,
  changeHierarchyRules: Record<string, HierarchyRule[]>,
  timeSlots: GradeStringArrays,
  getChangeSubjectCategory: (subjName: string, targetGrade: GradeKey) => SubjectCategory,
): Step6Row[] {
  return useMemo(() => {
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
        const chosenSubject = student.timeSlotMap[slot];
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
        const matchedCategory = getChangeSubjectCategory(subject, changeActiveGrade as GradeKey);
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
}
