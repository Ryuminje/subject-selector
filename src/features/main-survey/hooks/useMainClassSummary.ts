import { useMemo } from "react";
import * as XLSX from "xlsx-js-style";
import { normalizeSubjectName } from "./useMainUploads";
import type { DesignatedSubject, GradeKey, ParsedCurriculumSubject, ProcessedStudent, SubjectMap, SubjectStat } from "../../../types";

export interface CategorySummaryRow {
  category: string;
  isFirstRow: boolean;
  rowSpan: number;
  reduction: number;
  sem1TotalOriginal: number;
  sem2TotalOriginal: number;
  sem1Total: number;
  sem2Total: number;
  yearTotal: number;
  sem1Avg: string;
  sem2Avg: string;
  yearAvg: string;
  sem1: { gradeLabel: string; subject: string; credits: number; isSplit?: boolean; subjectHours: number; isElective?: boolean; classCount: number } | null;
  sem2: { gradeLabel: string; subject: string; credits: number; isSplit?: boolean; subjectHours: number; isElective?: boolean; classCount: number } | null;
}

export function getClassRecommendation(applicants: number, standardSize: number) {
  if (applicants < 10) return "폐강";
  if (applicants < 0.7 * standardSize) return "논의";

  const k = Math.round(applicants / standardSize);
  const nominalClasses = k < 1 ? 1 : k;

  if (nominalClasses >= 2) {
    const avgSize = applicants / nominalClasses;
    if (avgSize > 1.12 * standardSize) {
      return `${nominalClasses}~${nominalClasses + 1}`;
    }
  }

  return `${nominalClasses}`;
}

