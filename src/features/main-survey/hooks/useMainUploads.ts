import { useEffect, useState } from "react";
import * as XLSX from "xlsx-js-style";
import type { GradeKey, HierarchyRule, ParsedCurriculumSubject, ProcessedStudent, SubjectCategory, SubjectMap, SubjectStat } from "../../../types";

export function normalizeSubjectName(name: string): string {
  if (!name) return "";
  let normalized = name.trim().replace(/\s+/g, "");

  // 1. 유니코드 로마자 (Ⅰ, Ⅱ, Ⅲ, Ⅳ, Ⅴ) -> 영어 알파벳 (I, II, III, IV, V)으로 통일
  normalized = normalized
    .replace(/Ⅰ/g, "I")
    .replace(/Ⅱ/g, "II")
    .replace(/Ⅲ/g, "III")
    .replace(/Ⅳ/g, "IV")
    .replace(/Ⅴ/g, "V");

  // 2. 아라비아 숫자 (1, 2, 3, 4, 5) -> 영어 알파벳 (I, II, III, IV, V)으로 통일 (과목명 끝의 숫자)
  normalized = normalized
    .replace(/1$/, "I")
    .replace(/2$/, "II")
    .replace(/3$/, "III")
    .replace(/4$/, "IV")
    .replace(/5$/, "V");

  return normalized;
}

function parseGroupAndSemester(header: string) {
  let group = "";
  let semester = "";

  // Extract Group (e.g. 선택군 A, 선택군 B, or fallback A군, B군)
  const selectGroupMatch = header.match(/선택군\s*([A-Za-z0-9가-힣])/i);
  const letterGroupMatch = header.match(/([A-Za-z0-9])군/i);

  if (selectGroupMatch) {
    group = selectGroupMatch[1].toUpperCase();
  } else if (letterGroupMatch) {
    group = letterGroupMatch[1].toUpperCase();
  } else {
    group = "기타";
  }

  // Extract Semester
  if (header.includes("1~2학기") || header.includes("1-2학기")) {
    semester = "1~2학기";
  } else if (header.includes("1학기")) {
    semester = "1학기";
  } else if (header.includes("2학기")) {
    semester = "2학기";
  } else {
    semester = "공통/기타";
  }

  return { group, semester };
}

