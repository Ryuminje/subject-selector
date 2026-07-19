"use client";

import React, { useState, useRef, useMemo } from "react";
import { Upload, FileText, Settings, Download, CheckCircle2, ChevronRight, Trash2, File as FileIcon, Save, FolderOpen, GitBranch, Plus, RotateCcw } from "lucide-react";
import * as XLSX from "xlsx-js-style";
import { SearchableSelect } from "../ui/SearchableSelect";
import { useMainCurriculum } from "../../features/main-survey/hooks/useMainCurriculum";
import { useMainUploads, normalizeSubjectName } from "../../features/main-survey/hooks/useMainUploads";
import type { GradeKey } from "../../types";

export function MainSurveyTab() {
  const [activeTab, setActiveTab] = useState("curriculum");
  const [activeGrade, setActiveGrade] = useState<GradeKey>("grade1");
  const [isExampleModalOpen, setIsExampleModalOpen] = useState(false);

  const {
    parsedCurriculumList, setParsedCurriculumList,
    subjectMap, setSubjectMap,
    isCurriculumParsed, setIsCurriculumParsed,
    hierarchyRules, setHierarchyRules,
    designatedSubjects, setDesignatedSubjects,
    selectedSubjectHours, setSelectedSubjectHours,
    editingDetailedCategory, setEditingDetailedCategory,
    detailedCategoryEditValue, setDetailedCategoryEditValue,
    handleCurriculumUpload,
    handleDetailedCategoryUpdate,
  } = useMainCurriculum(activeGrade);

  const {
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
  } = useMainUploads(activeGrade, parsedCurriculumList, subjectMap, hierarchyRules);

  const [standardClassSize, setStandardClassSize] = useState<{ [key in GradeKey]: number }>({ pre1: 25, grade1: 25, grade2: 25 });
  const [manualClassCounts, setManualClassCounts] = useState<{ [subjectKey: string]: number }>({});
  const [editingClasses, setEditingClasses] = useState<{ [subjectKey: string]: boolean }>({});
  const [teacherCounts, setTeacherCounts] = useState<{ [category: string]: number }>({});
  const [headTeacherReductions, setHeadTeacherReductions] = useState<{ [category: string]: number }>({});
  const [headTeacherCategoryInput, setHeadTeacherCategoryInput] = useState<string>("");
  const [editingTeachers, setEditingTeachers] = useState<{ [category: string]: boolean }>({});
  const [manualStep5Classes, setManualStep5Classes] = useState<{ [key: string]: string }>({});
  const [editingStep5Classes, setEditingStep5Classes] = useState<{ [key: string]: boolean }>({});


  const fileInputRef = useRef<HTMLInputElement>(null);

  if (typeof window !== "undefined") {
    (window as any).getMainBackup = () => ({
    activeGrade,
    parsedCurriculumList,
    subjectMap,
    isCurriculumParsed,
    hierarchyRules,
    uploadedFiles,
    processedData,
    rawSheetData,
    previousHistoryFiles,
    previousSubjectMap,
    subjectStats,
    standardClassSize,
    totalClasses,
    manualClassCounts,
    manualStep5Classes,
    teacherCounts,
    designatedSubjects,
    selectedSubjectHours,
    headTeacherReductions
  });

  (window as any).loadMainBackup = (parsed: any) => {
    if (parsed.activeGrade) setActiveGrade(parsed.activeGrade);
    if (parsed.parsedCurriculumList) setParsedCurriculumList({ pre1: [], grade1: [], grade2: [], ...parsed.parsedCurriculumList });
    if (parsed.subjectMap) setSubjectMap({ pre1: {}, grade1: {}, grade2: {}, ...parsed.subjectMap });
    if (parsed.isCurriculumParsed) setIsCurriculumParsed({ pre1: false, ...parsed.isCurriculumParsed });
    if (parsed.hierarchyRules) setHierarchyRules({ pre1: [], ...parsed.hierarchyRules });
    if (parsed.uploadedFiles) setUploadedFiles({ pre1: null, grade1: null, grade2: null, ...parsed.uploadedFiles });
    if (parsed.processedData) setProcessedData({ pre1: [], grade1: [], grade2: [], ...parsed.processedData });
    if (parsed.rawSheetData) setRawSheetData({ pre1: [], grade1: [], grade2: [], ...parsed.rawSheetData });
    if (parsed.previousHistoryFiles) setPreviousHistoryFiles({ pre1: null, grade1: null, grade2: null, ...parsed.previousHistoryFiles });
    if (parsed.previousSubjectMap) setPreviousSubjectMap({ pre1: {}, grade1: {}, grade2: {}, ...parsed.previousSubjectMap });
    if (parsed.subjectStats) setSubjectStats({ pre1: [], grade1: [], grade2: [], ...parsed.subjectStats });
    if (parsed.standardClassSize) setStandardClassSize({ pre1: 25, ...parsed.standardClassSize });
    if (parsed.totalClasses) setTotalClasses({ pre1: 10, grade1: 10, grade2: 10, ...parsed.totalClasses });
    if (parsed.manualClassCounts) setManualClassCounts(parsed.manualClassCounts);
    if (parsed.manualStep5Classes) setManualStep5Classes(parsed.manualStep5Classes);
    if (parsed.teacherCounts) setTeacherCounts(parsed.teacherCounts);
    if (parsed.headTeacherReductions) setHeadTeacherReductions(parsed.headTeacherReductions);
    if (parsed.designatedSubjects) setDesignatedSubjects({ pre1: [], ...parsed.designatedSubjects });
    if (parsed.selectedSubjectHours) setSelectedSubjectHours({ pre1: [], ...parsed.selectedSubjectHours });
  };
  }

  const handleSaveBackup = async () => {
    const fullBackup = {
      version: 2,
      demand: (window as any).getDemandBackup?.() || {},
      main: (window as any).getMainBackup?.() || {},
      change: (window as any).getChangeBackup?.() || {}
    };
    
    const jsonString = JSON.stringify(fullBackup, null, 2);
    const suggestedName = "2026학년도 수강신청(본조사) 및 선택과목 변경.json";

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


  const renderGradeTabs = () => (
    <div className="flex gap-2 mb-6 border-b border-slate-800 pb-4">
      <button
        onClick={() => setActiveGrade("pre1")}
        className={`px-6 py-2.5 rounded-xl font-medium transition-all ${activeGrade === "pre1" ? "bg-indigo-600/20 text-white border border-indigo-500/30 shadow-inner" : "text-white hover:text-white hover:bg-slate-800/50"
          }`}
      >
        예비 1학년
      </button>
      <button
        onClick={() => setActiveGrade("grade1")}
        className={`px-6 py-2.5 rounded-xl font-medium transition-all ${activeGrade === "grade1" ? "bg-indigo-600/20 text-white border border-indigo-500/30 shadow-inner" : "text-white hover:text-white hover:bg-slate-800/50"
          }`}
      >
        1학년
      </button>
      <button
        onClick={() => setActiveGrade("grade2")}
        className={`px-6 py-2.5 rounded-xl font-medium transition-all ${activeGrade === "grade2" ? "bg-indigo-600/20 text-white border border-indigo-500/30 shadow-inner" : "text-white hover:text-white hover:bg-slate-800/50"
          }`}
      >
        2학년
      </button>
    </div>
  );

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

  const getClassRecommendation = (applicants: number, standardSize: number) => {
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

  const activeData = processedData[activeGrade];
  const maxSem1 = activeData.length > 0 ? Math.max(4, ...activeData.map(d => d.semester1.length)) : 4;
  const maxSem1_2 = activeData.length > 0 ? Math.max(0, ...activeData.map(d => (d.semester1_2 || []).length)) : 0;
  const maxSem2 = activeData.length > 0 ? Math.max(4, ...activeData.map(d => d.semester2.length)) : 4;




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
    let categories = Array.from(new Set(items.map(item => item.detailedCategory).filter(Boolean)));
    categories.sort((a, b) => {
      const idxA = preferredOrder.indexOf(a);
      const idxB = preferredOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    const rows: Array<{
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
    }> = [];

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


  return ( <>
        {/* Global Header */}
        <header className="flex-none px-10 py-5 border-b border-slate-800/30 bg-slate-950/40 backdrop-blur-sm flex flex-col gap-4">
          <div className="flex items-center justify-between w-full">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              명신고등학교 수강신청(본조사) 데이터 정리
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
                  <button onClick={() => setActiveTab('curriculum')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${activeTab === 'curriculum' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">1단계</span><div className="flex items-center gap-1.5"><Settings className="w-4 h-4" /><span>교육과정 편성표 입력</span></div></button>
                  <button onClick={() => setActiveTab('hierarchy')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${activeTab === 'hierarchy' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">2단계</span><div className="flex items-center gap-1.5"><GitBranch className="w-4 h-4" /><span>과목 위계 설정</span></div></button>
                  <button onClick={() => setActiveTab('upload')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${activeTab === 'upload' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">3단계</span><div className="flex items-center gap-1.5"><Upload className="w-4 h-4" /><span>데이터 업로드</span></div></button>
                  <button onClick={() => setActiveTab('preview')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${activeTab === 'preview' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">4단계</span><div className="flex items-center gap-1.5"><FileText className="w-4 h-4" /><span>수강신청(본조사) 결과</span></div></button>
                  <button onClick={() => setActiveTab('classOpening')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${activeTab === 'classOpening' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">5단계</span><div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /><span>과목 개설 여부</span></div></button>
                  <button onClick={() => setActiveTab('categorySummary')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${activeTab === 'categorySummary' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">6단계</span><div className="flex items-center gap-1.5"><FileText className="w-4 h-4" /><span>교과(군)별 시수 정리</span></div></button>
                </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 pb-24">
          <div className="w-full mx-auto">

                <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/60 rounded-3xl p-8 shadow-2xl">
                  {activeTab === "curriculum" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex justify-between items-center mb-2">
                        <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                          <Settings className="w-6 h-6 text-indigo-400" />
                          1단계: 교육과정 편성표 입력
                        </h2>
                      </div>

                      {renderGradeTabs()}

                      <p className="text-slate-300">
                        선택하신 학년의 교육과정 편성표 엑셀 파일을 업로드해 주세요. 3개년 데이터가 모두 포함된 원본 엑셀 파일을 그대로 올리시면 됩니다.
                      </p>

                                            <button
                        onClick={() => setIsExampleModalOpen(true)}
                        className="mb-4 flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-white text-sm font-semibold rounded-xl border border-indigo-500/30 transition-all shadow-sm"
                      >
                        <span className="text-base">💡</span> 올바른 엑셀 입력 예시 보기
                      </button>

                      <div className="relative group">
                        <input
                          type="file"
                          accept=".xlsx, .xls"
                          onChange={handleCurriculumUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="flex flex-col items-center justify-center w-full h-40 bg-slate-900/50 border-2 border-dashed border-slate-700 rounded-xl group-hover:border-indigo-500/50 group-hover:bg-indigo-500/5 transition-all">
                          <Upload className="w-10 h-10 text-slate-300 group-hover:text-indigo-400 mb-3 transition-colors" />
                          <p className="text-slate-300 font-medium">클릭하거나 엑셀 파일을 드래그하여 업로드하세요</p>
                          <p className="text-slate-300 text-sm mt-1">.xlsx, .xls 파일 지원</p>
                        </div>
                      </div>

                      {isCurriculumParsed[activeGrade] && parsedCurriculumList[activeGrade]?.length > 0 && (
                        <div className="mt-8 p-6 bg-slate-950/50 border border-slate-800 rounded-2xl animate-in fade-in">
                          <h3 className="text-xl font-medium text-slate-200 mb-4 flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            추출된 교육과정 데이터 ({activeGrade === "pre1" ? "1학년 탭" : activeGrade === "grade1" ? "2학년 탭" : "3학년 탭"})
                          </h3>
                          <p className="text-sm text-slate-300 mb-6">
                            업로드된 엑셀 파일에서 1~3학년 전체 교육과정을 자동으로 분석했습니다. 내부적으로 기초/사회/과학 과목 매핑도 완료되었습니다.
                          </p>

                          <div className="overflow-x-auto rounded-lg border border-slate-800">
                            <table className="w-full text-sm text-left">
                              <thead className="text-xs text-slate-300 uppercase bg-slate-900/80">
                                <tr>
                                  <th className="px-4 py-3 font-medium">구분</th>
                                  <th className="px-4 py-3 font-medium">과목명</th>
                                  <th className="px-4 py-3 font-medium">교과(군)</th>
                                  <th className="px-4 py-3 font-medium text-center">운영학점</th>
                                  <th className="px-4 py-3 font-medium">개설학기</th>
                                  <th className="px-4 py-3 font-medium text-center">비고</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/50">
                                {parsedCurriculumList[activeGrade].map((subj, idx) => (
                                  <tr key={idx} className="bg-slate-950/30 hover:bg-slate-900/50 transition-colors">
                                    <td className="px-4 py-3">
                                      <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider ${subj.type === "지정" ? "bg-rose-600/10 text-rose-400 border border-rose-500/20" : "bg-indigo-500/10 text-white border border-indigo-500/20"
                                        }`}>
                                        {subj.type}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 font-medium text-slate-200">{subj.subject}</td>
                                    <td className="px-4 py-3 text-slate-300">
                                      {editingDetailedCategory?.grade === activeGrade && editingDetailedCategory?.index === idx ? (
                                        <input
                                          type="text"
                                          autoFocus
                                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200"
                                          value={detailedCategoryEditValue}
                                          onChange={(e) => setDetailedCategoryEditValue(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleDetailedCategoryUpdate(activeGrade, idx, subj.subject, detailedCategoryEditValue);
                                          }}
                                          onBlur={() => handleDetailedCategoryUpdate(activeGrade, idx, subj.subject, detailedCategoryEditValue)}
                                        />
                                      ) : (
                                        <span className="cursor-pointer hover:text-indigo-400" onClick={() => {
                                          setEditingDetailedCategory({ grade: activeGrade, index: idx });
                                          setDetailedCategoryEditValue(subj.category);
                                        }} title="클릭하여 수동 수정">
                                          {subj.category}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-center text-amber-400/90 font-mono">{subj.credits}</td>
                                    <td className="px-4 py-3 text-slate-300 text-xs">{subj.semesters}</td>
                                    <td className="px-4 py-3 text-center">
                                      {["국어", "수학", "영어"].includes(subj.category) && (
                                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
                                          기초
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="mt-8 flex justify-end">
                            <button
                              onClick={() => setActiveTab("hierarchy")}
                              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-colors border border-slate-700 flex items-center gap-2"
                            >
                              다음 단계(위계 설정)로 이동
                              <GitBranch className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "hierarchy" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex justify-between items-center mb-2">
                        <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                          <GitBranch className="w-6 h-6 text-amber-400" />
                          2단계: 과목 위계(선수 과목) 설정
                        </h2>
                      </div>

                      {renderGradeTabs()}

                      <p className="text-slate-300">
                        특정 과목을 수강하기 위해 먼저 들어야 하는 선수 과목 규칙을 설정할 수 있습니다. 1단계에서 분석된 과목들만 선택 가능합니다.
                      </p>

                      {!isCurriculumParsed[activeGrade] || Object.keys(subjectMap[activeGrade]).length === 0 ? (
                        <div className="p-8 bg-slate-950/50 border border-slate-800 rounded-2xl text-center">
                          <p className="text-slate-300">먼저 교육과정 설정 탭에서 과목을 분석해 주세요.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <button
                            onClick={() => {
                              const subjects = Object.keys(subjectMap[activeGrade]);
                              if (subjects.length > 0) {
                                setHierarchyRules(prev => ({
                                  ...prev,
                                  [activeGrade]: [...(prev[activeGrade] || []), { id: Date.now().toString(), prereq: subjects[0], advanced: subjects[0] }]
                                }));
                              }
                            }}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors border border-slate-700 flex items-center gap-2 text-sm"
                          >
                            <Plus className="w-4 h-4" />
                            새로운 위계 규칙 추가
                          </button>

                          {(!hierarchyRules[activeGrade] || hierarchyRules[activeGrade].length === 0) && (
                            <div className="p-6 bg-slate-900/50 border border-dashed border-slate-700 rounded-xl text-center text-slate-300 text-sm">
                              설정된 위계 규칙이 없습니다. 필요한 경우 규칙을 추가해 주세요.
                            </div>
                          )}

                          <div className="grid gap-3">
                            {(hierarchyRules[activeGrade] || []).map((rule, idx) => (
                              <div key={rule.id} className="flex items-center gap-3 p-4 bg-slate-900 border border-slate-700/50 rounded-xl">
                                <span className="text-slate-300 font-medium">#{idx + 1}</span>
                                <div className="flex-1 flex items-center gap-4">
                                  <div className="flex-1">
                                    <label className="block text-xs text-slate-300 mb-1">선행 과목 (먼저 듣는 과목)</label>
                                    <SearchableSelect
                                      options={Object.keys(subjectMap[activeGrade])}
                                      value={rule.prereq}
                                      onChange={(val) => {
                                        const newRules = [...hierarchyRules[activeGrade]];
                                        newRules[idx].prereq = val;
                                        setHierarchyRules(prev => ({ ...prev, [activeGrade]: newRules }));
                                      }}
                                      placeholder="선행 과목 검색..."
                                    />
                                  </div>
                                  <ChevronRight className="w-5 h-5 text-slate-600 mt-5" />
                                  <div className="flex-1">
                                    <label className="block text-xs text-slate-300 mb-1">후행 과목 (나중에 듣는 과목)</label>
                                    <SearchableSelect
                                      options={Object.keys(subjectMap[activeGrade])}
                                      value={rule.advanced}
                                      onChange={(val) => {
                                        const newRules = [...hierarchyRules[activeGrade]];
                                        newRules[idx].advanced = val;
                                        setHierarchyRules(prev => ({ ...prev, [activeGrade]: newRules }));
                                      }}
                                      placeholder="후행 과목 검색..."
                                    />
                                  </div>
                                </div>
                                <button
                                  onClick={() => {
                                    const newRules = hierarchyRules[activeGrade].filter(r => r.id !== rule.id);
                                    setHierarchyRules(prev => ({ ...prev, [activeGrade]: newRules }));
                                  }}
                                  className="mt-5 p-2 text-white hover:text-rose-400 hover:bg-rose-600/10 rounded-lg transition-colors"
                                  title="규칙 삭제"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            ))}
                          </div>

                          <div className="mt-8 flex justify-end">
                            <button
                              onClick={() => setActiveTab("upload")}
                              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-colors border border-slate-700 flex items-center gap-2"
                            >
                              다음 단계(파일 업로드)로 이동
                              <Upload className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "upload" && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div>
                        <h2 className="text-2xl font-semibold text-white flex items-center gap-2 mb-2">
                          <Upload className="w-6 h-6 text-rose-400" />
                          3단계: 데이터 파일 업로드
                        </h2>
                        <p className="text-slate-300 text-sm">
                          당해년도 수강신청(본조사) 설문 파일과 이전 학년의 이수 이력 데이터(선택)를 업로드해 주세요.
                        </p>
                      </div>

                      {renderGradeTabs()}

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* 1. 당해년도 수강신청 파일 업로드 */}
                        <div className="space-y-3">
                          <h3 className="text-lg font-medium text-slate-200 flex items-center gap-2">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500/20 text-white text-xs font-bold">1</span>
                            당해년도 수강신청(본조사) 설문 파일 (필수)
                          </h3>

                          {!uploadedFiles[activeGrade] ? (
                            <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500/50 bg-slate-950/30 rounded-2xl p-12 text-center transition-all duration-300 group cursor-pointer relative">
                              <input
                                key={`curr-${activeGrade}`}
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleFileUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              />
                              <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform duration-300 border border-slate-800">
                                <Upload className="w-6 h-6 text-indigo-400" />
                              </div>
                              <h4 className="text-md font-medium text-slate-200 mb-1">
                                리로스쿨 설문 제출내역 파일을 업로드하세요.
                              </h4>
                              <p className="text-xs text-slate-300 mb-4">또는 클릭하여 컴퓨터에서 선택 (.xlsx, .xls)</p>
                              <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors border border-slate-700">
                                파일 선택
                              </button>
                            </div>
                          ) : (
                            <div className="border border-slate-805 bg-slate-900/30 rounded-2xl p-6 flex flex-col justify-between h-[196px]">
                              <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-indigo-500/20 text-white rounded-xl flex items-center justify-center border border-indigo-500/30 flex-shrink-0">
                                  <FileIcon className="w-6 h-6" />
                                </div>
                                <div className="overflow-hidden">
                                  <h4 className="text-md font-medium text-slate-200 truncate" title={uploadedFiles[activeGrade]?.name}>
                                    {uploadedFiles[activeGrade]?.name}
                                  </h4>
                                  <p className="text-xs text-slate-300 mt-1">
                                    {(uploadedFiles[activeGrade]!.size / 1024).toFixed(1)} KB
                                  </p>
                                  <span className="inline-block mt-2 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded border border-emerald-500/20">
                                    업로드 완료
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setActiveTab("preview")}
                                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
                                >
                                  결과 미리보기
                                </button>
                                <button
                                  onClick={handleRemoveFile}
                                  className="px-3 py-2 bg-slate-850 hover:bg-rose-600/20 hover:text-rose-400 text-white rounded-lg transition-colors border border-slate-800"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 2. 이전 학년 이수 이력 파일 업로드 */}
                        <div className="space-y-3">
                          <h3 className="text-lg font-medium text-slate-200 flex items-center gap-2">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">2</span>
                            이전 학년 이수 이력 파일 (선택)
                          </h3>

                          {!previousHistoryFiles[activeGrade] ? (
                            <div className="border-2 border-dashed border-slate-700 hover:border-amber-500/50 bg-slate-950/30 rounded-2xl p-12 text-center transition-all duration-300 group cursor-pointer relative">
                              <input
                                key={`prev-${activeGrade}`}
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handlePrevHistoryFileUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              />
                              <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform duration-300 border border-slate-800">
                                <Upload className="w-6 h-6 text-amber-400" />
                              </div>
                              <h4 className="text-md font-medium text-slate-200 mb-1">
                                수강신청 통계 파일 업로드
                              </h4>
                              <p className="text-xs text-slate-300 mb-4 px-4 leading-relaxed">
                                "리로스쿨-교육과정-수강신청-통계-엑셀저장"에서 다운받은 수강신청 통계 파일을 업로드하세요.
                              </p>
                              <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors border border-slate-700">
                                파일 선택
                              </button>
                            </div>
                          ) : (
                            <div className="border border-slate-808 bg-slate-900/30 rounded-2xl p-6 flex flex-col justify-between h-[196px]">
                              <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center border border-amber-500/30 flex-shrink-0">
                                  <FileIcon className="w-6 h-6" />
                                </div>
                                <div className="overflow-hidden">
                                  <h4 className="text-md font-medium text-slate-200 truncate" title={previousHistoryFiles[activeGrade]?.name}>
                                    {previousHistoryFiles[activeGrade]?.name}
                                  </h4>
                                  <p className="text-xs text-slate-300 mt-1">
                                    {(previousHistoryFiles[activeGrade]!.size / 1024).toFixed(1)} KB
                                  </p>
                                  <span className="inline-block mt-2 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded border border-emerald-500/20">
                                    총 {Object.keys(previousSubjectMap[activeGrade] || {}).length}명 연동 완료
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <div className="flex-1 py-2 text-center text-slate-300 text-xs bg-slate-800/50 rounded-lg flex items-center justify-center border border-slate-800">
                                  다년도 위계 검사 자동 적용됨
                                </div>
                                <button
                                  onClick={handleRemovePrevHistoryFile}
                                  className="px-3 py-2 bg-slate-850 hover:bg-rose-600/20 hover:text-rose-400 text-white rounded-lg transition-colors border border-slate-800"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "preview" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex justify-between items-center mb-2">
                        <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                          <FileText className="w-6 h-6 text-emerald-400" />
                          4단계: 수강신청(본조사) 결과 및 다운로드
                        </h2>
                        <button
                          onClick={handleExport}
                          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-emerald-500/25 flex items-center gap-2"
                          disabled={activeData.length === 0}
                        >
                          <Download className="w-4 h-4" />
                          {activeGrade === "pre1" ? "1학년" : activeGrade === "grade1" ? "2학년" : "3학년"} 엑셀 다운로드
                        </button>
                      </div>

                      {renderGradeTabs()}

                      {activeData.length === 0 ? (
                        <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-8 text-center">
                          <p className="text-slate-300">선택하신 학년의 데이터가 아직 없습니다. 교육과정 설정과 파일 업로드를 진행해 주세요.</p>
                        </div>
                      ) : (
                        <div className="bg-slate-950/50 border border-slate-800 rounded-2xl overflow-hidden">
                          <div className="overflow-auto max-h-[650px] relative">
                            <table className="w-full text-sm text-left text-slate-300 border-collapse">
                              <thead className="text-xs text-slate-300 uppercase bg-slate-900 border-b border-slate-800">
                                <tr>
                                  <th className="px-2 py-2.5 whitespace-nowrap sticky top-0 left-0 z-40 bg-slate-900 min-w-[50px] max-w-[50px] border-r border-slate-800 text-center">순번</th>
                                  <th className="px-2 py-2.5 whitespace-nowrap sticky top-0 left-[50px] z-40 bg-slate-900 min-w-[80px] max-w-[80px] border-r border-slate-800 text-center">학번</th>
                                  <th className="px-2 py-2.5 whitespace-nowrap sticky top-0 left-[130px] z-40 bg-slate-900 min-w-[80px] max-w-[80px] border-r border-slate-800/50 text-center shadow-[2px_0_5px_rgba(0,0,0,0.3)]">이름</th>
                                  <th className="px-2 py-2.5 text-center whitespace-nowrap sticky top-0 z-10 bg-slate-900 border-r border-slate-800" colSpan={maxSem1}>1학기</th>
                                  {maxSem1_2 > 0 && <th className="px-2 py-2.5 text-center whitespace-nowrap sticky top-0 z-10 bg-slate-900 border-r border-slate-800" colSpan={maxSem1_2}>1~2학기</th>}
                                  <th className="px-2 py-2.5 text-center whitespace-nowrap sticky top-0 z-10 bg-slate-900 border-r border-slate-800" colSpan={maxSem2}>2학기</th>
                                  <th className="px-2 py-2.5 whitespace-nowrap sticky top-0 z-10 bg-slate-900 text-center">기초과목</th>
                                  <th className="px-2 py-2.5 whitespace-nowrap sticky top-0 z-10 bg-slate-900 text-center">사회</th>
                                  <th className="px-2 py-2.5 whitespace-nowrap sticky top-0 z-10 bg-slate-900 text-center">과학</th>
                                  <th className="px-2 py-2.5 whitespace-nowrap sticky top-0 z-10 bg-slate-900">비고(중복)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {activeData.map((row, idx) => (
                                  <tr key={idx} className="group border-b border-slate-800/50 hover:bg-slate-900/50">
                                    <td className="px-2 py-2.5 whitespace-nowrap sticky left-0 z-20 bg-slate-950 group-hover:bg-slate-900 min-w-[50px] max-w-[50px] border-r border-slate-800 text-center">{idx + 1}</td>
                                    <td className="px-2 py-2.5 font-medium text-white whitespace-nowrap sticky left-[50px] z-20 bg-slate-950 group-hover:bg-slate-900 min-w-[80px] max-w-[80px] border-r border-slate-800 text-center">{row.studentId}</td>
                                    <td className="px-2 py-2.5 whitespace-nowrap sticky left-[130px] z-20 bg-slate-950 group-hover:bg-slate-900 min-w-[80px] max-w-[80px] border-r border-slate-800/50 text-center shadow-[2px_0_5px_rgba(0,0,0,0.3)]">{row.name}</td>
                                    {Array.from({ length: maxSem1 }).map((_, i) => {
                                      const subject = row.semester1[i] || "";
                                      const normS = (s: string) => s ? s.replace(/\s+/g, '').replace(/Ⅰ/g, 'I').replace(/Ⅱ/g, 'II').replace(/Ⅲ/g, 'III') : '';
                                      const isDuplicate = subject && row.duplicateSubjects?.some(d => normS(d) === normS(subject));
                                      const isHierarchyViolation = subject && row.hierarchyViolations?.some(v => normS(v.subject) === normS(subject) || normS(v.prereq) === normS(subject));
                                      let cellClass = "px-2 py-2.5 whitespace-nowrap ";
                                      if (isHierarchyViolation) cellClass += "text-cyan-400 font-bold bg-cyan-400/10 rounded-md";
                                      else if (isDuplicate) cellClass += "text-yellow-400 font-bold bg-yellow-400/10 rounded-md";

                                      return (
                                        <td key={`s1-${i}`} className={cellClass}>
                                          {subject}
                                        </td>
                                      );
                                    })}
                                    {maxSem1_2 > 0 && Array.from({ length: maxSem1_2 }).map((_, i) => {
                                      const subject = (row.semester1_2 || [])[i] || "";
                                      const normS = (s: string) => s ? s.replace(/\s+/g, '').replace(/Ⅰ/g, 'I').replace(/Ⅱ/g, 'II').replace(/Ⅲ/g, 'III') : '';
                                      const isDuplicate = subject && row.duplicateSubjects?.some(d => normS(d) === normS(subject));
                                      const isHierarchyViolation = subject && row.hierarchyViolations?.some(v => normS(v.subject) === normS(subject) || normS(v.prereq) === normS(subject));
                                      let cellClass = "px-2 py-2.5 whitespace-nowrap ";
                                      if (isHierarchyViolation) cellClass += "text-cyan-400 font-bold bg-cyan-400/10 rounded-md";
                                      else if (isDuplicate) cellClass += "text-yellow-400 font-bold bg-yellow-400/10 rounded-md";

                                      return (
                                        <td key={`s12-${i}`} className={cellClass}>
                                          {subject}
                                        </td>
                                      );
                                    })}
                                    {Array.from({ length: maxSem2 }).map((_, i) => {
                                      const subject = row.semester2[i] || "";
                                      const normS = (s: string) => s ? s.replace(/\s+/g, '').replace(/Ⅰ/g, 'I').replace(/Ⅱ/g, 'II').replace(/Ⅲ/g, 'III') : '';
                                      const isDuplicate = subject && row.duplicateSubjects?.some(d => normS(d) === normS(subject));
                                      const isHierarchyViolation = subject && row.hierarchyViolations?.some(v => normS(v.subject) === normS(subject) || normS(v.prereq) === normS(subject));
                                      let cellClass = "px-2 py-2.5 whitespace-nowrap ";
                                      if (isHierarchyViolation) cellClass += "text-cyan-400 font-bold bg-cyan-400/10 rounded-md";
                                      else if (isDuplicate) cellClass += "text-yellow-400 font-bold bg-yellow-400/10 rounded-md";

                                      return (
                                        <td key={`s2-${i}`} className={cellClass}>
                                          {subject}
                                        </td>
                                      );
                                    })}
                                    <td className="px-2 py-2.5 text-center text-indigo-400 font-medium whitespace-nowrap">{row.basicCount}</td>
                                    <td className="px-2 py-2.5 text-center text-rose-400 font-medium whitespace-nowrap">{row.socialCount}</td>
                                    <td className="px-2 py-2.5 text-center text-emerald-400 font-medium whitespace-nowrap">{row.scienceCount}</td>
                                    <td className="px-2 py-2.5 font-medium flex flex-col gap-1 whitespace-nowrap">
                                      {row.basicCount >= 10 && <span className="text-rose-400 whitespace-nowrap">기초과목 최대학점 초과</span>}
                                      {row.duplicateSubjects?.length > 0 && <span className="text-yellow-400 whitespace-nowrap">중복선택: {row.duplicateSubjects.join(", ")}</span>}
                                      {row.hierarchyViolations?.map((v, i) => (
                                        <span key={i} className="text-cyan-400 text-xs whitespace-nowrap">
                                          {v.message}
                                        </span>
                                      ))}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "classOpening" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                        <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                          <CheckCircle2 className="w-6 h-6 text-indigo-400" />
                          5단계: 과목 개설 여부 및 학급 분반 추천
                        </h2>
                        <button
                          onClick={handleExportStep5}
                          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-emerald-500/25 flex items-center gap-2"
                          disabled={subjectStats[activeGrade].length === 0}
                        >
                          <Download className="w-4 h-4" />
                          {activeGrade === "pre1" ? "1학년" : activeGrade === "grade1" ? "2학년" : "3학년"} 개설 여부 엑셀 다운로드
                        </button>
                      </div>

                      {renderGradeTabs()}

                      {/* 학급 기준 인원 설정 */}
                      <div className="p-5 bg-slate-950/40 border border-slate-800/80 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-slate-200">학급 분반 및 개설 기준 설정</h3>
                          <p className="text-xs text-slate-300 mt-1">
                            설정된 학급 기준 인원에 따라 개설(70% 이상), 논의(70% 미만), 분반 추천(120% 초과) 및 폐강(10명 미만) 여부를 자동으로 판단합니다.
                          </p>
                        </div>
                        <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
                          {(() => {
                            const stats = subjectStats[activeGrade] || [];
                            const standardSize = standardClassSize[activeGrade] || 25;
                            const groupTotals: Record<string, number> = {};
                            stats.forEach(stat => {
                              const baseRemark = getClassRecommendation(stat.applicants, standardSize);
                              const key = `${activeGrade}_${stat.semester}_${stat.subject}`;
                              const displayRemark = manualStep5Classes[key] !== undefined ? manualStep5Classes[key] : baseRemark;
                              if (displayRemark !== "폐강" && !isNaN(Number(displayRemark))) {
                                const groupKey = `${stat.group}군(${stat.semester})`;
                                groupTotals[groupKey] = (groupTotals[groupKey] || 0) + Number(displayRemark);
                              }
                            });
                            
                            const groups = Object.keys(groupTotals).sort();
                            if (groups.length === 0) return null;
                            
                            return (
                              <div className="flex flex-wrap items-center gap-2 mr-2">
                                {groups.map(grp => (
                                  <div key={grp} className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-700/50 px-2.5 py-1 rounded-lg shadow-inner">
                                    <span className="text-[11px] font-semibold text-slate-300 tracking-wider">{grp}:</span>
                                    <span className="text-[13px] font-bold text-indigo-400">{groupTotals[grp]}반</span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                          <button
                            onClick={() => {
                              if (confirm("수동으로 조정한 개설 반 수를 모두 초기화하시겠습니까?")) {
                                setManualStep5Classes(prev => {
                                  const next = { ...prev };
                                  Object.keys(next).forEach(k => {
                                    if (k.startsWith(`${activeGrade}_`)) {
                                      delete next[k];
                                    }
                                  });
                                  return next;
                                });
                              }
                            }}
                            className="px-3 py-1.5 ml-2 mr-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 shrink-0 shadow-sm hover:shadow-md"
                            title="수동으로 조정한 개설 반 수를 모두 초기화합니다"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-slate-300" />
                            초기화
                          </button>
                          <div className="flex items-center gap-3 bg-slate-900/50 px-3 py-1.5 rounded-xl border border-slate-800">
                            <label htmlFor="standardSizeInput" className="text-sm text-slate-300 font-medium whitespace-nowrap">학급 기준 인원:</label>
                            <input
                              id="standardSizeInput"
                              type="number"
                              min={10}
                              max={50}
                              value={standardClassSize[activeGrade]}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 25;
                                setStandardClassSize(prev => ({ ...prev, [activeGrade]: val }));
                              }}
                              className="w-16 bg-slate-950 border border-slate-700 text-center rounded-lg px-2 py-1 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-slate-300 whitespace-nowrap">명</span>
                          </div>
                        </div>
                      </div>

                      {subjectStats[activeGrade].length === 0 ? (
                        <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-8 text-center">
                          <p className="text-slate-300">선택하신 학년의 데이터가 아직 없습니다. 교육과정 설정과 파일 업로드를 진행해 주세요.</p>
                        </div>
                      ) : (() => {
                        const stats = subjectStats[activeGrade] || [];
                        const standardSize = standardClassSize[activeGrade] || 25;

                        // Precompute group and semester rowSpans
                        const groupSpans: number[] = [];
                        const semSpans: number[] = [];

                        for (let idx = 0; idx < stats.length; idx++) {
                          if (idx === 0 || stats[idx].group !== stats[idx - 1].group) {
                            let count = 1;
                            while (idx + count < stats.length && stats[idx + count].group === stats[idx].group) {
                              count++;
                            }
                            groupSpans.push(count);
                          } else {
                            groupSpans.push(0);
                          }

                          if (idx === 0 || stats[idx].group !== stats[idx - 1].group || stats[idx].semester !== stats[idx - 1].semester) {
                            let count = 1;
                            while (idx + count < stats.length && stats[idx + count].group === stats[idx].group && stats[idx + count].semester === stats[idx].semester) {
                              count++;
                            }
                            semSpans.push(count);
                          } else {
                            semSpans.push(0);
                          }
                        }

                        return (
                          <div className="bg-slate-950/50 border border-slate-800 rounded-2xl overflow-hidden">
                            <div className="overflow-auto max-h-[650px]">
                              <table className="w-full text-sm text-left text-slate-300 border-collapse">
                                <thead className="text-xs text-slate-300 uppercase bg-slate-900 border-b border-slate-800">
                                    <tr>
                                      <th className="px-4 py-3 text-center border-r border-slate-800/60 min-w-[100px]">선택군</th>
                                      <th className="px-4 py-3 text-center border-r border-slate-800/60 min-w-[120px]">학기</th>
                                      <th className="px-6 py-3 border-r border-slate-800/60">과목</th>
                                      <th className="px-4 py-3 text-center border-r border-slate-800/60 min-w-[120px]">신청자 수</th>
                                      <th className="px-4 py-3 text-center border-r border-slate-800/60 min-w-[120px]">개설 반 수</th>
                                      <th className="px-4 py-3 text-center min-w-[120px]">개설여부</th>
                                    </tr>
                                </thead>
                                <tbody>
                                  {stats.map((row, idx) => {
                                    const baseRemark = getClassRecommendation(row.applicants, standardSize);
                                    const key = `${activeGrade}_${row.semester}_${row.subject}`;
                                    const displayRemark = manualStep5Classes[key] !== undefined ? manualStep5Classes[key] : baseRemark;

                                    let openingStatus = "미정";
                                    let openingStyle = "text-amber-400 font-bold bg-amber-500/10 px-2.5 py-1 rounded-md inline-block";

                                    if (displayRemark === "폐강") {
                                      openingStatus = "폐강";
                                      openingStyle = "text-rose-400 font-bold bg-rose-600/10 px-2.5 py-1 rounded-md inline-block";
                                    } else if (!isNaN(Number(displayRemark))) {
                                      openingStatus = "확정";
                                      openingStyle = "text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-md inline-block";
                                    }

                                    const isEditable = displayRemark === "논의" || displayRemark.includes("~") || manualStep5Classes[key] !== undefined;

                                    return (
                                      <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-900/20 transition-colors">
                                        {groupSpans[idx] > 0 && (
                                          <td
                                            rowSpan={groupSpans[idx]}
                                            className="px-4 py-3.5 text-center font-bold text-slate-200 border-r border-slate-800/50 bg-slate-950/60 align-middle"
                                          >
                                            {row.group}
                                          </td>
                                        )}
                                        {semSpans[idx] > 0 && (
                                          <td
                                            rowSpan={semSpans[idx]}
                                            className="px-4 py-3.5 text-center font-semibold text-slate-300 border-r border-slate-800/50 bg-slate-950/40 align-middle"
                                          >
                                            {row.semester}
                                          </td>
                                        )}
                                        <td className="px-6 py-3.5 border-r border-slate-800/50 font-medium text-white">
                                          {row.subject}
                                        </td>
                                        <td className="px-4 py-3.5 text-center border-r border-slate-800/50 font-semibold text-indigo-400">
                                          {row.applicants}명
                                        </td>
                                        <td className="px-4 py-3.5 text-center align-middle border-r border-slate-800/50">
                                          {editingStep5Classes[key] ? (
                                            <input
                                              type="text"
                                              autoFocus
                                              className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-center text-slate-200"
                                              value={manualStep5Classes[key] !== undefined ? manualStep5Classes[key] : baseRemark}
                                              onChange={(e) => setManualStep5Classes(p => ({ ...p, [key]: e.target.value }))}
                                              onKeyDown={e => { if (e.key === 'Enter') setEditingStep5Classes(p => ({ ...p, [key]: false })) }}
                                              onBlur={() => setEditingStep5Classes(p => ({ ...p, [key]: false }))}
                                            />
                                          ) : (
                                            <span 
                                              className={isEditable ? "cursor-pointer hover:text-indigo-400 font-medium" : "text-slate-300 font-medium"} 
                                              onClick={() => { if (isEditable || true) setEditingStep5Classes(p => ({ ...p, [key]: true })) }}
                                              title={isEditable || true ? "클릭하여 수동 입력" : undefined}
                                            >
                                              {displayRemark}
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3.5 text-center align-middle">
                                          <span className={openingStyle}>{openingStatus}</span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {activeTab === "categorySummary" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                            <FileText className="w-6 h-6 text-indigo-400" />
                            교과(군)별 시수 정리
                          </h2>
                          <button
                            onClick={handleExportCategorySummary}
                            disabled={categorySummaryData.length === 0}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-emerald-500/25 flex items-center gap-2"
                          >
                            <Download className="w-4 h-4" />
                            엑셀 다운로드
                          </button>
                        </div>
                        <div className="flex gap-4 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-300">1학년 전체 반:</span>
                            <input type="number" className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-center text-sm text-slate-200" value={totalClasses.pre1 || ""} onChange={e => {
                              setTotalClasses(p => ({ ...p, pre1: Number(e.target.value) || 0 }));
                              setManualClassCounts(p => { const next = { ...p }; Object.keys(next).forEach(k => { if (k.startsWith("1_") && !k.endsWith("_split")) delete next[k]; }); return next; });
                            }} />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-300">2학년 전체 반:</span>
                            <input type="number" className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-center text-sm text-slate-200" value={totalClasses.grade1 || ""} onChange={e => {
                              setTotalClasses(p => ({ ...p, grade1: Number(e.target.value) || 0 }));
                              setManualClassCounts(p => { const next = { ...p }; Object.keys(next).forEach(k => { if (k.startsWith("2_") && !k.endsWith("_split")) delete next[k]; }); return next; });
                            }} />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-300">3학년 전체 반:</span>
                            <input type="number" className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-center text-sm text-slate-200" value={totalClasses.grade2 || ""} onChange={e => {
                              setTotalClasses(p => ({ ...p, grade2: Number(e.target.value) || 0 }));
                              setManualClassCounts(p => { const next = { ...p }; Object.keys(next).forEach(k => { if (k.startsWith("3_") && !k.endsWith("_split")) delete next[k]; }); return next; });
                            }} />
                          </div>
                        </div>
                        <div className="flex gap-2 bg-rose-900/20 p-3 rounded-xl border border-rose-800/40 items-center mt-4 md:mt-0">
                          <span className="text-sm text-rose-300 font-medium">수석교사 감축 시수:</span>
                          <select
                            className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 w-28"
                            value={headTeacherCategoryInput}
                            onChange={e => setHeadTeacherCategoryInput(e.target.value)}
                          >
                            <option value="">교과 선택</option>
                            {Array.from(new Set(categorySummaryData.filter(r => r.isFirstRow).map(r => r.category))).map(cat => (
                              <option key={cat} value={cat}>
                                {cat} {headTeacherReductions[cat] ? `(-${headTeacherReductions[cat]})` : ""}
                              </option>
                            ))}
                          </select>
                          {headTeacherCategoryInput && (
                            <input
                              type="number"
                              placeholder="시수"
                              className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-center text-sm text-slate-200"
                              value={headTeacherReductions[headTeacherCategoryInput] || ""}
                              onChange={e => {
                                const val = Number(e.target.value);
                                setHeadTeacherReductions(p => {
                                  const next = { ...p };
                                  if (!val || val === 0) delete next[headTeacherCategoryInput];
                                  else next[headTeacherCategoryInput] = val;
                                  return next;
                                });
                              }}
                            />
                          )}
                        </div>
                      </div>
                      <div className="bg-slate-800/40 rounded-2xl border border-slate-700/50 overflow-hidden shadow-inner overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-300">
                          <thead className="text-xs text-slate-300 bg-slate-900/80 sticky top-0 uppercase z-10 border-b border-slate-700/50">
                            <tr>
                              <th rowSpan={2} className="px-4 py-3 text-center border-r border-slate-700/50">교과</th>
                              <th rowSpan={2} className="px-4 py-3 text-center border-r border-slate-700/50">교사 수</th>
                              <th colSpan={7} className="px-4 py-3 text-center border-r border-slate-700/50 border-b border-slate-700/50">1학기</th>
                              <th colSpan={7} className="px-4 py-3 text-center border-r border-slate-700/50 border-b border-slate-700/50">2학기</th>
                              <th rowSpan={2} className="px-4 py-3 text-center border-r border-slate-700/50">교과별<br/>1년 시수</th>
                              <th rowSpan={2} className="px-4 py-3 text-center">교과별<br/>1년 평균<br/>(학기당 평균)</th>
                            </tr>
                            <tr>
                              <th className="px-4 py-2 text-center border-r border-slate-700/50">학년</th>
                              <th className="px-4 py-2 text-center border-r border-slate-700/50">과목명</th>
                              <th className="px-4 py-2 text-center border-r border-slate-700/50">운영학점</th>
                              <th className="px-4 py-2 text-center border-r border-slate-700/50">개설반</th>
                              <th className="px-4 py-2 text-center border-r border-slate-700/50">과목별 시수</th>
                              <th className="px-4 py-2 text-center border-r border-slate-700/50">교과별 총 시수</th>
                              <th className="px-4 py-2 text-center border-r border-slate-700/50">교과별 평균시수</th>
                              
                              <th className="px-4 py-2 text-center border-r border-slate-700/50">학년</th>
                              <th className="px-4 py-2 text-center border-r border-slate-700/50">과목명</th>
                              <th className="px-4 py-2 text-center border-r border-slate-700/50">운영학점</th>
                              <th className="px-4 py-2 text-center border-r border-slate-700/50">개설반</th>
                              <th className="px-4 py-2 text-center border-r border-slate-700/50">과목별 시수</th>
                              <th className="px-4 py-2 text-center border-r border-slate-700/50">교과별 총 시수</th>
                              <th className="px-4 py-2 text-center border-r border-slate-700/50">교과별 평균시수</th>
                            </tr>
                          </thead>
                          <tbody className="">
                            {categorySummaryData.length > 0 ? (
                              categorySummaryData.map((row, idx) => {
                                const bg1 = row.sem1 ? (row.sem1.isElective ? "bg-indigo-500/10" : "bg-emerald-500/10") : "";
                                const bg2 = row.sem2 ? (row.sem2.isElective ? "bg-indigo-500/10" : "bg-emerald-500/10") : "";
                                return (
                                <tr key={`${row.category}-${idx}`} className={`hover:bg-slate-800/30 transition-colors border-b border-slate-700/50 ${row.isFirstRow ? 'border-t-2 border-t-slate-600/80' : ''}`}>
                                  {row.isFirstRow && (
                                    <td rowSpan={row.rowSpan} className="px-4 py-3 text-center border-r border-slate-700/50 font-medium align-middle">
                                      {row.category}
                                    </td>
                                  )}
                                  {row.isFirstRow && (
                                    <td rowSpan={row.rowSpan} className="px-4 py-3 text-center border-r border-slate-700/50 text-slate-300 align-middle">
                                      {editingTeachers[row.category] ? (
                                        <input
                                          type="number"
                                          autoFocus
                                          className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-center text-slate-200"
                                          value={teacherCounts[row.category] || ""}
                                          onChange={(e) => setTeacherCounts(p => ({ ...p, [row.category]: Number(e.target.value) || 0 }))}
                                          onKeyDown={e => { if (e.key === 'Enter') setEditingTeachers(p => ({ ...p, [row.category]: false })) }}
                                          onBlur={() => setEditingTeachers(p => ({ ...p, [row.category]: false }))}
                                          placeholder="0"
                                        />
                                      ) : (
                                        <span className="cursor-pointer hover:text-indigo-400 font-medium" onClick={() => setEditingTeachers(p => ({ ...p, [row.category]: true }))} title="클릭하여 수동 입력">
                                          {teacherCounts[row.category] || 0}
                                        </span>
                                      )}
                                    </td>
                                  )}
                                  
                                  {/* 1학기 */}
                                  <td className={`px-4 py-3 text-center border-r border-slate-700/50 text-slate-300 ${bg1}`}>{row.sem1?.gradeLabel || ""}</td>
                                  <td className={`px-4 py-3 text-center border-r border-slate-700/50 text-slate-200 ${bg1}`}>{row.sem1?.subject || ""}</td>
                                  <td className={`px-4 py-3 text-center border-r border-slate-700/50 text-slate-300 ${bg1}`}>{row.sem1?.credits || ""}</td>
                                  <td className={`px-4 py-3 text-center border-r border-slate-700/50 text-slate-300 ${bg1}`}>
                                    {row.sem1 ? (() => {
                                      const gk = row.sem1.gradeLabel === "1" ? "pre1" : row.sem1.gradeLabel === "2" ? "grade1" : "grade2";
                                      const key = `${row.sem1.gradeLabel}_${row.sem1.subject}_1${row.sem1.isSplit ? '_split' : ''}`;
                                      const displayVal = manualClassCounts[key] !== undefined ? manualClassCounts[key] : row.sem1.classCount;
                                      
                                      if (editingClasses[key]) {
                                        return (
                                          <input
                                            type="number"
                                            autoFocus
                                            className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-center text-slate-200"
                                            value={manualClassCounts[key] !== undefined ? manualClassCounts[key] : ""}
                                            onChange={(e) => setManualClassCounts(p => ({ ...p, [key]: Number(e.target.value) || 0 }))}
                                            onKeyDown={e => { if (e.key === 'Enter') setEditingClasses(p => ({ ...p, [key]: false })) }}
                                            onBlur={() => setEditingClasses(p => ({ ...p, [key]: false }))}
                                            placeholder={displayVal.toString()}
                                          />
                                        );
                                      } else {
                                        return (
                                          <span className="cursor-pointer hover:text-indigo-400 font-medium" onClick={() => setEditingClasses(p => ({ ...p, [key]: true }))} title="클릭하여 수동 입력">
                                            {displayVal || 0}
                                          </span>
                                        );
                                      }
                                    })() : ""}
                                  </td>
                                  <td className={`px-4 py-3 text-center border-r border-slate-700/50 text-slate-300 ${bg1}`}>{row.sem1?.subjectHours !== undefined ? row.sem1.subjectHours : ""}</td>
                                  {row.isFirstRow && (
                                    <td rowSpan={row.rowSpan} className="px-4 py-3 text-center border-r border-slate-700/50 text-slate-300 font-semibold align-middle">
                                      {row.reduction > 0 ? (
                                        <div className="flex flex-col items-center">
                                          <span>{row.sem1Total}</span>
                                          <span className="text-[10px] text-rose-400 font-normal opacity-80 mt-1">({row.sem1TotalOriginal}-{row.reduction})</span>
                                        </div>
                                      ) : (
                                        row.sem1Total || 0
                                      )}
                                    </td>
                                  )}
                                  {row.isFirstRow && (
                                    <td rowSpan={row.rowSpan} className="px-4 py-3 text-center border-r border-slate-700/50 text-indigo-300 font-semibold align-middle">
                                      {row.sem1Avg}
                                    </td>
                                  )}
                                  
                                  {/* 2학기 */}
                                  <td className={`px-4 py-3 text-center border-r border-slate-700/50 text-slate-300 ${bg2}`}>{row.sem2?.gradeLabel || ""}</td>
                                  <td className={`px-4 py-3 text-center border-r border-slate-700/50 text-slate-200 ${bg2}`}>{row.sem2?.subject || ""}</td>
                                  <td className={`px-4 py-3 text-center border-r border-slate-700/50 text-slate-300 ${bg2}`}>{row.sem2?.credits || ""}</td>
                                  <td className={`px-4 py-3 text-center border-r border-slate-700/50 text-slate-300 ${bg2}`}>
                                    {row.sem2 ? (() => {
                                      const gk = row.sem2.gradeLabel === "1" ? "pre1" : row.sem2.gradeLabel === "2" ? "grade1" : "grade2";
                                      const key = `${row.sem2.gradeLabel}_${row.sem2.subject}_2${row.sem2.isSplit ? '_split' : ''}`;
                                      const displayVal = manualClassCounts[key] !== undefined ? manualClassCounts[key] : row.sem2.classCount;
                                      
                                      if (editingClasses[key]) {
                                        return (
                                          <input
                                            type="number"
                                            autoFocus
                                            className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-center text-slate-200"
                                            value={manualClassCounts[key] !== undefined ? manualClassCounts[key] : ""}
                                            onChange={(e) => setManualClassCounts(p => ({ ...p, [key]: Number(e.target.value) || 0 }))}
                                            onKeyDown={e => { if (e.key === 'Enter') setEditingClasses(p => ({ ...p, [key]: false })) }}
                                            onBlur={() => setEditingClasses(p => ({ ...p, [key]: false }))}
                                            placeholder={displayVal.toString()}
                                          />
                                        );
                                      } else {
                                        return (
                                          <span className="cursor-pointer hover:text-indigo-400 font-medium" onClick={() => setEditingClasses(p => ({ ...p, [key]: true }))} title="클릭하여 수동 입력">
                                            {displayVal || 0}
                                          </span>
                                        );
                                      }
                                    })() : ""}
                                  </td>
                                  <td className={`px-4 py-3 text-center border-r border-slate-700/50 text-slate-300 ${bg2}`}>{row.sem2?.subjectHours !== undefined ? row.sem2.subjectHours : ""}</td>
                                  {row.isFirstRow && (
                                    <td rowSpan={row.rowSpan} className="px-4 py-3 text-center border-r border-slate-700/50 text-slate-300 font-semibold align-middle">
                                      {row.reduction > 0 ? (
                                        <div className="flex flex-col items-center">
                                          <span>{row.sem2Total}</span>
                                          <span className="text-[10px] text-rose-400 font-normal opacity-80 mt-1">({row.sem2TotalOriginal}-{row.reduction})</span>
                                        </div>
                                      ) : (
                                        row.sem2Total || 0
                                      )}
                                    </td>
                                  )}
                                  {row.isFirstRow && (
                                    <td rowSpan={row.rowSpan} className="px-4 py-3 text-center border-r border-slate-700/50 text-indigo-300 font-semibold align-middle">
                                      {row.sem2Avg}
                                    </td>
                                  )}
                                  
                                  {/* 1년 시수 및 1년 평균 */}
                                  {row.isFirstRow && (
                                    <td rowSpan={row.rowSpan} className="px-4 py-3 text-center border-r border-slate-700/50 text-emerald-300 font-bold align-middle">
                                      {row.yearTotal || 0}
                                    </td>
                                  )}
                                  {row.isFirstRow && (
                                    <td rowSpan={row.rowSpan} className="px-4 py-3 text-center text-emerald-400 font-bold align-middle">
                                      {row.yearAvg}
                                    </td>
                                  )}
                                </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={18} className="px-4 py-8 text-center text-slate-300">
                                  데이터가 없습니다. 1단계 교육과정 편성표를 업로드해주세요.
                                </td>
                              </tr>
                            )}
                            {categorySummaryData.length > 0 && (() => {
                              const totalSem1Hours = categorySummaryData.reduce((acc, row) => acc + (row.sem1?.subjectHours || 0), 0);
                              const totalSem2Hours = categorySummaryData.reduce((acc, row) => acc + (row.sem2?.subjectHours || 0), 0);
                              const totalYearHours = categorySummaryData.filter(r => r.isFirstRow).reduce((acc, row) => acc + row.yearTotal, 0);
                              return (
                                <tr className="bg-indigo-900/40 font-bold border-t-2 border-slate-600/80 hover:bg-indigo-900/60 transition-colors">
                                  <td colSpan={6} className="px-4 py-4 text-center border-r border-slate-700/50 text-indigo-300">총계</td>
                                  <td className="px-4 py-4 text-center border-r border-slate-700/50 text-indigo-300">{totalSem1Hours}</td>
                                  <td className="px-4 py-4 text-center border-r border-slate-700/50 text-indigo-300">{totalSem1Hours}</td>
                                  <td colSpan={5} className="px-4 py-4 border-r border-slate-700/50"></td>
                                  <td className="px-4 py-4 text-center border-r border-slate-700/50 text-indigo-300">{totalSem2Hours}</td>
                                  <td className="px-4 py-4 text-center border-r border-slate-700/50 text-indigo-300">{totalSem2Hours}</td>
                                  <td className="px-4 py-4 border-r border-slate-700/50"></td>
                                  <td className="px-4 py-4 text-center border-r border-slate-700/50 text-emerald-400 font-extrabold">{totalYearHours}</td>
                                  <td className="px-4 py-4 text-center text-emerald-400 font-extrabold"></td>
                                </tr>
                              );
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

          </div>
        </div>
      </> );
}