export function useMainClassSummary(
  activeGrade: GradeKey,
  processedData: { [key in GradeKey]: ProcessedStudent[] },
  subjectStats: { [key in GradeKey]: SubjectStat[] },
  standardClassSize: { [key in GradeKey]: number },
  manualStep5Classes: { [key: string]: string },
  designatedSubjects: { [key in GradeKey]: DesignatedSubject[] },
  manualClassCounts: { [subjectKey: string]: number },
  totalClasses: { [key in GradeKey]: number },
  teacherCounts: { [category: string]: number },
  headTeacherReductions: { [category: string]: number },
  parsedCurriculumList: { [key in GradeKey]: ParsedCurriculumSubject[] },
  subjectMap: { [key in GradeKey]: SubjectMap },
) {
  const handleExport = () => {
    const dataToExport = processedData[activeGrade];
    if (dataToExport.length === 0) return;

    const wb = XLSX.utils.book_new();

    // Group by class
    const classes = Array.from(new Set(dataToExport.map(d => `${d.grade}-${parseInt(d.classNum)}`)));

    const maxSem1 = dataToExport.length > 0 ? Math.max(4, ...dataToExport.map(d => d.semester1.length)) : 4;
    const maxSem1_2 = dataToExport.length > 0 ? Math.max(0, ...dataToExport.map(d => (d.semester1_2 || []).length)) : 0;
    const maxSem2 = dataToExport.length > 0 ? Math.max(4, ...dataToExport.map(d => d.semester2.length)) : 4;

    classes.forEach(cls => {
      const classData = dataToExport.filter(d => `${d.grade}-${parseInt(d.classNum)}` === cls);
      // Sort by student ID
      classData.sort((a, b) => parseInt(a.studentId) - parseInt(b.studentId));

      const aoa: any[][] = [];

      const headerRow = ["순번", "학번", "이름"];
      for (let i = 0; i < maxSem1; i++) headerRow.push(i === 0 ? "1학기" : "");
      for (let i = 0; i < maxSem1_2; i++) headerRow.push(i === 0 ? "1~2학기" : "");
      for (let i = 0; i < maxSem2; i++) headerRow.push(i === 0 ? "2학기" : "");
      headerRow.push("기초과목", "사회", "과학", "비고");
      aoa.push(headerRow);

      // Data Rows
      classData.forEach((student, idx) => {
        const row: any[] = [
          idx + 1, // 순번 reset per class
          student.studentId,
          student.name,
        ];
        for (let i = 0; i < maxSem1; i++) row.push(student.semester1[i] || "");
        for (let i = 0; i < maxSem1_2; i++) row.push((student.semester1_2 || [])[i] || "");
        for (let i = 0; i < maxSem2; i++) row.push(student.semester2[i] || "");
        const remarks: string[] = [];
        if (student.basicCount >= 10) remarks.push("기초과목 최대학점 초과");
        if (student.duplicateSubjects?.length) remarks.push(`중복선택: ${student.duplicateSubjects.join(", ")}`);
        if (student.hierarchyViolations?.length) remarks.push(student.hierarchyViolations.map(v => v.message).join(", "));

        row.push(student.basicCount || 0, student.socialCount || 0, student.scienceCount || 0, remarks.join(" / "));

        aoa.push(row);
      });

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // Apply Styles
      const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
      const remarksColIndex = 3 + maxSem1 + maxSem1_2 + maxSem2 + 3;

      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[cellAddress]) ws[cellAddress] = { t: "s", v: "" }; // Create empty cell if not exists for border styling

          ws[cellAddress].s = {
            alignment: {
              horizontal: (C === remarksColIndex && R > 0) ? "left" : "center",
              vertical: "center"
            },
            border: {
              top: { style: "thin", color: { rgb: "000000" } },
              bottom: { style: "thin", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "000000" } },
              right: { style: "thin", color: { rgb: "000000" } },
            }
          };

          // 헤더 행 음영 처리
          if (R === 0) {
            ws[cellAddress].s.fill = { fgColor: { rgb: "E0E0E0" } };
            ws[cellAddress].s.font = { bold: true };
          } else {
            // 데이터 행 조건부 스타일링
            const student = classData[R - 1];
            if (student) {
              const basicColIndex = 3 + maxSem1 + maxSem2;
              const socialColIndex = basicColIndex + 1;
              const scienceColIndex = basicColIndex + 2;

              if (C === basicColIndex && (student.basicCount || 0) >= 10) {
                ws[cellAddress].s.fill = { fgColor: { rgb: "F18448" } };
              } else if (C === socialColIndex && (student.socialCount || 0) === 0) {
                ws[cellAddress].s.fill = { fgColor: { rgb: "6AAADE" } };
              } else if (C === scienceColIndex && (student.scienceCount || 0) === 0) {
                ws[cellAddress].s.fill = { fgColor: { rgb: "6AAADE" } };
              } else if (C >= 3 && C < basicColIndex) {
                // 과목 셀 채우기 색상 및 글자 색상 지정 (중복 및 위계 검사)
                const isSem1 = C < 3 + maxSem1;
                const subject = isSem1 ? student.semester1[C - 3] : student.semester2[C - 3 - maxSem1];
                if (subject) {
                  const isHierarchyViolation = student.hierarchyViolations?.some(v => v.subject === subject || v.prereq === subject);
                  const isDuplicate = student.duplicateSubjects?.includes(subject);

                  if (isHierarchyViolation) {
                    ws[cellAddress].s.fill = { fgColor: { rgb: "E0F7FA" } }; // Soft Cyan
                    ws[cellAddress].s.font = { name: "맑은 고딕", size: 10, bold: true, color: { rgb: "006064" } }; // Dark Cyan text
                  } else if (isDuplicate) {
                    ws[cellAddress].s.fill = { fgColor: { rgb: "FFF2CC" } }; // Soft Yellow
                    ws[cellAddress].s.font = { name: "맑은 고딕", size: 10, bold: true, color: { rgb: "7F6000" } }; // Dark Gold text
                  }
                }
              } else if (C === remarksColIndex) {
                // 비고란 글자 색상 지정 (가독성 향상)
                const hasExcessBasic = (student.basicCount || 0) >= 10;
                const hasHierarchy = student.hierarchyViolations?.length > 0;
                const hasDuplicate = student.duplicateSubjects?.length > 0;

                if (hasExcessBasic || (hasHierarchy && hasDuplicate)) {
                  ws[cellAddress].s.font = { name: "맑은 고딕", size: 10, bold: true, color: { rgb: "C00000" } }; // 진한 빨강
                } else if (hasHierarchy) {
                  ws[cellAddress].s.font = { name: "맑은 고딕", size: 10, bold: true, color: { rgb: "006064" } }; // 진한 청록
                } else if (hasDuplicate) {
                  ws[cellAddress].s.font = { name: "맑은 고딕", size: 10, bold: true, color: { rgb: "7F6000" } }; // 진한 금색/노랑
                }
              }
            }
          }
        }
      }

      // Add Merges for "1학기" and "2학기" headers
      if (!ws["!merges"]) ws["!merges"] = [];
      ws["!merges"].push({ s: { r: 0, c: 3 }, e: { r: 0, c: 3 + maxSem1 - 1 } });
      ws["!merges"].push({ s: { r: 0, c: 3 + maxSem1 }, e: { r: 0, c: 3 + maxSem1 + maxSem2 - 1 } });

      // Add row heights for spacing
      const rowHeights = [];
      rowHeights.push({ hpx: 30 }); // Header row height in pixels
      for (let r = 1; r < aoa.length; r++) {
        rowHeights.push({ hpx: 24 }); // Data row height in pixels (increased from ~18-20 for better layout)
      }
      ws["!rows"] = rowHeights;

      // Add column widths
      const cols = [
        { wch: 5 },  // 순번
        { wch: 10 }, // 학번
        { wch: 10 }, // 이름
      ];
      for (let i = 0; i < maxSem1; i++) cols.push({ wch: 15 });
      for (let i = 0; i < maxSem2; i++) cols.push({ wch: 15 });
      cols.push({ wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 35 }); // Increased remarks width to 35
      ws["!cols"] = cols;

      XLSX.utils.book_append_sheet(wb, ws, cls);
    });

    XLSX.writeFile(wb, `Subject_Selection_${activeGrade === "pre1" ? "1학년" : activeGrade === "grade1" ? "2학년" : "3학년"}_Processed.xlsx`);
  };

  const handleExportStep5 = () => {
    const stats = subjectStats[activeGrade] || [];
    if (stats.length === 0) return;

    const standardSize = standardClassSize[activeGrade] || 25;
    const wb = XLSX.utils.book_new();

    const titleText = `2026학년도 ${activeGrade === "pre1" ? "1학년" : activeGrade === "grade1" ? "2학년" : "3학년"} 선택과목 수강신청(본조사) 결과`;

    const aoa: any[][] = [
      [titleText, "", "", "", "", ""],
      ["", "", "", "", "", ""],
      ["선택군", "학기", "과목", "신청자수", "개설 반 수", "개설여부"]
    ];

    stats.forEach(s => {
      const baseRemark = getClassRecommendation(s.applicants, standardSize);
      const key = `${activeGrade}_${s.semester}_${s.subject}`;
      const displayRemark = manualStep5Classes[key] !== undefined ? manualStep5Classes[key] : baseRemark;

      let openingStatus = "미정";
      if (displayRemark === "폐강") openingStatus = "폐강";
      else if (!isNaN(Number(displayRemark))) openingStatus = "확정";

      aoa.push([
        s.group,
        s.semester,
        s.subject,
        s.applicants,
        displayRemark,
        openingStatus
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    const merges: any[] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }
    ];

    const dataStartRowIndex = 3;

    let i = 0;
    while (i < stats.length) {
      let j = i + 1;
      while (j < stats.length && stats[j].group === stats[i].group) {
        j++;
      }
      if (j - i > 1) {
        merges.push({
          s: { r: dataStartRowIndex + i, c: 0 },
          e: { r: dataStartRowIndex + j - 1, c: 0 }
        });
      }
      i = j;
    }

    i = 0;
    while (i < stats.length) {
      let j = i + 1;
      while (j < stats.length && stats[j].group === stats[i].group && stats[j].semester === stats[i].semester) {
        j++;
      }
      if (j - i > 1) {
        merges.push({
          s: { r: dataStartRowIndex + i, c: 1 },
          e: { r: dataStartRowIndex + j - 1, c: 1 }
        });
      }
      i = j;
    }

    ws["!merges"] = merges;

    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellAddress]) ws[cellAddress] = { t: "s", v: "" };

        const cell = ws[cellAddress];

        if (R === 0) {
          cell.s = {
            font: { name: "맑은 고딕", size: 16, bold: true },
            alignment: { horizontal: "center", vertical: "center" }
          };
        } else if (R === 1) {
          cell.s = {};
        } else if (R === 2) {
          cell.s = {
            font: { name: "맑은 고딕", size: 11, bold: true },
            fill: { fgColor: { rgb: "F2F2F2" } },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
              top: { style: "medium", color: { rgb: "000000" } },
              bottom: { style: "medium", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "A6A6A6" } },
              right: { style: "thin", color: { rgb: "A6A6A6" } }
            }
          };
        } else {
          const remarkVal = cell.v ? String(cell.v) : "";

          let remarkFontColor = "000000";
          let remarkFontBold = false;
          if (remarkVal === "폐강") {
            remarkFontColor = "FF0000";
            remarkFontBold = true;
          } else if (remarkVal === "논의") {
            remarkFontColor = "FF9900";
            remarkFontBold = true;
          } else if (remarkVal !== "개설" && remarkVal !== "") {
            remarkFontColor = "008000";
            remarkFontBold = true;
          }

          cell.s = {
            font: {
              name: "맑은 고딕",
              size: 10,
              color: C === 4 ? { rgb: remarkFontColor } : { rgb: "000000" },
              bold: C === 4 ? remarkFontBold : false
            },
            alignment: {
              horizontal: C === 2 ? "left" : "center",
              vertical: "center"
            },
            border: {
              top: { style: "thin", color: { rgb: "D9D9D9" } },
              bottom: { style: "thin", color: { rgb: "D9D9D9" } },
              left: { style: "thin", color: { rgb: "D9D9D9" } },
              right: { style: "thin", color: { rgb: "D9D9D9" } }
            }
          };
        }
      }
    }

    const rows = [
      { hpx: 40 },
      { hpx: 15 },
      { hpx: 28 }
    ];
    for (let r = 0; r < stats.length; r++) {
      rows.push({ hpx: 22 });
    }
    ws["!rows"] = rows;

    ws["!cols"] = [
      { wch: 12 },
      { wch: 15 },
      { wch: 30 },
      { wch: 15 },
      { wch: 15 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "과목 개설 여부");
    XLSX.writeFile(wb, `Subject_Opening_${activeGrade === "pre1" ? "1학년" : activeGrade === "grade1" ? "2학년" : "3학년"}_Analysis.xlsx`);
  };

  const categorySummaryData = useMemo(() => {
    const getElectiveSubjects = (gradeKey: GradeKey, gradeLabel: string) => {
      const stats = subjectStats[gradeKey] || [];
      return stats.map(stat => {
        const baseRemark = getClassRecommendation(stat.applicants, standardClassSize[gradeKey] || 25);
        const key = `${gradeKey}_${stat.semester}_${stat.subject}`;
        const displayRemark = manualStep5Classes[key] !== undefined ? manualStep5Classes[key] : baseRemark;

        if (displayRemark === "폐강" || isNaN(Number(displayRemark))) return null;

        const classes = Number(displayRemark);
        const normStatSubj = normalizeSubjectName(stat.subject);
        const parsedSubj = parsedCurriculumList[gradeKey]?.find(p => normalizeSubjectName(p.subject) === normStatSubj);

        let sem1 = 0, sem2 = 0;
        if (stat.semester.includes("1학기") && parsedSubj?.sem1) sem1 = parsedSubj.sem1;
        if (stat.semester.includes("2학기") && parsedSubj?.sem2) sem2 = parsedSubj.sem2;

        let category = subjectMap[gradeKey]?.[stat.subject];
        if (!category && subjectMap[gradeKey]) {
          const matchedKey = Object.keys(subjectMap[gradeKey]).find(k => normalizeSubjectName(k) === normStatSubj);
          if (matchedKey) category = subjectMap[gradeKey][matchedKey];
        }
        category = category || "기타";

        return {
          subject: stat.subject,
          category,
          detailedCategory: parsedSubj?.category || "기타",
          isSplit: false,
          sem1,
          sem2,
          gradeLabel,
          isElective: true,
          electiveClasses: classes
        };
      }).filter(Boolean).flatMap(item => {
        if (!item) return [];
        const result = [item];

        // 일본어, 중국어 특수 처리
        if (item.subject.includes("일본어") && !item.subject.includes("회화")) {
          item.sem2 = 0; // 강제로 2학기 제외
          if (item.sem1 === 0) item.sem1 = 2; // 기본 시수
          item.detailedCategory = "일본어"; // 카테고리 강제 지정

          result.push({
            ...item,
            subject: "일본어 회화",
            sem1: 0,
            sem2: item.sem1,
            detailedCategory: "일본어",
          });
        } else if (item.subject.includes("중국어") && !item.subject.includes("회화")) {
          item.sem2 = 0; // 강제로 2학기 제외
          if (item.sem1 === 0) item.sem1 = 2; // 기본 시수
          item.detailedCategory = "중국어"; // 카테고리 강제 지정

          result.push({
            ...item,
            subject: "중국어 회화",
            sem1: 0,
            sem2: item.sem1,
            detailedCategory: "중국어",
          });
        }

        return result;
      }) as any[];
    };

    const items = [
      ...designatedSubjects.pre1.map(d => ({ ...d, gradeLabel: "1", isElective: false })),
      ...designatedSubjects.grade1.map(d => ({ ...d, gradeLabel: "2", isElective: false })),
      ...designatedSubjects.grade2.map(d => ({ ...d, gradeLabel: "3", isElective: false })),
      ...getElectiveSubjects("pre1", "1"),
      ...getElectiveSubjects("grade1", "2"),
      ...getElectiveSubjects("grade2", "3"),
    ];

    const preferredOrder = ["국어", "수학", "영어", "한국사", "사회", "과학", "일본어", "중국어", "체육", "예술", "미술", "음악", "기술·가정", "정보", "제2외국어", "한문", "진로", "교양"];
    const categories = Array.from(new Set(items.map(item => item.detailedCategory).filter(Boolean)));
    categories.sort((a, b) => {
      const idxA = preferredOrder.indexOf(a);
      const idxB = preferredOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    const rows: CategorySummaryRow[] = [];

    categories.forEach(cat => {
      const catItems = items.filter(i => i.detailedCategory === cat);
      const sem1Items = catItems.filter(i => i.sem1 > 0).sort((a, b) => a.gradeLabel.localeCompare(b.gradeLabel));
      const sem2Items = catItems.filter(i => i.sem2 > 0).sort((a, b) => a.gradeLabel.localeCompare(b.gradeLabel));

      const maxLen = Math.max(sem1Items.length, sem2Items.length);
      if (maxLen === 0) return;

      let sem1Total = 0;
      let sem2Total = 0;

      const getClasses = (item: any, sem: number) => {
        const gk = item.gradeLabel === "1" ? "pre1" : item.gradeLabel === "2" ? "grade1" : "grade2";
        const key = `${item.gradeLabel}_${item.subject}_${sem}${item.isSplit ? '_split' : ''}`;

        if (item.isElective) return item.electiveClasses;
        if (manualClassCounts[key] !== undefined) return manualClassCounts[key];

        return item.isSplit ? 0 : totalClasses[gk];
      };

      const computedSem1Items = sem1Items.map(item => {
        const classes = getClasses(item, 1);
        const subjectHours = item.sem1 * classes;
        sem1Total += subjectHours;
        return { ...item, subjectHours, classCount: classes };
      });

      const computedSem2Items = sem2Items.map(item => {
        const classes = getClasses(item, 2);
        const subjectHours = item.sem2 * classes;
        sem2Total += subjectHours;
        return { ...item, subjectHours, classCount: classes };
      });

      const reduction = headTeacherReductions[cat] || 0;
      const sem1TotalOriginal = sem1Total;
      const sem2TotalOriginal = sem2Total;

      sem1Total = Math.max(0, sem1Total - reduction);
      sem2Total = Math.max(0, sem2Total - reduction);

      const yearTotal = sem1Total + sem2Total;
      const tc = teacherCounts[cat] || 0;
      const sem1Avg = tc > 0 ? (sem1Total / tc).toFixed(1) : "0.0";
      const sem2Avg = tc > 0 ? (sem2Total / tc).toFixed(1) : "0.0";
      const yearAvg = tc > 0 ? (yearTotal / tc).toFixed(1) : "0.0";
      const semesterAvg = tc > 0 ? ((yearTotal / tc) / 2).toFixed(1) : "0.0";
      const yearAvgFormatted = `${yearAvg} (${semesterAvg})`;

      for (let i = 0; i < maxLen; i++) {
        rows.push({
          category: cat,
          isFirstRow: i === 0,
          rowSpan: maxLen,
          reduction,
          sem1TotalOriginal,
          sem2TotalOriginal,
          sem1Total,
          sem2Total,
          yearTotal,
          sem1Avg,
          sem2Avg,
          yearAvg: yearAvgFormatted,
          sem1: computedSem1Items[i] ? { gradeLabel: computedSem1Items[i].gradeLabel, subject: computedSem1Items[i].subject, credits: computedSem1Items[i].sem1, isSplit: computedSem1Items[i].isSplit, subjectHours: computedSem1Items[i].subjectHours, isElective: computedSem1Items[i].isElective, classCount: computedSem1Items[i].classCount } : null,
          sem2: computedSem2Items[i] ? { gradeLabel: computedSem2Items[i].gradeLabel, subject: computedSem2Items[i].subject, credits: computedSem2Items[i].sem2, isSplit: computedSem2Items[i].isSplit, subjectHours: computedSem2Items[i].subjectHours, isElective: computedSem2Items[i].isElective, classCount: computedSem2Items[i].classCount } : null,
        });
      }
    });

    return rows;
  }, [designatedSubjects, manualClassCounts, totalClasses, teacherCounts, headTeacherReductions, subjectStats, manualStep5Classes, standardClassSize, parsedCurriculumList, subjectMap]);

  const handleExportCategorySummary = () => {
    if (categorySummaryData.length === 0) return;

    const aoa = [];

    // Title row
    aoa.push(["교과(군)별 시수 정리표"]);
    aoa.push([]);

    // Header rows
    aoa.push([
      "교과(군)", "교사 수", "1학기", "", "", "", "", "", "", "2학기", "", "", "", "", "", "", "평균 시수\n(1년/학기당)"
    ]);
    aoa.push([
      "", "", "학년", "과목명", "운영학점", "개설반", "과목별 시수", "교과별 총 시수", "교과별 평균시수", "학년", "과목명", "운영학점", "개설반", "과목별 시수", "교과별 총 시수", "교과별 평균시수", ""
    ]);

    const greenFill = { fgColor: { rgb: "E6F4EA" } }; // Designated
    const purpleFill = { fgColor: { rgb: "F3E5F5" } }; // Elective
    const headerFill = { fgColor: { rgb: "D9E1F2" } }; // Light Slate/Blue
    const borderAll = {
      top: { style: "thin", color: { rgb: "334155" } },
      bottom: { style: "thin", color: { rgb: "334155" } },
      left: { style: "thin", color: { rgb: "334155" } },
      right: { style: "thin", color: { rgb: "334155" } }
    };
    const centerAlign = { vertical: "center", horizontal: "center", wrapText: true };

    // Apply data rows
    categorySummaryData.forEach(row => {
      const rowData = [];
      // 0, 1
      rowData.push(row.isFirstRow ? row.category : "");
      rowData.push(row.isFirstRow ? (teacherCounts[row.category] || "") : "");

      // 2~6 (1학기 상세)
      rowData.push(row.sem1 ? row.sem1.gradeLabel : "");
      rowData.push(row.sem1 ? row.sem1.subject : "");
      rowData.push(row.sem1 ? row.sem1.credits : "");
      rowData.push(row.sem1 ? (row.sem1.isSplit ? "-" : row.sem1.classCount) : "");
      rowData.push(row.sem1 ? row.sem1.subjectHours : "");

      // 7~8 (1학기 요약)
      rowData.push(row.isFirstRow ? `${row.sem1Total}${row.reduction ? `\n(${row.sem1TotalOriginal}-${row.reduction})` : ''}` : "");
      rowData.push(row.isFirstRow ? row.sem1Avg : "");

      // 9~13 (2학기 상세)
      rowData.push(row.sem2 ? row.sem2.gradeLabel : "");
      rowData.push(row.sem2 ? row.sem2.subject : "");
      rowData.push(row.sem2 ? row.sem2.credits : "");
      rowData.push(row.sem2 ? (row.sem2.isSplit ? "-" : row.sem2.classCount) : "");
      rowData.push(row.sem2 ? row.sem2.subjectHours : "");

      // 14~15 (2학기 요약)
      rowData.push(row.isFirstRow ? `${row.sem2Total}${row.reduction ? `\n(${row.sem2TotalOriginal}-${row.reduction})` : ''}` : "");
      rowData.push(row.isFirstRow ? row.sem2Avg : "");

      // 16 (1년 평균)
      rowData.push(row.isFirstRow ? row.yearAvg : "");

      aoa.push(rowData);
    });

    // Total row
    const totalSem1Hours = categorySummaryData.reduce((acc, row) => acc + (row.sem1?.subjectHours || 0), 0);
    const totalSem2Hours = categorySummaryData.reduce((acc, row) => acc + (row.sem2?.subjectHours || 0), 0);
    const totalYearHours = categorySummaryData.filter(r => r.isFirstRow).reduce((acc, row) => acc + row.yearTotal, 0);

    aoa.push([
      "총계", "", "", "", "", "", totalSem1Hours, "1학기 총 시수:", totalSem1Hours, "", "", "", "", totalSem2Hours, "2학기 총 시수:", totalSem2Hours, `1년 총 시수: ${totalYearHours}`
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Styling & Merges
    const merges = [];
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 16 } }); // Title

    // Header merges
    merges.push({ s: { r: 2, c: 0 }, e: { r: 3, c: 0 } }); // 교과군
    merges.push({ s: { r: 2, c: 1 }, e: { r: 3, c: 1 } }); // 교사 수
    merges.push({ s: { r: 2, c: 2 }, e: { r: 2, c: 8 } }); // 1학기 (7 columns)
    merges.push({ s: { r: 2, c: 9 }, e: { r: 2, c: 15 } }); // 2학기 (7 columns)
    merges.push({ s: { r: 2, c: 16 }, e: { r: 3, c: 16 } }); // 평균 시수

    // Apply merges for data rows (rowSpan)
    let currentDataRow = 4;
    categorySummaryData.forEach((row) => {
      if (row.isFirstRow && row.rowSpan > 1) {
        merges.push({ s: { r: currentDataRow, c: 0 }, e: { r: currentDataRow + row.rowSpan - 1, c: 0 } });
        merges.push({ s: { r: currentDataRow, c: 1 }, e: { r: currentDataRow + row.rowSpan - 1, c: 1 } });
        merges.push({ s: { r: currentDataRow, c: 7 }, e: { r: currentDataRow + row.rowSpan - 1, c: 7 } });
        merges.push({ s: { r: currentDataRow, c: 8 }, e: { r: currentDataRow + row.rowSpan - 1, c: 8 } });
        merges.push({ s: { r: currentDataRow, c: 14 }, e: { r: currentDataRow + row.rowSpan - 1, c: 14 } });
        merges.push({ s: { r: currentDataRow, c: 15 }, e: { r: currentDataRow + row.rowSpan - 1, c: 15 } });
        merges.push({ s: { r: currentDataRow, c: 16 }, e: { r: currentDataRow + row.rowSpan - 1, c: 16 } });
      }
      currentDataRow++;
    });

    // Total row merges
    const totalRowIdx = 4 + categorySummaryData.length;
    merges.push({ s: { r: totalRowIdx, c: 0 }, e: { r: totalRowIdx, c: 5 } });
    merges.push({ s: { r: totalRowIdx, c: 7 }, e: { r: totalRowIdx, c: 8 } });
    merges.push({ s: { r: totalRowIdx, c: 9 }, e: { r: totalRowIdx, c: 12 } });
    merges.push({ s: { r: totalRowIdx, c: 14 }, e: { r: totalRowIdx, c: 15 } });

    ws["!merges"] = merges;

    // Apply styles to cells
    const range = XLSX.utils.decode_range(ws["!ref"]!);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = { c: C, r: R };
        const cellRef = XLSX.utils.encode_cell(cellAddress);
        if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };

        ws[cellRef].s = {
          font: { name: "맑은 고딕", sz: 11, color: { rgb: "000000" } },
          alignment: centerAlign,
          border: borderAll
        };

        // Title
        if (R === 0) {
          ws[cellRef].s.font.sz = 16;
          ws[cellRef].s.font.bold = true;
          ws[cellRef].s.border = {};
        } else if (R === 1) {
          ws[cellRef].s.border = {};
        }
        // Headers
        else if (R === 2 || R === 3) {
          ws[cellRef].s.fill = headerFill;
          ws[cellRef].s.font.bold = true;
        }
        // Data Rows
        else if (R >= 4 && R < totalRowIdx) {
          const dataIdx = R - 4;
          const rowData = categorySummaryData[dataIdx];

          if (C >= 2 && C <= 6 && rowData.sem1) {
             ws[cellRef].s.fill = rowData.sem1.isElective ? purpleFill : greenFill;
          }
          if (C >= 9 && C <= 13 && rowData.sem2) {
             ws[cellRef].s.fill = rowData.sem2.isElective ? purpleFill : greenFill;
          }
          if (C === 0 || C === 1 || C === 7 || C === 8 || C === 14 || C === 15 || C === 16) {
            ws[cellRef].s.fill = { fgColor: { rgb: "F8FAFC" } }; // Very light slate for base columns
          }
        }
        // Total row
        else if (R === totalRowIdx) {
          ws[cellRef].s.fill = headerFill;
          ws[cellRef].s.font.bold = true;
        }
      }
    }

    ws["!cols"] = [
      { wch: 8 },  // 0: 교과군
      { wch: 8 },  // 1: 교사 수
      { wch: 10 }, // 2: 1학기 학년
      { wch: 20 }, // 3: 1학기 과목
      { wch: 10 }, // 4: 1학기 학점
      { wch: 10 }, // 5: 1학기 반수
      { wch: 12 }, // 6: 1학기 과목별시수
      { wch: 15 }, // 7: 1학기 교과별총시수
      { wch: 15 }, // 8: 1학기 평균시수
      { wch: 10 }, // 9: 2학기 학년
      { wch: 20 }, // 10: 2학기 과목
      { wch: 10 }, // 11: 2학기 학점
      { wch: 10 }, // 12: 2학기 반수
      { wch: 12 }, // 13: 2학기 과목별시수
      { wch: 15 }, // 14: 2학기 교과별총시수
      { wch: 15 }, // 15: 2학기 평균시수
      { wch: 20 }, // 16: 1년 평균
    ];

    XLSX.utils.book_append_sheet(wb, ws, "시수정리");
    XLSX.writeFile(wb, `교과군별_시수정리표.xlsx`);
  };

  return {
    handleExport,
    handleExportStep5,
    categorySummaryData,
    handleExportCategorySummary,
  };
}