export function useMainUploads(
  activeGrade: GradeKey,
  parsedCurriculumList: { [key in GradeKey]: ParsedCurriculumSubject[] },
  subjectMap: { [key in GradeKey]: SubjectMap },
  hierarchyRules: { [key in GradeKey]: HierarchyRule[] },
) {
  const [uploadedFiles, setUploadedFiles] = useState<{ [key in GradeKey]: { name: string, size: number, data: string } | null }>({ pre1: null, grade1: null, grade2: null });
  const [processedData, setProcessedData] = useState<{ [key in GradeKey]: ProcessedStudent[] }>({ pre1: [], grade1: [], grade2: [] });
  const [rawSheetData, setRawSheetData] = useState<{ [key in GradeKey]: any[] }>({ pre1: [], grade1: [], grade2: [] });
  const [previousHistoryFiles, setPreviousHistoryFiles] = useState<{ [key in GradeKey]: { name: string, size: number, data: string } | null }>({ pre1: null, grade1: null, grade2: null });
  const [previousSubjectMap, setPreviousSubjectMap] = useState<{ [key in GradeKey]: { [studentId: string]: { name: string, subjects: string[] } } }>({ pre1: {}, grade1: {}, grade2: {} });
  const [subjectStats, setSubjectStats] = useState<{ [key in GradeKey]: SubjectStat[] }>({ pre1: [], grade1: [], grade2: [] });
  const [totalClasses, setTotalClasses] = useState<{ [key in GradeKey]: number }>({ pre1: 10, grade1: 10, grade2: 10 });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const arrayBuffer = evt.target?.result as ArrayBuffer;
      const dataUrlReader = new FileReader();
      dataUrlReader.onload = (dataEvt) => {
        setUploadedFiles(prev => ({
          ...prev,
          [activeGrade]: {
            name: file.name,
            size: file.size,
            data: dataEvt.target?.result as string
          }
        }));
      };
      dataUrlReader.readAsDataURL(file);

      const wb = XLSX.read(arrayBuffer, { type: "array" });
      const wsname = wb.SheetNames.length > 1 ? wb.SheetNames[1] : wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const sheetData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

      let headerRowIndex = -1;
      for (let i = 0; i < sheetData.length; i++) {
        const row = sheetData[i];
        if (Array.isArray(row)) {
          const hasId = row.some(cell => String(cell || "").includes("학번"));
          const hasName = row.some(cell => String(cell || "").includes("이름") || String(cell || "").includes("성명"));
          if (hasId && hasName) {
            headerRowIndex = i;
            break;
          }
        }
      }

      if (headerRowIndex === -1) {
        alert("수강신청 엑셀 파일에서 '학번'과 '이름(성명)' 열을 찾을 수 없습니다.");
        return;
      }

      // 2줄로 된 병합 헤더 여부 감지
      const row1 = sheetData[headerRowIndex];
      const row2 = sheetData[headerRowIndex + 1];
      const tempHeaders = row1.map(h => String(h || "").trim());
      const idColIndex = tempHeaders.findIndex(h => h.includes("학번"));
      const nameColIndex = tempHeaders.findIndex(h => h.includes("이름") || h.includes("성명"));

      const hasMultiRowHeader = row2 &&
        !row2[idColIndex] &&
        !row2[nameColIndex] &&
        row2.some(cell => typeof cell === "string" && String(cell).trim().length > 0);

      const blocklist = ["순번", "학년", "학번", "이름", "성명", "성별", "과정", "메모", "과목수", "합계", "총계"];
      const headers: string[] = [];
      const maxLength = Math.max(row1.length, row2 ? row2.length : 0);

      // 상위 헤더의 병합 영역 복원 (Forward-fill) - 희소 배열(sparse array) 대응을 위해 for 루프 사용
      const parentHeaders: string[] = [];
      let lastParentHeader = "";
      for (let colIndex = 0; colIndex < maxLength; colIndex++) {
        const val = String(row1[colIndex] || "").trim();
        if (val) {
          lastParentHeader = val;
        }
        parentHeaders.push(lastParentHeader);
      }

      for (let colIndex = 0; colIndex < maxLength; colIndex++) {
        const val1 = String(row1[colIndex] || "").trim();
        const val2 = row2 ? String(row2[colIndex] || "").trim() : "";
        const parentHeader = parentHeaders[colIndex] || "";

        if (hasMultiRowHeader) {
          if (blocklist.some(b => val1.includes(b))) {
            headers.push(val1);
          } else if (parentHeader.includes("지정")) {
            // 지정과목 열은 파싱에서 완전히 제외
            headers.push("");
          } else {
            // 본조사 파일의 매트릭스 형태 대응: 상위 헤더(그룹명)와 과목명을 결합
            headers.push(val2 ? `${parentHeader}::${val2}` : val1);
          }
        } else {
          if (val1.includes("지정")) {
            headers.push("");
          } else {
            headers.push(val1);
          }
        }
      }

      const startDataRowIndex = hasMultiRowHeader ? headerRowIndex + 2 : headerRowIndex + 1;

      const dataObjects: any[] = [];
      for (let i = startDataRowIndex; i < sheetData.length; i++) {
        const row = sheetData[i];
        if (!row || row.length === 0) continue;

        const obj: any = {};
        let hasAnyData = false;
        headers.forEach((header, colIndex) => {
          if (header) {
            const val = row[colIndex];
            obj[header] = val !== undefined ? val : "";
            if (val !== undefined && val !== "") hasAnyData = true;
          }
        });
        if (hasAnyData) {
          dataObjects.push(obj);
        }
      }

      const uniqueClasses = new Set<string>();
      dataObjects.forEach(obj => {
        const studentId = String(obj["학번"] || "").trim();
        if (studentId.length >= 5) {
          uniqueClasses.add(studentId.substring(1, 3));
        } else if (studentId.length === 4) {
          uniqueClasses.add(studentId.substring(1, 2));
        }
      });
      const classCount = uniqueClasses.size;
      if (classCount > 0) {
        setTotalClasses(prev => ({ ...prev, [activeGrade]: classCount }));
      }

      setRawSheetData(prev => ({ ...prev, [activeGrade]: dataObjects }));
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handlePrevHistoryFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const arrayBuffer = evt.target?.result as ArrayBuffer;
      const dataUrlReader = new FileReader();
      dataUrlReader.onload = (dataEvt) => {
        setPreviousHistoryFiles(prev => ({
          ...prev,
          [activeGrade]: {
            name: file.name,
            size: file.size,
            data: dataEvt.target?.result as string
          }
        }));
      };
      dataUrlReader.readAsDataURL(file);

      const wb = XLSX.read(arrayBuffer, { type: "array" });
      const wsname = wb.SheetNames.length > 1 ? wb.SheetNames[1] : wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const sheetData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

      let headerRowIndex = -1;
      for (let i = 0; i < sheetData.length; i++) {
        const row = sheetData[i];
        if (Array.isArray(row)) {
          const hasId = row.some(cell => String(cell || "").includes("학번"));
          const hasName = row.some(cell => String(cell || "").includes("이름") || String(cell || "").includes("성명"));
          if (hasId && hasName) {
            headerRowIndex = i;
            break;
          }
        }
      }

      if (headerRowIndex === -1) {
        alert("이전 수강 이력 엑셀 파일에서 '학번'과 '이름(성명)' 열을 찾을 수 없습니다.");
        return;
      }

      // 2줄로 된 병합 헤더 여부 감지
      const row1 = sheetData[headerRowIndex];
      const row2 = sheetData[headerRowIndex + 1];
      const tempHeaders = row1.map(h => String(h || "").trim());
      const idColIndex = tempHeaders.findIndex(h => h.includes("학번"));
      const nameColIndex = tempHeaders.findIndex(h => h.includes("이름") || h.includes("성명"));

      const hasMultiRowHeader = row2 &&
        !row2[idColIndex] &&
        !row2[nameColIndex] &&
        row2.some(cell => typeof cell === "string" && String(cell).trim().length > 0);

      const blocklist = ["순번", "학년", "학번", "이름", "성명", "성별", "과정", "메모", "과목수", "합계", "총계"];
      const headers: string[] = [];
      const maxLength = Math.max(row1.length, row2 ? row2.length : 0);

      // 상위 헤더의 병합 영역 복원 (Forward-fill) - 희소 배열(sparse array) 대응을 위해 for 루프 사용
      const parentHeaders: string[] = [];
      let lastParentHeader = "";
      for (let colIndex = 0; colIndex < maxLength; colIndex++) {
        const val = String(row1[colIndex] || "").trim();
        if (val) {
          lastParentHeader = val;
        }
        parentHeaders.push(lastParentHeader);
      }

      for (let colIndex = 0; colIndex < maxLength; colIndex++) {
        const val1 = String(row1[colIndex] || "").trim();
        const val2 = row2 ? String(row2[colIndex] || "").trim() : "";
        const parentHeader = parentHeaders[colIndex] || "";

        if (hasMultiRowHeader) {
          if (blocklist.some(b => val1.includes(b))) {
            headers.push(val1);
          } else if (parentHeader.includes("지정")) {
            // 지정과목 열은 파싱에서 완전히 제외
            headers.push("");
          } else {
            headers.push(val2 || val1);
          }
        } else {
          if (val1.includes("지정")) {
            headers.push("");
          } else {
            headers.push(val1);
          }
        }
      }

      const subjectCols: { name: string; index: number }[] = [];
      headers.forEach((h, index) => {
        if (h && !blocklist.some(b => h.includes(b))) {
          subjectCols.push({ name: h, index });
        }
      });

      const startDataRowIndex = hasMultiRowHeader ? headerRowIndex + 2 : headerRowIndex + 1;
      const historyMap: { [studentId: string]: { name: string, subjects: string[] } } = {};

      for (let i = startDataRowIndex; i < sheetData.length; i++) {
        const row = sheetData[i];
        if (!row || row.length === 0) continue;

        const studentId = String(row[idColIndex] || "").trim();
        const name = String(row[nameColIndex] || "").trim();

        if (!studentId || !name) continue;
        if (studentId.includes("합계") || name.includes("합계") || studentId.includes("총계") || name.includes("총계")) continue;
        if (!/^\d+/.test(studentId)) continue;

        const completedSubjects: string[] = [];
        subjectCols.forEach(col => {
          const val = String(row[col.index] || "").trim();
          if (val === "1" || val.toLowerCase() === "y" || val === "이수" || val === "O" || val === "o" || val === "참여") {
            completedSubjects.push(col.name);
          }
        });

        historyMap[studentId] = { name, subjects: completedSubjects };
      }

      setPreviousSubjectMap(prev => ({ ...prev, [activeGrade]: historyMap }));
      alert(`이전 수강 이력 분석 완료: 총 ${Object.keys(historyMap).length}명의 수강 정보가 매핑되었습니다.`);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleRemoveFile = () => {
    setUploadedFiles(prev => ({ ...prev, [activeGrade]: null }));
    setRawSheetData(prev => ({ ...prev, [activeGrade]: [] }));
    setProcessedData(prev => ({ ...prev, [activeGrade]: [] }));
    setSubjectStats(prev => ({ ...prev, [activeGrade]: [] }));
  };

  const handleRemovePrevHistoryFile = () => {
    setPreviousHistoryFiles(prev => ({ ...prev, [activeGrade]: null }));
    setPreviousSubjectMap(prev => ({ ...prev, [activeGrade]: {} }));
  };

  const getSubjectCategory = (subjName: string, targetGrade: GradeKey): SubjectCategory => {
    const normalizedSubject = normalizeSubjectName(subjName);

    const findCategoryFromParsed = (grade: GradeKey): SubjectCategory | null => {
      const list = parsedCurriculumList[grade] || [];
      for (const subj of list) {
        if (normalizeSubjectName(subj.subject) === normalizedSubject) {
          if (["국어", "수학", "영어"].includes(subj.category)) return "기초";
          if (subj.category.includes("사회") || subj.category.includes("역사") || subj.category.includes("도덕")) return "사회";
          if (subj.category.includes("과학")) return "과학";
          return "기타";
        }
      }
      return null;
    };

    let cat = findCategoryFromParsed(targetGrade);
    if (cat) return cat;

    const otherGradeKey: GradeKey = targetGrade === "grade2" ? "grade1" : "grade2";
    cat = findCategoryFromParsed(otherGradeKey);
    if (cat) return cat;

    // Fallback to subjectMap
    // 1. Check target grade's subjectMap first
    const targetSubjectMap = subjectMap[targetGrade] || {};
    const sortedTargetMapEntries = Object.entries(targetSubjectMap).sort((a, b) => b[0].replace(/\s+/g, "").length - a[0].replace(/\s+/g, "").length);
    for (const [mapSubj, mapCat] of sortedTargetMapEntries) {
      const normalizedMapSubj = normalizeSubjectName(mapSubj);
      if (normalizedSubject.includes(normalizedMapSubj)) return mapCat;
    }

    // 2. Check other grade's subjectMap as fallback
    const otherSubjectMap = subjectMap[otherGradeKey] || {};
    const sortedOtherMapEntries = Object.entries(otherSubjectMap).sort((a, b) => b[0].replace(/\s+/g, "").length - a[0].replace(/\s+/g, "").length);
    for (const [mapSubj, mapCat] of sortedOtherMapEntries) {
      const normalizedMapSubj = normalizeSubjectName(mapSubj);
      if (normalizedSubject.includes(normalizedMapSubj)) return mapCat;
    }

    return "기타";
  };

  const processData = (data: any[]) => {
    const processed: ProcessedStudent[] = [];
    const historyMap = previousSubjectMap[activeGrade] || {};

    const statsMap: Record<string, { group: string; semester: string; count: number }> = {};

    data.forEach((row, index) => {
      const keys = Object.keys(row);
      const idKey = keys.find(k => k.includes("학번"));
      const nameKey = keys.find(k => k.includes("이름") || k.includes("성명"));

      if (!idKey || !nameKey) return;

      const studentId = String(row[idKey]).trim();
      const name = String(row[nameKey]).trim();

      if (!/^\d{4,}/.test(studentId)) {
        return;
      }

      if (studentId.includes("합계") || name.includes("합계") || studentId.includes("총계") || name.includes("총계")) {
        return;
      }

      let grade = "", classNum = "", num = "";
      if (studentId.length >= 5) {
        grade = studentId.substring(0, 1);
        classNum = studentId.substring(1, 3);
        num = studentId.substring(3, 5);
      } else if (studentId.length === 4) {
        grade = studentId.substring(0, 1);
        classNum = studentId.substring(1, 2);
        num = studentId.substring(2, 4);
      }

      // Match student's previously completed subjects
      let completedBefore: string[] = [];
      const cleanStudentId = studentId.replace(/\s+/g, "");
      const matchedKey = Object.keys(historyMap).find(k => k.replace(/\s+/g, "") === cleanStudentId);

      if (matchedKey) {
        completedBefore = historyMap[matchedKey].subjects;
      } else {
        const cleanName = name.replace(/\s+/g, "");
        const matchedByName = Object.entries(historyMap).filter(([_, info]) => info.name.replace(/\s+/g, "") === cleanName);
        if (matchedByName.length === 1) {
          completedBefore = matchedByName[0][1].subjects;
        }
      }

      const subjectKeys = keys.filter(k => {
        const lower = k.toLowerCase();
        return !(
          lower.includes("학번") || lower.includes("이름") || lower.includes("성명") ||
          lower.includes("타임스탬프") || lower.includes("이메일") || lower.includes("순번") ||
          lower.includes("연락처") || lower.includes("전화") || lower.includes("휴대폰") ||
          lower.includes("시간") || lower.includes("비고")
        );
      });

      const semester1: string[] = [];
      const semester1_2: string[] = [];
      const semester2: string[] = [];
      let basicCount = 0;
      let socialCount = 0;
      let scienceCount = 0;

      // Count completedBefore subjects first
      const prevGradeKey: GradeKey = activeGrade === "grade2" ? "grade1" : "grade2";
      completedBefore.forEach(prevSubj => {
        const matchedCategory = getSubjectCategory(prevSubj, prevGradeKey);
        if (matchedCategory === "기초") basicCount++;
        if (matchedCategory === "사회") socialCount++;
        if (matchedCategory === "과학") scienceCount++;
      });

      subjectKeys.forEach(k => {
        const val = String(row[k] || "");
        // 매트릭스 형태의 본조사 파일 처리 (val이 1, y, o 등 선택된 경우만 처리)
        if (val !== "1" && val.toLowerCase() !== "y" && val !== "O" && val !== "o" && val !== "이수" && val !== "참여") return;

        let subject = "";
        let group = "기타";
        let semester = "공통/기타";

        if (k.includes("::")) {
          const [parent, subj] = k.split("::");
          subject = subj.trim();
          const parsed = parseGroupAndSemester(parent);
          group = parsed.group;
          semester = parsed.semester;
        } else {
          // 혹시 모를 구글 폼 양식 대비 폴백 (과목명이 값이 아닐 경우 대비)
          // 하지만 본조사 탭은 기본적으로 매트릭스 포맷을 가정합니다.
          subject = k.trim();
          const parsed = parseGroupAndSemester(k);
          group = parsed.group;
          semester = parsed.semester;
        }

        if (!subject) return;

        const matchedCategory = getSubjectCategory(subject, activeGrade);

        let increment = 1;
        if (semester === "1~2학기" || semester === "1-2학기" || k.includes("1,2학기")) {
          semester1_2.push(subject);
          increment = 2;
        } else if (semester === "1학기") {
          semester1.push(subject);
        } else if (semester === "2학기") {
          semester2.push(subject);
        } else {
          semester1_2.push(subject); // 알 수 없는 경우 1~2학기로 배정
          increment = 2;
        }

        if (matchedCategory === "기초") basicCount += increment;
        if (matchedCategory === "사회") socialCount += increment;
        if (matchedCategory === "과학") scienceCount += increment;

        const statKey = `${group}|${semester}|${subject}`;
        if (!statsMap[statKey]) statsMap[statKey] = { group, semester, count: 0 };
        statsMap[statKey].count++;
      });

      const allSubjects = [...semester1, ...semester1_2, ...semester2].filter(Boolean);
      const subjectCounts: Record<string, number> = {};
      allSubjects.forEach(s => {
        subjectCounts[s] = (subjectCounts[s] || 0) + 1;
      });
      const duplicateSubjects = Object.keys(subjectCounts).filter(s => subjectCounts[s] > 1);

      const hierarchyViolations: { subject: string; prereq: string; message: string }[] = [];
      const currentRules = hierarchyRules[activeGrade] || [];

      const getSemester = (subj: string) => {
        const normSubj = normalizeSubjectName(subj);
        if (semester1.some(s => normalizeSubjectName(s) === normSubj)) return 1;
        if (semester1_2.some(s => normalizeSubjectName(s) === normSubj)) return 1;
        if (semester2.some(s => normalizeSubjectName(s) === normSubj)) return 2;
        return 0;
      };

      currentRules.forEach(rule => {
        const advancedSem = getSemester(rule.advanced);
        if (advancedSem > 0) {
          const prereqSem = getSemester(rule.prereq);
          const isPrereqCompletedBefore = completedBefore.some(s => normalizeSubjectName(s) === normalizeSubjectName(rule.prereq));

          if (isPrereqCompletedBefore) {
            // Prerequisite completed in previous years, no violation
            return;
          }

          if (prereqSem === 0) {
            // Not completed before and not enrolled this year
            hierarchyViolations.push({ subject: rule.advanced, prereq: rule.prereq, message: `권장 이수 순서: ${rule.prereq} -> ${rule.advanced}` });
          } else if (prereqSem > advancedSem) {
            // Enrolled in later semester this year
            hierarchyViolations.push({ subject: rule.advanced, prereq: rule.prereq, message: `권장 이수 순서: ${rule.prereq} -> ${rule.advanced}` });
          } else if (prereqSem === advancedSem) {
            // Enrolled in same semester this year (simultaneous)
            hierarchyViolations.push({ subject: rule.advanced, prereq: rule.prereq, message: `권장 이수 순서: ${rule.prereq} -> ${rule.advanced}` });
          }
        }
      });

      processed.push({
        originalIndex: index + 1,
        studentId,
        name,
        grade,
        classNum,
        num,
        semester1,
        semester1_2: [],
        semester2,
        basicCount,
        socialCount,
        scienceCount,
        duplicateSubjects,
        hierarchyViolations,
        originalRow: row,
        completedBefore
      });
    });

    const newStats: SubjectStat[] = Object.entries(statsMap).map(([key, data]) => {
      const subject = key.split("|")[2];
      return {
        group: data.group,
        semester: data.semester,
        subject,
        applicants: data.count
      };
    });

    // Sort logic: by Group first, then Semester, then curriculum category (Step 6 order), then subject name
    const preferredOrder = ["국어", "수학", "영어", "한국사", "사회", "과학", "일본어", "중국어", "체육", "예술", "미술", "음악", "기술·가정", "정보", "제2외국어", "한문", "진로", "교양"];
    newStats.sort((a, b) => {
      if (a.group !== b.group) return a.group.localeCompare(b.group);
      if (a.semester !== b.semester) return a.semester.localeCompare(b.semester);

      const catA = parsedCurriculumList[activeGrade]?.find(p => p.subject === a.subject)?.category || subjectMap[activeGrade]?.[a.subject] || "기타";
      const catB = parsedCurriculumList[activeGrade]?.find(p => p.subject === b.subject)?.category || subjectMap[activeGrade]?.[b.subject] || "기타";

      const idxA = preferredOrder.indexOf(catA);
      const idxB = preferredOrder.indexOf(catB);

      if (idxA !== -1 && idxB !== -1 && idxA !== idxB) return idxA - idxB;
      if (idxA !== -1 && idxB === -1) return -1;
      if (idxB !== -1 && idxA === -1) return 1;

      return a.subject.localeCompare(b.subject);
    });

    setProcessedData(prev => ({ ...prev, [activeGrade]: processed }));
    setSubjectStats(prev => ({ ...prev, [activeGrade]: newStats }));
  };

  useEffect(() => {
    const currentData = rawSheetData[activeGrade];
    if (currentData && currentData.length > 0) {
      processData(currentData);
    } else {
      setProcessedData(prev => ({ ...prev, [activeGrade]: [] }));
      setSubjectStats(prev => ({ ...prev, [activeGrade]: [] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGrade, rawSheetData, subjectMap, hierarchyRules, previousSubjectMap, parsedCurriculumList]);

  return {
    uploadedFiles, setUploadedFiles,
    processedData, setProcessedData,
    rawSheetData, setRawSheetData,
    previousHistoryFiles, setPreviousHistoryFiles,
    previousSubjectMap, setPreviousSubjectMap,
    subjectStats, setSubjectStats,
    totalClasses, setTotalClasses,
    handleFileUpload,
    handlePrevHistoryFileUpload,
    handleRemoveFile,
    handleRemovePrevHistoryFile,
    getSubjectCategory,
  };
}
