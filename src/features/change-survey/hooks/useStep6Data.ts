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

      // 띄어쓰기·로마자 표기가 달라도 같은 과목으로 인식하도록 정규화해서 비교합니다.
      const completedBeforeNormSet = new Set(completedBefore.map(normalizeSubjectName));
      const currentSubjectNormCounts: Record<string, number> = {};
      const normToDisplay: Record<string, string> = {};
      currentSubjects.forEach(s => {
        const norm = normalizeSubjectName(s);
        currentSubjectNormCounts[norm] = (currentSubjectNormCounts[norm] || 0) + 1;
        if (!normToDisplay[norm]) normToDisplay[norm] = s;
      });
      const duplicateNormSet = new Set<string>();
      Object.entries(currentSubjectNormCounts).forEach(([norm, count]) => {
        // 2학기 내에서 같은 과목을 두 번 이상 선택했거나, 과거에 이미 이수한 과목을 다시 선택한 경우
        if (count > 1 || completedBeforeNormSet.has(norm)) duplicateNormSet.add(norm);
      });
      const duplicateSubjects = Array.from(duplicateNormSet).map(norm => normToDisplay[norm]);

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

      const missingCategories: ("사회" | "과학")[] = [];
      if (socialCount === 0) missingCategories.push("사회");
      if (scienceCount === 0) missingCategories.push("과학");

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
        hierarchyViolations,
        missingCategories
      };
    });

    processed.sort((a, b) => parseInt(a.id) - parseInt(b.id));
    return processed;
  }, [changeActiveTab, parsedSampleData, changeActiveGrade, grade2HistoryData, grade3Sem1HistoryData, adjustmentLog, changeHierarchyRules, timeSlots, getChangeSubjectCategory]);
}
