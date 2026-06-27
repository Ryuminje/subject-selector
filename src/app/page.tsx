"use client";

import React, { useState, useEffect, useRef, Fragment, useMemo } from "react";
import { Upload, FileText, Settings, Download, CheckCircle2, ChevronRight, Trash2, File as FileIcon, Save, FolderOpen, GitBranch, Plus, Users } from "lucide-react";
import * as XLSX from "xlsx-js-style";

type SubjectCategory = "기초" | "사회" | "과학" | "기타";
type GradeKey = "grade1" | "grade2";

interface SubjectMap {
  [subjectName: string]: SubjectCategory;
}

interface HierarchyRule {
  id: string;
  prereq: string;
  advanced: string;
}

interface ProcessedStudent {
  originalIndex: number;
  studentId: string;
  name: string;
  grade: string;
  classNum: string;
  num: string;
  semester1: string[];
  semester2: string[];
  basicCount: number;
  socialCount: number;
  scienceCount: number;
  duplicateSubjects: string[];
  hierarchyViolations: { subject: string; prereq: string; message: string }[];
  originalRow: any;
  completedBefore?: string[];
}

export interface StudentTimeData {
  id: string;
  name: string;
  timeSlotMap: Record<string, string>;
}

interface SubjectStat {
  group: string;
  semester: string;
  subject: string;
  applicants: number;
}

interface DesignatedSubject {
  subject: string;
  category: SubjectCategory;
  detailedCategory: string;
  sem1: number;
  sem2: number;
}

interface SelectedSubjectHours {
  subject: string;
  category: SubjectCategory;
  detailedCategory: string;
  sem1: number;
  sem2: number;
}
export interface ParsedCurriculumSubject {
  type: "지정" | "선택";
  subject: string;
  category: string;
  credits: number;
  sem1: number;
  sem2: number;
  semesters: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("curriculum");
  const [activeSidebarTab, setActiveSidebarTab] = useState<"survey" | "change">("survey");
  const [activeGrade, setActiveGrade] = useState<GradeKey>("grade1");

  const [changeActiveTab, setChangeActiveTab] = useState<"upload" | "timetable" | "roster" | "application" | "roster_after">("upload");
  const [changeActiveGrade, setChangeActiveGrade] = useState<"grade2" | "grade3">("grade2");
  const [changeRosterTimeSlot, setChangeRosterTimeSlot] = useState("A");

  const initialTimeSlots = ["A", "B", "C", "D", "E", "F", "G"];
  const initialColsG2 = Array.from({length: 9}, (_, i) => `2-${i + 1}`);
  const initialColsG3 = Array.from({length: 9}, (_, i) => `3-${i + 1}`);

  const [timeSlots, setTimeSlots] = useState<{grade2: string[], grade3: string[]}>({
    grade2: [...initialTimeSlots], grade3: [...initialTimeSlots]
  });
  const [classCols, setClassCols] = useState<{grade2: string[], grade3: string[]}>({
    grade2: [...initialColsG2], grade3: [...initialColsG3]
  });
  const [timetableData, setTimetableData] = useState<{
    grade2: Record<string, Record<string, { subject: string, teacher: string }>>,
    grade3: Record<string, Record<string, { subject: string, teacher: string }>>
  }>({ grade2: {}, grade3: {} });
  
  const [parsedSampleData, setParsedSampleData] = useState<{
    grade2: StudentTimeData[],
    grade3: StudentTimeData[]
  }>({ grade2: [], grade3: [] });

  const [electiveChanges, setElectiveChanges] = useState<Record<string, any[]>>({ grade2: [], grade3: [] });
  const handleTimetablePaste = (e: React.ClipboardEvent, startRowIndex: number, startColIndex: number, field: "subject" | "teacher") => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("Text");
    if (!pastedText) return;

    const rows = pastedText.split(/\r\n|\n|\r/).filter(row => row.trim() !== "");
    const newData = { ...timetableData[changeActiveGrade] };

    const currentCols = classCols[changeActiveGrade];
    const currentRows = timeSlots[changeActiveGrade];

    rows.forEach((row, rIdx) => {
      const cells = row.split('\t');
      const targetRow = currentRows[startRowIndex + rIdx];
      if (targetRow) {
        if (!newData[targetRow]) newData[targetRow] = {};
        cells.forEach((cell, cIdx) => {
          const targetCol = currentCols[startColIndex + cIdx];
          if (targetCol) {
            const existingCell = newData[targetRow][targetCol] || { subject: "", teacher: "" };
            newData[targetRow][targetCol] = { ...existingCell, [field]: cell.trim() };
          }
        });
      }
    });

    setTimetableData(prev => ({
      ...prev,
      [changeActiveGrade]: newData
    }));
  };

  const addTimeSlot = () => {
    setTimeSlots(prev => {
      const current = prev[changeActiveGrade];
      const nextChar = String.fromCharCode(65 + current.length); // A, B, C...
      return { ...prev, [changeActiveGrade]: [...current, nextChar] };
    });
  };

  const addClassCol = () => {
    setClassCols(prev => {
      const current = prev[changeActiveGrade];
      const prefix = changeActiveGrade === "grade2" ? "2-" : "3-";
      return { ...prev, [changeActiveGrade]: [...current, `${prefix}${current.length + 1}`] };
    });
  };

  const removeTimeSlot = (idx: number) => {
    setTimeSlots(prev => {
      const current = [...prev[changeActiveGrade]];
      current.splice(idx, 1);
      return { ...prev, [changeActiveGrade]: current };
    });
  };

  const removeClassCol = (idx: number) => {
    setClassCols(prev => {
      const current = [...prev[changeActiveGrade]];
      current.splice(idx, 1);
      return { ...prev, [changeActiveGrade]: current };
    });
  };

  const updateTimetableCell = (row: string, col: string, field: "subject" | "teacher", value: string) => {
    setTimetableData(prev => ({
      ...prev,
      [changeActiveGrade]: {
        ...prev[changeActiveGrade],
        [row]: {
          ...(prev[changeActiveGrade][row] || {}),
          [col]: {
            ...(prev[changeActiveGrade][row]?.[col] || { subject: "", teacher: "" }),
            [field]: value
          }
        }
      }
    }));
  };

  const [parsedCurriculumList, setParsedCurriculumList] = useState<{ [key in GradeKey]: ParsedCurriculumSubject[] }>({ grade1: [], grade2: [] });
  const [subjectMap, setSubjectMap] = useState<{ [key in GradeKey]: SubjectMap }>({ grade1: {}, grade2: {} });
  const [isCurriculumParsed, setIsCurriculumParsed] = useState<{ [key in GradeKey]: boolean }>({ grade1: false, grade2: false });
  const [hierarchyRules, setHierarchyRules] = useState<{ [key in GradeKey]: HierarchyRule[] }>({ grade1: [], grade2: [] });

  const handleChangeSampleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      
      const json = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
      if (json.length < 2) return;

      const subjectHeaders = json[1];
      const students: StudentTimeData[] = [];

      for (let r = 2; r < json.length; r++) {
        const row = json[r];
        if (!row || row.length === 0 || !row[1]) continue;

        const id = String(row[1]);
        const name = String(row[2] || "");
        
        const timeSlotMap: Record<string, string> = {};
        for (let c = 8; c < row.length; c++) {
          const timeVal = row[c];
          if (timeVal !== undefined && timeVal !== null && subjectHeaders[c]) {
            const timeKey = String(timeVal).trim();
            if (timeKey) {
              timeSlotMap[timeKey] = String(subjectHeaders[c]).trim();
            }
          }
        }

        students.push({ id, name, timeSlotMap });
      }

      setParsedSampleData(prev => ({
        ...prev,
        [changeActiveGrade]: students
      }));

      alert(`${changeActiveGrade === "grade2" ? "2학년" : "3학년"} 학생 데이터 ${students.length}명 파싱 완료!`);
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };
  
  const [uploadedFiles, setUploadedFiles] = useState<{ [key in GradeKey]: { name: string, size: number, data: string } | null }>({ grade1: null, grade2: null });
  const [processedData, setProcessedData] = useState<{ [key in GradeKey]: ProcessedStudent[] }>({ grade1: [], grade2: [] });
  const [rawSheetData, setRawSheetData] = useState<{ [key in GradeKey]: any[] }>({ grade1: [], grade2: [] });
  const [previousHistoryFiles, setPreviousHistoryFiles] = useState<{ [key in GradeKey]: { name: string, size: number, data: string } | null }>({ grade1: null, grade2: null });
  const [previousSubjectMap, setPreviousSubjectMap] = useState<{ [key in GradeKey]: { [studentId: string]: { name: string, subjects: string[] } } }>({ grade1: {}, grade2: {} });

  const [subjectStats, setSubjectStats] = useState<{ [key in GradeKey]: SubjectStat[] }>({ grade1: [], grade2: [] });
  const [standardClassSize, setStandardClassSize] = useState<{ [key in GradeKey]: number }>({ grade1: 25, grade2: 25 });
  const [designatedSubjects, setDesignatedSubjects] = useState<{ [key in GradeKey]: DesignatedSubject[] }>({ grade1: [], grade2: [] });
  const [selectedSubjectHours, setSelectedSubjectHours] = useState<{ [key in GradeKey]: SelectedSubjectHours[] }>({ grade1: [], grade2: [] });


  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveBackup = () => {
    const backupData = { 
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
      designatedSubjects,
      selectedSubjectHours,
      parsedSampleData,
      timetableData,
      electiveChanges,
      timeSlots,
      classCols
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "수강신청_설정_백업.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoadBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = evt.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.parsedCurriculumList) setParsedCurriculumList(parsed.parsedCurriculumList);
        if (parsed.subjectMap) setSubjectMap(parsed.subjectMap);
        if (parsed.isCurriculumParsed) setIsCurriculumParsed(parsed.isCurriculumParsed);
        if (parsed.hierarchyRules) setHierarchyRules(parsed.hierarchyRules);
        if (parsed.uploadedFiles) setUploadedFiles(parsed.uploadedFiles);
        if (parsed.processedData) setProcessedData(parsed.processedData);
        if (parsed.rawSheetData) setRawSheetData(parsed.rawSheetData);
        if (parsed.previousHistoryFiles) setPreviousHistoryFiles(parsed.previousHistoryFiles);
        if (parsed.previousSubjectMap) setPreviousSubjectMap(parsed.previousSubjectMap);
        if (parsed.subjectStats) setSubjectStats(parsed.subjectStats);
        if (parsed.standardClassSize) setStandardClassSize(parsed.standardClassSize);
        if (parsed.designatedSubjects) setDesignatedSubjects(parsed.designatedSubjects);
        if (parsed.selectedSubjectHours) setSelectedSubjectHours(parsed.selectedSubjectHours);
        if (parsed.parsedSampleData) setParsedSampleData(parsed.parsedSampleData);
        if (parsed.timetableData) setTimetableData(parsed.timetableData);
        if (parsed.electiveChanges) setElectiveChanges(parsed.electiveChanges);
        if (parsed.timeSlots) setTimeSlots(parsed.timeSlots);
        if (parsed.classCols) setClassCols(parsed.classCols);
  
        alert("작업 내역을 성공적으로 불러왔습니다.");
      } catch (e) {
        alert("올바르지 않은 백업 파일입니다.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const renderGradeTabs = () => (
    <div className="flex gap-2 mb-6 border-b border-slate-800 pb-4">
      <button
        onClick={() => setActiveGrade("grade1")}
        className={`px-6 py-2.5 rounded-xl font-medium transition-all ${
          activeGrade === "grade1" ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-inner" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
        }`}
      >
        1학년
      </button>
      <button
        onClick={() => setActiveGrade("grade2")}
        className={`px-6 py-2.5 rounded-xl font-medium transition-all ${
          activeGrade === "grade2" ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-inner" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
        }`}
      >
        2학년
      </button>
    </div>
  );



  const handleCurriculumUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      if (!data) return;

      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      // Resolve merges
      if (sheet['!merges']) {
        sheet['!merges'].forEach((m: any) => {
          const val = json[m.s.r]?.[m.s.c];
          if (val !== undefined) {
            for (let r = m.s.r; r <= m.e.r; r++) {
              if (!json[r]) json[r] = [];
              for (let c = m.s.c; c <= m.e.c; c++) json[r][c] = val;
            }
          }
        });
      }

      // Find header row indices dynamically for all columns
      let typeIdx = -1, catIdx = -1, subjIdx = -1, credIdx = -1;
      let grade1Idx = -1, grade2Idx = -1, grade3Idx = -1;
      
      for (let r = 0; r < Math.min(6, json.length); r++) {
        if (json[r]) {
          for (let c = 0; c < json[r].length; c++) {
            const val = String(json[r][c] || "").replace(/\s+/g, "");
            if (val === "1학년" && grade1Idx === -1) grade1Idx = c;
            if (val === "2학년" && grade2Idx === -1) grade2Idx = c;
            if (val === "3학년" && grade3Idx === -1) grade3Idx = c;
            
            if (val.includes("구분") && typeIdx === -1) typeIdx = c;
            if ((val.includes("교과(군)") || val === "교과군") && catIdx === -1) catIdx = c;
            if ((val === "과목" || val.includes("과목명")) && subjIdx === -1) subjIdx = c;
            if (val.includes("운영학점") && credIdx === -1) credIdx = c;
          }
        }
      }

      // Fallback defaults if columns not found
      if (typeIdx === -1) typeIdx = 0;
      if (catIdx === -1) catIdx = 1;
      if (subjIdx === -1) subjIdx = 3;
      if (credIdx === -1) credIdx = 5;

      // Fallback defaults if grade headers not found
      if (grade1Idx === -1) grade1Idx = 6;
      if (grade2Idx === -1) grade2Idx = 8;
      if (grade3Idx === -1) grade3Idx = 10;

      const newParsed: ParsedCurriculumSubject[] = [];
      const newMap: SubjectMap = {};
      const newDesignated: DesignatedSubject[] = [];
      const newSelected: SelectedSubjectHours[] = [];

      for (let r = 0; r < json.length; r++) {
        const row = json[r];
        if (!row) continue;
        
        const typeStr = String(row[typeIdx] || "").replace(/\s+/g, "");
        let category = String(row[catIdx] || "").replace(/\s+/g, "");
        category = category.replace(/\(역사\/도덕포함\)/g, "").trim();
        const subjectNameRaw = String(row[subjIdx] || "").trim();

        if (subjectNameRaw && subjectNameRaw.length > 1 && subjectNameRaw !== "과목" && !subjectNameRaw.includes("소계") && !subjectNameRaw.includes("합계")) {
          if (["공통", "일반", "진로", "융합"].includes(subjectNameRaw)) continue;
          
          let type: "지정" | "선택" | null = null;
          if (typeStr.includes("지정")) type = "지정";
          else if (typeStr.includes("선택")) type = "선택";
          
          if (type) {
            let sem1_1 = Number(row[grade1Idx]) || 0;
            let sem1_2 = Number(row[grade1Idx + 1]) || 0;
            let sem2_1 = Number(row[grade2Idx]) || 0;
            let sem2_2 = Number(row[grade2Idx + 1]) || 0;
            let sem3_1 = Number(row[grade3Idx]) || 0;
            let sem3_2 = Number(row[grade3Idx + 1]) || 0;

            const sems: string[] = [];
            if (sem1_1) sems.push("1학년 1학기");
            if (sem1_2) sems.push("1학년 2학기");
            if (sem2_1) sems.push("2학년 1학기");
            if (sem2_2) sems.push("2학년 2학기");
            if (sem3_1) sems.push("3학년 1학기");
            if (sem3_2) sems.push("3학년 2학기");

            const individualSubjects = subjectNameRaw.split("↔").map(s => s.trim());
            
            individualSubjects.forEach(sub => {
              if (sub && sub.length > 1) {
                const actualCredits = sem1_1 || sem1_2 || sem2_1 || sem2_2 || sem3_1 || sem3_2 || 0;
                newParsed.push({
                  type,
                  subject: sub,
                  category,
                  credits: actualCredits,
                  sem1: activeGrade === "grade1" ? sem1_1 : activeGrade === "grade2" ? sem2_1 : 0,
                  sem2: activeGrade === "grade1" ? sem1_2 : activeGrade === "grade2" ? sem2_2 : 0,
                  semesters: sems.length > 0 ? sems.join(", ") : "미지정 (엑셀 빈칸)"
                });

                // Populate backward compatibility states for the chosen grade
                let sem1ForGrade = 0, sem2ForGrade = 0;
                if (activeGrade === "grade1") {
                  sem1ForGrade = sem1_1; sem2ForGrade = sem1_2;
                } else {
                  sem1ForGrade = sem2_1; sem2ForGrade = sem2_2;
                }

                // Determine broad category
                let broadCat: SubjectCategory = "기타";
                if (["국어", "수학", "영어"].includes(category)) broadCat = "기초";
                else if (["사회", "역사", "도덕", "사회(역사/도덕포함)"].includes(category)) broadCat = "사회";
                else if (["과학"].includes(category)) broadCat = "과학";

                if (type === "지정") {
                  if (sem1ForGrade > 0 || sem2ForGrade > 0) {
                    newDesignated.push({ subject: sub, category: broadCat, detailedCategory: category, sem1: sem1ForGrade, sem2: sem2ForGrade });
                  }
                } else {
                  newMap[sub] = broadCat;
                  if (sem1ForGrade > 0 || sem2ForGrade > 0) {
                    newSelected.push({ subject: sub, category: broadCat, detailedCategory: category, sem1: sem1ForGrade, sem2: sem2ForGrade });
                  }
                }
              }
            });
          }
        }
      }

      setParsedCurriculumList(prev => ({ ...prev, [activeGrade]: newParsed }));
      setDesignatedSubjects(prev => ({ ...prev, [activeGrade]: newDesignated }));
      setSelectedSubjectHours(prev => ({ ...prev, [activeGrade]: newSelected }));
      setSubjectMap(prev => ({ ...prev, [activeGrade]: newMap }));
      setIsCurriculumParsed(prev => ({ ...prev, [activeGrade]: true }));
      alert("교육과정 엑셀 파일이 성공적으로 업로드되었습니다!");
    };
    reader.readAsBinaryString(file);
  };

  const handleCategoryChange = (subject: string, category: SubjectCategory) => {
    setSubjectMap(prev => ({
      ...prev,
      [activeGrade]: { ...prev[activeGrade], [subject]: category }
    }));
  };

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
  };

  const handleRemovePrevHistoryFile = () => {
    setPreviousHistoryFiles(prev => ({ ...prev, [activeGrade]: null }));
    setPreviousSubjectMap(prev => ({ ...prev, [activeGrade]: {} }));
  };

  const normalizeSubjectName = (name: string): string => {
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

  const parseGroupAndSemester = (header: string) => {
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
        if (!val || val === "undefined") return;

        const chosenSubjectRaw = val.trim();
        const subjects = chosenSubjectRaw.split(",").map(s => s.trim());
        const { group, semester } = parseGroupAndSemester(k);
        
        subjects.forEach((subject, idx) => {
          if (!subject) return;
          
          const matchedCategory = getSubjectCategory(subject, activeGrade);

          if (subjects.length >= 2) {
            if (idx === 0) semester1.push(subject);
            else if (idx === 1) semester2.push(subject);
            else semester2.push(subject);
          } else {
            if (k.includes("1학기")) semester1.push(subject);
            else if (k.includes("2학기")) semester2.push(subject);
            else semester1.push(subject);
          }

          if (matchedCategory === "기초") basicCount++;
          if (matchedCategory === "사회") socialCount++;
          if (matchedCategory === "과학") scienceCount++;
          
          const statKey = `${group}|${semester}|${subject}`;
          if (!statsMap[statKey]) statsMap[statKey] = { group, semester, count: 0 };
          statsMap[statKey].count++;
        });
      });

      const allSubjects = [...semester1, ...semester2].filter(Boolean);
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
    
    // Sort logic: by Group first, then Semester, then applicants descending
    newStats.sort((a, b) => {
      if (a.group !== b.group) return a.group.localeCompare(b.group);
      if (a.semester !== b.semester) return a.semester.localeCompare(b.semester);
      return b.applicants - a.applicants;
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
    }
  }, [activeGrade, rawSheetData, subjectMap, hierarchyRules, previousSubjectMap]);

  const handleExport = () => {
    const dataToExport = processedData[activeGrade];
    if (dataToExport.length === 0) return;

    const wb = XLSX.utils.book_new();

    // Group by class
    const classes = Array.from(new Set(dataToExport.map(d => `${d.grade}-${parseInt(d.classNum)}`)));

    const maxSem1 = dataToExport.length > 0 ? Math.max(4, ...dataToExport.map(d => d.semester1.length)) : 4;
    const maxSem2 = dataToExport.length > 0 ? Math.max(4, ...dataToExport.map(d => d.semester2.length)) : 4;

    classes.forEach(cls => {
      const classData = dataToExport.filter(d => `${d.grade}-${parseInt(d.classNum)}` === cls);
      // Sort by student ID
      classData.sort((a, b) => parseInt(a.studentId) - parseInt(b.studentId));

      const aoa: any[][] = [];
      
      const headerRow = ["순번", "학번", "이름"];
      for (let i = 0; i < maxSem1; i++) headerRow.push(i === 0 ? "1학기" : "");
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
      const remarksColIndex = 3 + maxSem1 + maxSem2 + 3;

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

    XLSX.writeFile(wb, `Subject_Selection_${activeGrade === "grade1" ? "1학년" : "2학년"}_Processed.xlsx`);
  };

  const getClassRecommendation = (applicants: number, standardSize: number) => {
    if (applicants < 5) return "폐강";
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

    const titleText = `2026학년도 ${activeGrade === "grade1" ? "1학년" : "2학년(현 1학년)"} 선택과목 수요조사 결과`;

    const aoa: any[][] = [
      [titleText, "", "", "", ""],
      ["", "", "", "", ""],
      ["선택군", "학기", "과목", "신청자수", "비고"]
    ];

    stats.forEach(s => {
      const remark = getClassRecommendation(s.applicants, standardSize);
      aoa.push([
        s.group,
        s.semester,
        s.subject,
        s.applicants,
        remark
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    const merges: any[] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }
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
    XLSX.writeFile(wb, `Subject_Opening_${activeGrade === "grade1" ? "1학년" : "2학년"}_Analysis.xlsx`);
  };

  const activeData = processedData[activeGrade];
  const maxSem1 = activeData.length > 0 ? Math.max(4, ...activeData.map(d => d.semester1.length)) : 4;
  const maxSem2 = activeData.length > 0 ? Math.max(4, ...activeData.map(d => d.semester2.length)) : 4;

  const getDetailedCategory = (subject: string, cat: string) => {
    const specificCategories = ["국어", "영어", "수학", "사회", "과학", "체육", "미술", "음악", "일본어", "제2외국어", "정보", "한문", "진로", "교양"];
    
    // If cat is already a specific fine-grained category (not a broad one like 기초/기타), trust it
    if (cat && specificCategories.includes(cat)) return cat;

    if (subject.includes("국어") || subject.includes("독서") || subject.includes("문학") || subject.includes("화법") || subject.includes("언어")) return "국어";
    if (subject.includes("영어") || subject.includes("영미")) return "영어";
    if (subject.includes("수학") || subject.includes("기하") || subject.includes("미적분") || subject.includes("확률") || subject.includes("통계")) return "수학";
    if (subject.includes("사회") || subject.includes("지리") || subject.includes("역사") || subject.includes("도덕") || subject.includes("윤리") || subject.includes("경제") || subject.includes("정치") || subject.includes("동아시아") || subject.includes("세계사") || subject.includes("한국사")) return "사회";
    if (subject.includes("과학") || subject.includes("물리") || subject.includes("화학") || subject.includes("생명") || subject.includes("지구")) return "과학";
    if (subject.includes("체육") || subject.includes("스포츠")) return "체육";
    if (subject.includes("미술")) return "미술";
    if (subject.includes("음악")) return "음악";
    if (subject.includes("일본어")) return "일본어";
    if (subject.includes("정보") || subject.includes("인공지능")) return "정보";
    if (subject.includes("한문")) return "한문";
    if (subject.includes("진로")) return "진로";
    if (subject.includes("교양")) return "교양";
    
    return cat === "기초" ? "기초기타" : (cat || "기타");
  };



    const adjustmentLog = useMemo(() => {
    const log: Record<string, { beforeStr: string; afterStr: string; status: 'success' | 'failed'; reason?: string }[]> = {};
    if (!parsedSampleData || (!parsedSampleData.grade2.length && !parsedSampleData.grade3.length) || !electiveChanges) return log;
    
    (['grade2', 'grade3'] as ('grade2' | 'grade3')[]).forEach(grade => {
      const changes = electiveChanges[grade] || [];
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

      // Normalize subject names for fuzzy matching (handle Roman numeral vs English letter I, II, etc.)
      const normalizeSubject = (subject: string): string => {
        return subject.replace(/\s+/g, '')
                      .replace(/Ⅰ/g, 'I')
                      .replace(/Ⅱ/g, 'II')
                      .replace(/Ⅲ/g, 'III')
                      .replace(/Ⅳ/g, 'IV');
      };

      // Helper: check if a subject exists in a given timeslot (fuzzy match)
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

      // Helper: find which timeslots have a given subject
      const findSlotsWithSubject = (subject: string): string[] => {
        const slots: string[] = [];
        for (const slot of gradeTimeSlots) {
          if (subjectExistsInSlot(subject, slot)) {
            slots.push(slot);
          }
        }
        return slots;
      };
      
      // We need to maintain a working copy of each student's schedule to handle sequential changes properly
      const studentSchedules: Record<string, Record<string, string>> = {};

      changes.forEach(c => {
        if (!c.studentId || !c.beforeSubject || !c.afterSubject) return;
        
        const targetStudent = studentsInGrade.find(s => s.id === c.studentId);
        if (!targetStudent) {
          if (!log[c.studentId]) log[c.studentId] = [];
          log[c.studentId].push({ beforeStr: c.beforeSubject, afterStr: c.afterSubject, status: 'failed', reason: '학생을 찾을 수 없음' });
          return;
        }
        
        // Initialize working copy if it doesn't exist
        if (!studentSchedules[c.studentId]) {
          studentSchedules[c.studentId] = { ...targetStudent.timeSlotMap };
        }
        const currentSchedule = studentSchedules[c.studentId];
        
        // Find which timeslot the student currently has the beforeSubject
        let beforeSlot: string | null = null;
        const cleanBefore = normalizeSubject(c.beforeSubject);
        for (const [slot, subject] of Object.entries(currentSchedule)) {
          const cleanSubject = normalizeSubject(subject);
          if (cleanSubject === cleanBefore || cleanSubject.includes(cleanBefore) || cleanBefore.includes(cleanSubject)) {
            beforeSlot = slot;
            break;
          }
        }
        if (!beforeSlot) {
          if (!log[c.studentId]) log[c.studentId] = [];
          log[c.studentId].push({ beforeStr: c.beforeSubject, afterStr: c.afterSubject, status: 'failed', reason: `현재 수강중인 과목이 아님 (이전 변경으로 사라졌을 수 있음)` });
          return;
        }

        // Case 1: afterSubject exists in the SAME timeslot → direct swap
        if (subjectExistsInSlot(c.afterSubject, beforeSlot)) {
          if (!log[c.studentId]) log[c.studentId] = [];
          log[c.studentId].push({
            beforeStr: `${c.beforeSubject}(${beforeSlot})`,
            afterStr: `${c.afterSubject}(${beforeSlot})`,
            status: 'success'
          });
          // Update the working schedule
          currentSchedule[beforeSlot] = c.afterSubject;
          return;
        }

        // Case 2: afterSubject is in a DIFFERENT timeslot → 2-step change
        const afterSlots = findSlotsWithSubject(c.afterSubject);
        if (afterSlots.length === 0) {
          if (!log[c.studentId]) log[c.studentId] = [];
          log[c.studentId].push({ beforeStr: c.beforeSubject, afterStr: c.afterSubject, status: 'failed', reason: `시간표에 개설되지 않은 과목` });
          return;
        }

        let swapSuccess = false;
        let lastFailedReason = "";

        for (const afterSlot of afterSlots) {
          // Check what the student currently has in the afterSlot
          const studentSubjectInAfterSlot = currentSchedule[afterSlot];
          if (!studentSubjectInAfterSlot) {
            lastFailedReason = `${afterSlot}타임 수강 과목 없음`;
            continue;
          }

          // Check if the student's subject from afterSlot can be moved to beforeSlot
          if (subjectExistsInSlot(studentSubjectInAfterSlot, beforeSlot)) {
            if (!log[c.studentId]) log[c.studentId] = [];
            // Step 1: move the conflicting subject to the original timeslot
            log[c.studentId].push({
              beforeStr: `${studentSubjectInAfterSlot}(${afterSlot})`,
              afterStr: `${studentSubjectInAfterSlot}(${beforeSlot})`,
              status: 'success'
            });
            // Step 2: move the beforeSubject's slot to the afterSubject
            log[c.studentId].push({
              beforeStr: `${c.beforeSubject}(${beforeSlot})`,
              afterStr: `${c.afterSubject}(${afterSlot})`,
              status: 'success'
            });
            
            // Update the working schedule
            currentSchedule[beforeSlot] = studentSubjectInAfterSlot;
            currentSchedule[afterSlot] = c.afterSubject;
            
            swapSuccess = true;
            break; // Stop searching once we find a valid path
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
            // If multiple slots were checked, we show the reason for the last one we checked, or a generic one.
            reason: afterSlots.length > 1 ? `모든 가능한 타임(${afterSlots.join(', ')})에서 2단계 교환 실패` : lastFailedReason
          });
        }
      });
    });
    
    return log;
  }, [parsedSampleData, electiveChanges, timetableData, timeSlots, classCols]);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500/30 font-sans">
      {/* Background Gradients */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-rose-600/20 blur-[120px]" />
      </div>

      {/* Sidebar */}
      <aside className="relative z-20 w-64 bg-slate-900/80 backdrop-blur-xl border-r border-slate-800/80 flex flex-col shrink-0 shadow-2xl">
        <div className="p-6 pb-8 border-b border-slate-800/50">
          <h2 className="text-xl font-extrabold bg-gradient-to-r from-indigo-400 to-purple-400 text-transparent bg-clip-text">
            데이터 처리기
          </h2>
        </div>
        
        <div className="flex flex-col gap-2 p-4">
          <button 
            onClick={() => setActiveSidebarTab("survey")}
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-semibold transition-all duration-300 ${
              activeSidebarTab === "survey" 
                ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]" 
                : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent"
            }`}
          >
            <FileText className="w-5 h-5" />
            <span>수요조사</span>
          </button>
          <button 
            onClick={() => setActiveSidebarTab("change")}
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-semibold transition-all duration-300 ${
              activeSidebarTab === "change" 
                ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]" 
                : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent"
            }`}
          >
            <GitBranch className="w-5 h-5" />
            <span>선택과목 변경</span>
          </button>
        </div>
      </aside>

      <main className="relative z-10 flex-1 flex flex-col max-h-screen overflow-hidden">
        {/* Global Header */}
        <header className="flex-none px-10 py-6 border-b border-slate-800/30 bg-slate-950/40 backdrop-blur-sm flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
              {activeSidebarTab === "survey" ? "수강 신청 데이터 처리기" : "선택과목 변경 시스템"}
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl">
              {activeSidebarTab === "survey" 
                ? "학생 수강 신청 엑셀 파일을 업로드하면, 학급별 시트 분리 및 기초/사회/과학 과목 통계가 계산된 엑셀 파일로 변환해 드립니다." 
                : "수요조사 이후 선택과목을 변경하는 학생들의 데이터를 관리합니다."}
            </p>
          </div>
          
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
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-10 pb-24">
          <div className="max-w-[95%] 2xl:max-w-[1600px] mx-auto">
            
            {activeSidebarTab === "survey" && (
              <Fragment>
                <div className="flex gap-3 mb-8 p-1 bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-800/50 w-fit mx-auto">
          <button
            onClick={() => setActiveTab("curriculum")}
            className={`flex flex-col items-center gap-0.5 px-6 py-2.5 rounded-xl font-medium transition-all duration-300 ${
              activeTab === "curriculum"
                ? "bg-slate-800 text-white shadow-lg border border-slate-700"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <span className="text-[10px] tracking-wider font-semibold opacity-50">1단계</span>
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span>교육과정 편성표 입력</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab("hierarchy")}
            className={`flex flex-col items-center gap-0.5 px-6 py-2.5 rounded-xl font-medium transition-all duration-300 ${
              activeTab === "hierarchy"
                ? "bg-slate-800 text-white shadow-lg border border-slate-700"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <span className="text-[10px] tracking-wider font-semibold opacity-50">2단계</span>
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4" />
              <span>과목 위계 설정</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab("upload")}
            className={`flex flex-col items-center gap-0.5 px-6 py-2.5 rounded-xl font-medium transition-all duration-300 ${
              activeTab === "upload"
                ? "bg-slate-800 text-white shadow-lg border border-slate-700"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <span className="text-[10px] tracking-wider font-semibold opacity-50">3단계</span>
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              <span>파일 업로드</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`flex flex-col items-center gap-0.5 px-6 py-2.5 rounded-xl font-medium transition-all duration-300 ${
              activeTab === "preview"
                ? "bg-slate-800 text-white shadow-lg border border-slate-700"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <span className="text-[10px] tracking-wider font-semibold opacity-50">4단계</span>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>수요조사 결과</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab("classOpening")}
            className={`flex flex-col items-center gap-0.5 px-6 py-2.5 rounded-xl font-medium transition-all duration-300 ${
              activeTab === "classOpening"
                ? "bg-slate-800 text-white shadow-lg border border-slate-700"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <span className="text-[10px] tracking-wider font-semibold opacity-50">5단계</span>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>과목 개설 여부</span>
            </div>
          </button>

        </div>

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

              <p className="text-slate-400">
                선택하신 학년의 교육과정 편성표 엑셀 파일을 업로드해 주세요. 3개년 데이터가 모두 포함된 원본 엑셀 파일을 그대로 올리시면 됩니다.
              </p>
              
              <div className="relative group">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleCurriculumUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="flex flex-col items-center justify-center w-full h-40 bg-slate-900/50 border-2 border-dashed border-slate-700 rounded-xl group-hover:border-indigo-500/50 group-hover:bg-indigo-500/5 transition-all">
                  <Upload className="w-10 h-10 text-slate-500 group-hover:text-indigo-400 mb-3 transition-colors" />
                  <p className="text-slate-300 font-medium">클릭하거나 엑셀 파일을 드래그하여 업로드하세요</p>
                  <p className="text-slate-500 text-sm mt-1">.xlsx, .xls 파일 지원</p>
                </div>
              </div>

              {isCurriculumParsed[activeGrade] && parsedCurriculumList[activeGrade]?.length > 0 && (
                <div className="mt-8 p-6 bg-slate-950/50 border border-slate-800 rounded-2xl animate-in fade-in">
                  <h3 className="text-xl font-medium text-slate-200 mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    추출된 교육과정 데이터 ({activeGrade === "grade1" ? "1학년 탭" : "2학년 탭"})
                  </h3>
                  <p className="text-sm text-slate-400 mb-6">
                    업로드된 엑셀 파일에서 1~3학년 전체 교육과정을 자동으로 분석했습니다. 내부적으로 기초/사회/과학 과목 매핑도 완료되었습니다.
                  </p>
                  
                  <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-400 uppercase bg-slate-900/80">
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
                              <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider ${
                                subj.type === "지정" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                              }`}>
                                {subj.type}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-200">{subj.subject}</td>
                            <td className="px-4 py-3 text-slate-400">{subj.category}</td>
                            <td className="px-4 py-3 text-center text-amber-400/90 font-mono">{subj.credits}</td>
                            <td className="px-4 py-3 text-slate-500 text-xs">{subj.semesters}</td>
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

              <p className="text-slate-400">
                특정 과목을 수강하기 위해 먼저 들어야 하는 선수 과목 규칙을 설정할 수 있습니다. 1단계에서 분석된 과목들만 선택 가능합니다.
              </p>
              
              {!isCurriculumParsed[activeGrade] || Object.keys(subjectMap[activeGrade]).length === 0 ? (
                <div className="p-8 bg-slate-950/50 border border-slate-800 rounded-2xl text-center">
                  <p className="text-slate-500">먼저 교육과정 설정 탭에서 과목을 분석해 주세요.</p>
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
                     <div className="p-6 bg-slate-900/50 border border-dashed border-slate-700 rounded-xl text-center text-slate-500 text-sm">
                       설정된 위계 규칙이 없습니다. 필요한 경우 규칙을 추가해 주세요.
                     </div>
                  )}

                  <div className="grid gap-3">
                    {(hierarchyRules[activeGrade] || []).map((rule, idx) => (
                      <div key={rule.id} className="flex items-center gap-3 p-4 bg-slate-900 border border-slate-700/50 rounded-xl">
                        <span className="text-slate-400 font-medium">#{idx + 1}</span>
                        <div className="flex-1 flex items-center gap-4">
                          <div className="flex-1">
                            <label className="block text-xs text-slate-500 mb-1">선행 과목 (먼저 듣는 과목)</label>
                            <select 
                              value={rule.prereq}
                              onChange={(e) => {
                                const newRules = [...hierarchyRules[activeGrade]];
                                newRules[idx].prereq = e.target.value;
                                setHierarchyRules(prev => ({ ...prev, [activeGrade]: newRules }));
                              }}
                              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            >
                              {Object.keys(subjectMap[activeGrade]).map(subj => (
                                <option key={subj} value={subj}>{subj}</option>
                              ))}
                            </select>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-600 mt-5" />
                          <div className="flex-1">
                            <label className="block text-xs text-slate-500 mb-1">후행 과목 (나중에 듣는 과목)</label>
                            <select 
                              value={rule.advanced}
                              onChange={(e) => {
                                const newRules = [...hierarchyRules[activeGrade]];
                                newRules[idx].advanced = e.target.value;
                                setHierarchyRules(prev => ({ ...prev, [activeGrade]: newRules }));
                              }}
                              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            >
                              {Object.keys(subjectMap[activeGrade]).map(subj => (
                                <option key={subj} value={subj}>{subj}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const newRules = hierarchyRules[activeGrade].filter(r => r.id !== rule.id);
                            setHierarchyRules(prev => ({ ...prev, [activeGrade]: newRules }));
                          }}
                          className="mt-5 p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
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
                <p className="text-slate-400 text-sm">
                  당해년도 수요조사 설문 파일과 이전 학년의 이수 이력 데이터(선택)를 업로드해 주세요.
                </p>
              </div>
              
              {renderGradeTabs()}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. 당해년도 수강신청 파일 업로드 */}
                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-slate-200 flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold">1</span>
                    당해년도 수요조사 설문 파일 (필수)
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
                      <p className="text-xs text-slate-500 mb-4">또는 클릭하여 컴퓨터에서 선택 (.xlsx, .xls)</p>
                      <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors border border-slate-700">
                        파일 선택
                      </button>
                    </div>
                  ) : (
                    <div className="border border-slate-805 bg-slate-900/30 rounded-2xl p-6 flex flex-col justify-between h-[196px]">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-500/30 flex-shrink-0">
                          <FileIcon className="w-6 h-6" />
                        </div>
                        <div className="overflow-hidden">
                          <h4 className="text-md font-medium text-slate-200 truncate" title={uploadedFiles[activeGrade]?.name}>
                            {uploadedFiles[activeGrade]?.name}
                          </h4>
                          <p className="text-xs text-slate-500 mt-1">
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
                          className="px-3 py-2 bg-slate-850 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 rounded-lg transition-colors border border-slate-800"
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
                      <p className="text-xs text-slate-400 mb-4 px-4 leading-relaxed">
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
                          <p className="text-xs text-slate-500 mt-1">
                            {(previousHistoryFiles[activeGrade]!.size / 1024).toFixed(1)} KB
                          </p>
                          <span className="inline-block mt-2 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded border border-emerald-500/20">
                            총 {Object.keys(previousSubjectMap[activeGrade] || {}).length}명 연동 완료
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1 py-2 text-center text-slate-400 text-xs bg-slate-800/50 rounded-lg flex items-center justify-center border border-slate-800">
                          다년도 위계 검사 자동 적용됨
                        </div>
                        <button 
                          onClick={handleRemovePrevHistoryFile}
                          className="px-3 py-2 bg-slate-850 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 rounded-lg transition-colors border border-slate-800"
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
                  4단계: 수요조사 결과 및 다운로드
                </h2>
                <button 
                  onClick={handleExport}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-emerald-500/25 flex items-center gap-2"
                  disabled={activeData.length === 0}
                >
                  <Download className="w-4 h-4" />
                  {activeGrade === "grade1" ? "1학년" : "2학년"} 엑셀 다운로드
                </button>
              </div>

              {renderGradeTabs()}
              
              {activeData.length === 0 ? (
                <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-8 text-center">
                  <p className="text-slate-500">선택하신 학년의 데이터가 아직 없습니다. 교육과정 설정과 파일 업로드를 진행해 주세요.</p>
                </div>
              ) : (
                <div className="bg-slate-950/50 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="overflow-auto max-h-[650px] relative">
                    <table className="w-full text-sm text-left text-slate-300 border-collapse">
                      <thead className="text-xs text-slate-400 uppercase bg-slate-900 border-b border-slate-800">
                        <tr>
                          <th className="px-2 py-2.5 whitespace-nowrap sticky top-0 left-0 z-40 bg-slate-900 min-w-[50px] max-w-[50px] border-r border-slate-800 text-center">순번</th>
                          <th className="px-2 py-2.5 whitespace-nowrap sticky top-0 left-[50px] z-40 bg-slate-900 min-w-[80px] max-w-[80px] border-r border-slate-800 text-center">학번</th>
                          <th className="px-2 py-2.5 whitespace-nowrap sticky top-0 left-[130px] z-40 bg-slate-900 min-w-[80px] max-w-[80px] border-r border-slate-800/50 text-center shadow-[2px_0_5px_rgba(0,0,0,0.3)]">이름</th>
                          <th className="px-2 py-2.5 text-center whitespace-nowrap sticky top-0 z-10 bg-slate-900 border-r border-slate-800" colSpan={maxSem1}>1학기</th>
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
                            {Array.from({length: maxSem1}).map((_, i) => {
                               const subject = row.semester1[i] || "";
                               const isDuplicate = subject && row.duplicateSubjects?.includes(subject);
                               const isHierarchyViolation = subject && row.hierarchyViolations?.some(v => v.subject === subject || v.prereq === subject);
                               let cellClass = "px-2 py-2.5 whitespace-nowrap ";
                               if (isHierarchyViolation) cellClass += "text-cyan-400 font-bold bg-cyan-400/10 rounded-md";
                               else if (isDuplicate) cellClass += "text-yellow-400 font-bold bg-yellow-400/10 rounded-md";

                               return (
                                 <td key={`s1-${i}`} className={cellClass}>
                                   {subject}
                                 </td>
                               );
                            })}
                            {Array.from({length: maxSem2}).map((_, i) => {
                               const subject = row.semester2[i] || "";
                               const isDuplicate = subject && row.duplicateSubjects?.includes(subject);
                               const isHierarchyViolation = subject && row.hierarchyViolations?.some(v => v.subject === subject || v.prereq === subject);
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
                  {activeGrade === "grade1" ? "1학년" : "2학년"} 개설 여부 엑셀 다운로드
                </button>
              </div>

              {renderGradeTabs()}

              {/* 학급 기준 인원 설정 */}
              <div className="p-5 bg-slate-950/40 border border-slate-800/80 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-200">학급 분반 및 개설 기준 설정</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    설정된 학급 기준 인원에 따라 개설(70% 이상), 논의(70% 미만), 분반 추천(120% 초과) 및 폐강(5명 미만) 여부를 자동으로 판단합니다.
                  </p>
                </div>
                <div className="flex items-center gap-3">
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
                    className="w-20 bg-slate-950 border border-slate-700 text-center rounded-lg px-2 py-1.5 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-400">명</span>
                </div>
              </div>

              {subjectStats[activeGrade].length === 0 ? (
                <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-8 text-center">
                  <p className="text-slate-500">선택하신 학년의 데이터가 아직 없습니다. 교육과정 설정과 파일 업로드를 진행해 주세요.</p>
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
                        <thead className="text-xs text-slate-400 uppercase bg-slate-900 border-b border-slate-800">
                          <tr>
                            <th className="px-4 py-3 text-center border-r border-slate-800/60 min-w-[100px]">선택군</th>
                            <th className="px-4 py-3 text-center border-r border-slate-800/60 min-w-[120px]">학기</th>
                            <th className="px-6 py-3 border-r border-slate-800/60">과목</th>
                            <th className="px-4 py-3 text-center border-r border-slate-800/60 min-w-[120px]">신청자 수</th>
                            <th className="px-4 py-3 text-center min-w-[120px]">비고</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.map((row, idx) => {
                            const remark = getClassRecommendation(row.applicants, standardSize);
                            
                            let remarkStyle = "text-slate-300 font-medium";
                            if (remark === "폐강") {
                              remarkStyle = "text-rose-400 font-bold bg-rose-500/10 px-2.5 py-1 rounded-md inline-block";
                            } else if (remark === "논의") {
                              remarkStyle = "text-amber-400 font-bold bg-amber-500/10 px-2.5 py-1 rounded-md inline-block";
                            } else if (remark !== "개설" && remark !== "") {
                              remarkStyle = "text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-md inline-block";
                            }

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
                                <td className="px-4 py-3.5 text-center align-middle">
                                  <span className={remarkStyle}>
                                    {remark}
                                  </span>
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
        </div>
      </Fragment>
    )}

            {activeSidebarTab === "change" && (
              <Fragment>
                <div className="flex gap-3 mb-8 p-1 bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-800/50 w-fit mx-auto">
                  <button
                    onClick={() => setChangeActiveTab("upload")}
                    className={`flex flex-col items-center gap-0.5 px-6 py-2.5 rounded-xl font-medium transition-all duration-300 ${
                      changeActiveTab === "upload"
                        ? "bg-slate-800 text-white shadow-lg border border-slate-700"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <span className="text-[10px] tracking-wider font-semibold opacity-50">1단계</span>
                    <div className="flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      <span>학생 선택 데이터 업로드</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setChangeActiveTab("timetable")}
                    className={`flex flex-col items-center gap-0.5 px-6 py-2.5 rounded-xl font-medium transition-all duration-300 ${
                      changeActiveTab === "timetable"
                        ? "bg-slate-800 text-white shadow-lg border border-slate-700"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <span className="text-[10px] tracking-wider font-semibold opacity-50">2단계</span>
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      <span>타임별 시간표 입력</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setChangeActiveTab("roster")}
                    className={`flex flex-col items-center gap-0.5 px-6 py-2.5 rounded-xl font-medium transition-all duration-300 ${
                      changeActiveTab === "roster"
                        ? "bg-slate-800 text-white shadow-lg border border-slate-700"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <span className="text-[10px] tracking-wider font-semibold opacity-50">3단계</span>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>3단계: 타임별 선택과목 명단</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setChangeActiveTab("application")}
                    className={`flex flex-col items-center gap-0.5 px-6 py-2.5 rounded-xl font-medium transition-all duration-300 ${
                      changeActiveTab === "application"
                        ? "bg-slate-800 text-white shadow-lg border border-slate-700"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <span className="text-[10px] tracking-wider font-semibold opacity-50">4단계</span>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span>4단계: 선택과목 변경 신청</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setChangeActiveTab("roster_after")}
                    className={`flex flex-col items-center gap-0.5 px-6 py-2.5 rounded-xl font-medium transition-all duration-300 ${
                      changeActiveTab === "roster_after"
                        ? "bg-slate-800 text-white shadow-lg border border-slate-700"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <span className="text-[10px] tracking-wider font-semibold opacity-50">5단계</span>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>5단계: 변경 후 명단</span>
                    </div>
                  </button>
                </div>

                <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/60 rounded-3xl p-8 shadow-2xl">
                  {changeActiveTab === "upload" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex justify-between items-center mb-2">
                        <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                          <Upload className="w-6 h-6 text-indigo-400" />
                          학생 선택 데이터 업로드
                        </h2>
                        
                        <div className="flex bg-slate-800/50 p-1 rounded-xl">
                          <button
                            onClick={() => setChangeActiveGrade("grade2")}
                            className={`px-6 py-2 rounded-lg font-medium transition-all ${
                              changeActiveGrade === "grade2"
                                ? "bg-indigo-500 text-white shadow-md"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            2학년
                          </button>
                          <button
                            onClick={() => setChangeActiveGrade("grade3")}
                            className={`px-6 py-2 rounded-lg font-medium transition-all ${
                              changeActiveGrade === "grade3"
                                ? "bg-indigo-500 text-white shadow-md"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            3학년
                          </button>
                        </div>
                      </div>
                      
                      {parsedSampleData[changeActiveGrade] && parsedSampleData[changeActiveGrade].length > 0 ? (
                        <div className="bg-slate-800/30 rounded-2xl p-8 border border-emerald-500/30 flex flex-col items-center justify-center min-h-[300px] text-center">
                          <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                          </div>
                          <h3 className="text-xl font-semibold text-emerald-400 mb-2">업로드 및 파싱 완료</h3>
                          <p className="text-slate-300 mb-2 font-medium">
                            {changeActiveGrade === "grade2" ? "2학년" : "3학년"} 학생 선택 데이터: {parsedSampleData[changeActiveGrade].length}명
                          </p>
                          <p className="text-slate-400 text-sm mb-6 max-w-md">
                            다음 단계인 '2단계: 타임별 시간표 입력' 탭으로 이동하여 시간표를 작성하거나 파일을 다시 업로드할 수 있습니다.
                          </p>
                          <div className="flex gap-4">
                            <label className="cursor-pointer flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-medium rounded-xl transition-all">
                              <Upload className="w-4 h-4" />
                              재업로드
                              <input
                                type="file"
                                accept=".xlsx, .xls"
                                className="hidden"
                                onChange={handleChangeSampleUpload}
                              />
                            </label>
                            <button
                              onClick={() => setChangeActiveTab("timetable")}
                              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                            >
                              시간표 입력으로 이동
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50 flex flex-col items-center justify-center min-h-[300px]">
                          <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                            <FileIcon className="w-10 h-10 text-indigo-400" />
                          </div>
                          <h3 className="text-xl font-medium text-slate-200 mb-2">학생 선택 데이터 파일 (sample3) 업로드</h3>
                          <p className="text-slate-400 mb-6 text-center max-w-md">
                            과목명이 열 헤더로 지정되어 있고, 셀 값으로 A, B, C, D 등의 선택 그룹이 명시된 수요조사 결과 파일을 업로드해 주세요.
                          </p>
                          
                          <label className="cursor-pointer flex items-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-500/20">
                            <Upload className="w-5 h-5" />
                            엑셀 파일 선택
                            <input
                              type="file"
                              accept=".xlsx, .xls"
                              className="hidden"
                              onChange={handleChangeSampleUpload}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {changeActiveTab === "timetable" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex justify-between items-center mb-2">
                        <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                          <Settings className="w-6 h-6 text-indigo-400" />
                          타임별 시간표 입력
                        </h2>
                        
                        <div className="flex bg-slate-800/50 p-1 rounded-xl">
                          <button
                            onClick={() => setChangeActiveGrade("grade2")}
                            className={`px-6 py-2 rounded-lg font-medium transition-all ${
                              changeActiveGrade === "grade2"
                                ? "bg-indigo-500 text-white shadow-md"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            2학년
                          </button>
                          <button
                            onClick={() => setChangeActiveGrade("grade3")}
                            className={`px-6 py-2 rounded-lg font-medium transition-all ${
                              changeActiveGrade === "grade3"
                                ? "bg-indigo-500 text-white shadow-md"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            3학년
                          </button>
                        </div>
                      </div>
                      
                      <div className="bg-slate-900 rounded-2xl border border-slate-700/50 overflow-hidden shadow-xl">
                        <div className="p-4 border-b border-slate-800/80 bg-slate-800/30 flex justify-between items-center">
                          <div className="text-sm text-slate-400">
                            엑셀에서 복사한 데이터를 칸에 클릭 후 붙여넣기(Ctrl+V) 하시면 한 번에 자동으로 채워집니다.
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={addTimeSlot}
                              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 rounded-lg font-medium text-sm transition-colors border border-indigo-500/30"
                            >
                              <Plus className="w-4 h-4" /> 타임 추가
                            </button>
                            <button 
                              onClick={addClassCol}
                              className="flex items-center gap-1 px-3 py-1.5 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded-lg font-medium text-sm transition-colors border border-rose-500/30"
                            >
                              <Plus className="w-4 h-4" /> 반 추가
                            </button>
                          </div>
                        </div>
                        
                        <div className="overflow-x-auto pb-4">
                          <table className="w-full text-sm text-left whitespace-nowrap">
                            <thead className="text-xs text-slate-300 uppercase bg-slate-800/80">
                              <tr>
                                <th className="px-4 py-3 border-r border-slate-700/50 w-24 text-center">타임</th>
                                {classCols[changeActiveGrade].map((col, cIdx) => (
                                  <th key={cIdx} className="px-4 py-3 border-r border-slate-700/50 min-w-[100px] text-center relative group">
                                    {col}
                                    <button 
                                      onClick={() => removeClassCol(cIdx)}
                                      className="absolute top-1/2 -translate-y-1/2 right-2 text-rose-400 opacity-0 group-hover:opacity-100 hover:text-rose-300 transition-opacity"
                                      title="열 삭제"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {timeSlots[changeActiveGrade].map((row, rIdx) => (
                                <tr key={rIdx} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                  <th className="px-4 py-3 border-r border-slate-700/50 font-medium text-slate-300 text-center bg-slate-800/20 relative group">
                                    {row}타임
                                    <button 
                                      onClick={() => removeTimeSlot(rIdx)}
                                      className="absolute top-1/2 -translate-y-1/2 right-2 text-rose-400 opacity-0 group-hover:opacity-100 hover:text-rose-300 transition-opacity"
                                      title="행 삭제"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </th>
                                  {classCols[changeActiveGrade].map((col, cIdx) => (
                                    <td key={`${rIdx}-${cIdx}`} className="p-0 border-r border-slate-800/50 relative">
                                      <div className="flex flex-col h-full min-h-[64px]">
                                        <input
                                          type="text"
                                          className="w-full flex-1 bg-transparent text-slate-200 px-2 text-center text-sm font-medium focus:outline-none focus:bg-indigo-500/10 focus:ring-1 focus:ring-indigo-500/50 border-b border-slate-800/50"
                                          value={timetableData[changeActiveGrade]?.[row]?.[col]?.subject || ""}
                                          onChange={(e) => updateTimetableCell(row, col, "subject", e.target.value)}
                                          onPaste={(e) => handleTimetablePaste(e, rIdx, cIdx, "subject")}
                                          placeholder="과목명"
                                        />
                                        <input
                                          type="text"
                                          className="w-full flex-1 bg-transparent text-slate-400 px-2 text-center text-xs focus:outline-none focus:bg-indigo-500/10 focus:ring-1 focus:ring-indigo-500/50"
                                          value={timetableData[changeActiveGrade]?.[row]?.[col]?.teacher || ""}
                                          onChange={(e) => updateTimetableCell(row, col, "teacher", e.target.value)}
                                          onPaste={(e) => handleTimetablePaste(e, rIdx, cIdx, "teacher")}
                                          placeholder="교사명"
                                        />
                                      </div>
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {changeActiveTab === "application" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex justify-between items-center mb-2">
                        <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                          <FileText className="w-6 h-6 text-indigo-400" />
                          4단계: 선택과목 변경 신청 내역
                        </h2>
                        <div className="flex bg-slate-800/50 p-1 rounded-xl">
                          <button
                            onClick={() => setChangeActiveGrade("grade2")}
                            className={`px-6 py-2 rounded-lg font-medium transition-all ${
                              changeActiveGrade === "grade2"
                                ? "bg-indigo-500 text-white shadow-md"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            2학년
                          </button>
                          <button
                            onClick={() => setChangeActiveGrade("grade3")}
                            className={`px-6 py-2 rounded-lg font-medium transition-all ${
                              changeActiveGrade === "grade3"
                                ? "bg-indigo-500 text-white shadow-md"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            3학년
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-inner">
                          <div className="p-4 bg-slate-800/80 border-b border-slate-700/50">
                            <h3 className="font-semibold text-slate-200">변경 신청 입력</h3>
                          </div>
                          <div className="overflow-auto max-h-[600px] relative">
                            <table className="w-full text-sm text-left text-slate-300 border-collapse">
                              <thead className="text-xs text-slate-400 bg-slate-800 border-b border-slate-700 uppercase">
                                <tr>
                                  <th className="px-3 py-3 font-semibold text-center w-12 border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800 shadow-sm">순번</th>
                                  <th className="px-4 py-3 font-semibold text-center w-24 border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800 shadow-sm">학번</th>
                                  <th className="px-4 py-3 font-semibold text-center w-24 border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800 shadow-sm">이름</th>
                                  <th className="px-4 py-3 font-semibold text-center border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800 shadow-sm">변경전</th>
                                  <th className="px-2 py-3 font-semibold text-center w-8 border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800 shadow-sm">→</th>
                                  <th className="px-4 py-3 font-semibold text-center border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800 shadow-sm">변경후</th>
                                  <th className="px-2 py-3 font-semibold text-center w-12 sticky top-0 z-10 bg-slate-800 shadow-sm">
                                    <button onClick={() => {
                                      setElectiveChanges(prev => ({
                                        ...prev,
                                        [changeActiveGrade]: [...prev[changeActiveGrade], {
                                          id: Date.now().toString() + Math.random().toString(36).substring(7),
                                          studentId: "",
                                          studentName: "",
                                          beforeSubject: "",
                                          afterSubject: ""
                                        }]
                                      }));
                                    }} className="p-1 text-slate-400 hover:text-emerald-400 transition-colors">
                                      <Plus className="w-5 h-5 mx-auto" />
                                    </button>
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  const data = electiveChanges[changeActiveGrade];
                                  if (data.length === 0) {
                                    return (
                                      <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                          등록된 선택과목 변경 신청 내역이 없습니다.<br/>
                                          우측 상단의 <Plus className="w-4 h-4 inline mx-1" /> 버튼을 눌러 추가하세요.
                                        </td>
                                      </tr>
                                    );
                                  }

                                  const groupedData: any[] = [];
                                  data.forEach(item => {
                                    const lastGroup = groupedData[groupedData.length - 1];
                                    if (lastGroup && lastGroup.studentId === item.studentId && lastGroup.studentId !== "") {
                                      lastGroup.items.push(item);
                                    } else {
                                      groupedData.push({ studentId: item.studentId, items: [item] });
                                    }
                                  });

                                  let globalIndex = 0;
                                  return groupedData.map((group: any, groupIdx: number) => {
                                    return group.items.map((item: any, itemIdx: number) => {
                                      const currentIndex = globalIndex++;
                                      const isFirstInGroup = itemIdx === 0;
                                      const rowSpan = group.items.length;
                                      
                                      const updateItem = (field: string, value: string) => {
                                        setElectiveChanges(prev => {
                                          const newData = [...prev[changeActiveGrade]];
                                          const index = newData.findIndex(x => x.id === item.id);
                                          if (index > -1) newData[index] = { ...newData[index], [field]: value };
                                          return { ...prev, [changeActiveGrade]: newData };
                                        });
                                      };

                                      return (
                                        <tr key={item.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                                          <td className="px-3 py-2 text-center border-r border-slate-700/50 text-slate-500">{currentIndex + 1}</td>
                                          {isFirstInGroup && (
                                            <>
                                              <td rowSpan={rowSpan} className="px-2 py-2 border-r border-slate-700/50 align-top">
                                                <input
                                                  type="text"
                                                  value={item.studentId}
                                                  onChange={e => {
                                                    const val = e.target.value;
                                                    setElectiveChanges(prev => {
                                                      const newData = [...prev[changeActiveGrade]];
                                                      group.items.forEach((gItem: any) => {
                                                        const idx = newData.findIndex(x => x.id === gItem.id);
                                                        if (idx > -1) newData[idx] = { ...newData[idx], studentId: val };
                                                      });
                                                      return { ...prev, [changeActiveGrade]: newData };
                                                    });
                                                  }}
                                                  className="w-full bg-slate-950/50 border border-slate-700 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-center text-sm"
                                                  placeholder="학번"
                                                />
                                              </td>
                                              <td rowSpan={rowSpan} className="px-2 py-2 border-r border-slate-700/50 align-top">
                                                <input
                                                  type="text"
                                                  value={item.studentName}
                                                  onChange={e => {
                                                    const val = e.target.value;
                                                    setElectiveChanges(prev => {
                                                      const newData = [...prev[changeActiveGrade]];
                                                      group.items.forEach((gItem: any) => {
                                                        const idx = newData.findIndex(x => x.id === gItem.id);
                                                        if (idx > -1) newData[idx] = { ...newData[idx], studentName: val };
                                                      });
                                                      return { ...prev, [changeActiveGrade]: newData };
                                                    });
                                                  }}
                                                  className="w-full bg-slate-950/50 border border-slate-700 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-center text-sm"
                                                  placeholder="이름"
                                                />
                                              </td>
                                            </>
                                          )}
                                          <td className="px-2 py-2 border-r border-slate-700/50">
                                            <input
                                              type="text"
                                              value={item.beforeSubject}
                                              onChange={e => updateItem("beforeSubject", e.target.value)}
                                              className="w-full bg-slate-950/50 border border-slate-700 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-center text-sm"
                                            />
                                          </td>
                                          <td className="px-2 py-2 text-center text-slate-600 border-r border-slate-700/50">→</td>
                                          <td className="px-2 py-2 border-r border-slate-700/50">
                                            <input
                                              type="text"
                                              value={item.afterSubject}
                                              onChange={e => updateItem("afterSubject", e.target.value)}
                                              className="w-full bg-slate-950/50 border border-slate-700 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-center text-sm"
                                            />
                                          </td>
                                          <td className="px-2 py-2 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                              <button onClick={() => {
                                                setElectiveChanges(prev => {
                                                  const newData = [...prev[changeActiveGrade]];
                                                  const currentIdx = newData.findIndex(x => x.id === item.id);
                                                  const newItem = {
                                                    id: Date.now().toString() + Math.random().toString(36).substring(7),
                                                    studentId: item.studentId,
                                                    studentName: item.studentName,
                                                    beforeSubject: "",
                                                    afterSubject: ""
                                                  };
                                                  newData.splice(currentIdx + 1, 0, newItem);
                                                  return { ...prev, [changeActiveGrade]: newData };
                                                });
                                              }} className="p-1 text-slate-500 hover:text-emerald-400 transition-colors" title="같은 학생 과목 추가">
                                                <Plus className="w-3.5 h-3.5" />
                                              </button>
                                              <button onClick={() => {
                                                setElectiveChanges(prev => ({
                                                  ...prev,
                                                  [changeActiveGrade]: prev[changeActiveGrade].filter(x => x.id !== item.id)
                                                }));
                                              }} className="p-1 text-slate-500 hover:text-red-400 transition-colors" title="삭제">
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    });
                                  });
                                })()}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-inner flex flex-col">
                          <div className="p-4 bg-slate-800/80 border-b border-slate-700/50">
                            <h3 className="font-semibold text-emerald-400">자동 변경 결과 내역</h3>
                          </div>
                          <div className="overflow-auto max-h-[600px] flex-1">
                            <table className="w-full text-sm text-left text-slate-300 border-collapse">
                              <thead className="text-xs text-slate-400 bg-slate-800/50 border-b border-slate-700 uppercase">
                                <tr>
                                  <th className="px-4 py-3 font-semibold text-center w-24 border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800/90 backdrop-blur shadow-sm">학번</th>
                                  <th className="px-4 py-3 font-semibold text-center w-24 border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800/90 backdrop-blur shadow-sm">이름</th>
                                  <th className="px-4 py-3 font-semibold text-center sticky top-0 z-10 bg-slate-800/90 backdrop-blur shadow-sm">변경 내역</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  const data = electiveChanges[changeActiveGrade];
                                  if (data.length === 0) {
                                    return (
                                      <tr>
                                        <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                                          신청 내역을 입력하면 자동 변경 결과가 이곳에 표시됩니다.
                                        </td>
                                      </tr>
                                    );
                                  }

                                  const studentsWithChanges = Array.from(new Set(data.map(d => d.studentId))).filter(id => id);
                                  
                                  if (studentsWithChanges.length === 0) {
                                    return (
                                      <tr>
                                        <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                                          유효한 학번이 입력되지 않았습니다.
                                        </td>
                                      </tr>
                                    );
                                  }

                                  return studentsWithChanges.map(studentId => {
                                    const logs = adjustmentLog[studentId] || [];
                                    const studentName = data.find(d => d.studentId === studentId)?.studentName || "";
                                    
                                    return (
                                      <tr key={studentId} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                                        <td className="px-4 py-3 text-center border-r border-slate-700/50 font-medium">{studentId}</td>
                                        <td className="px-4 py-3 text-center border-r border-slate-700/50">{studentName}</td>
                                        <td className="px-4 py-3">
                                          {logs.length > 0 ? (
                                            <div className="space-y-1">
                                              {logs.map((log, i) => (
                                                <div 
                                                  key={i} 
                                                  className={`inline-block px-2 py-1 rounded border text-xs mr-2 mb-1 ${
                                                    log.status === 'success' 
                                                      ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' 
                                                      : 'text-rose-300 bg-rose-500/10 border-rose-500/20 cursor-help'
                                                  }`}
                                                  title={log.reason}
                                                >
                                                  {log.beforeStr} → {log.afterStr}
                                                  {log.status === 'failed' && <span className="ml-1 font-bold">(불가)</span>}
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <span className="text-slate-500 italic text-xs">일치하는 수강 명단 없음</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  });
                                })()}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {changeActiveTab === "roster_after" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex justify-between items-center mb-2">
                        <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                          <Users className="w-6 h-6 text-indigo-400" />
                          5단계: 타임별 선택과목 명단(변경 후)
                        </h2>
                        
                        <div className="flex bg-slate-800/50 p-1 rounded-xl">
                          <button
                            onClick={() => setChangeActiveGrade("grade2")}
                            className={`px-6 py-2 rounded-lg font-medium transition-all ${
                              changeActiveGrade === "grade2"
                                ? "bg-indigo-500 text-white shadow-md"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            2학년
                          </button>
                          <button
                            onClick={() => setChangeActiveGrade("grade3")}
                            className={`px-6 py-2 rounded-lg font-medium transition-all ${
                              changeActiveGrade === "grade3"
                                ? "bg-indigo-500 text-white shadow-md"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            3학년
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap mb-4">
                        {timeSlots[changeActiveGrade].map(slot => (
                          <button
                            key={slot}
                            onClick={() => setChangeRosterTimeSlot(slot)}
                            className={`px-5 py-2 rounded-lg font-medium transition-all ${
                              changeRosterTimeSlot === slot
                                ? "bg-indigo-600 text-white shadow-md"
                                : "bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                            }`}
                          >
                            {slot}타임
                          </button>
                        ))}
                      </div>

                      <div className="bg-slate-900 rounded-2xl border border-slate-700/50 overflow-hidden shadow-xl">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left border-collapse">
                            <thead>
                              <tr className="bg-amber-400/20 text-amber-200 border-b-2 border-slate-700">
                                <th className="px-3 py-2 border-r border-slate-700/50 text-center font-bold min-w-[80px]">과목명</th>
                                {classCols[changeActiveGrade].map(col => (
                                  <th key={col} colSpan={2} className="px-3 py-2 border-r border-slate-700/50 text-center font-bold min-w-[120px]">
                                    {timetableData[changeActiveGrade]?.[changeRosterTimeSlot]?.[col]?.subject || "-"}
                                  </th>
                                ))}
                              </tr>
                              <tr className="bg-slate-800 border-b border-slate-700">
                                <th className="px-3 py-2 border-r border-slate-700/50 text-center font-semibold text-slate-300">강의실</th>
                                {classCols[changeActiveGrade].map(col => (
                                  <Fragment key={`room-${col}`}>
                                    <th colSpan={2} className="px-3 py-2 border-r border-slate-700/50 text-center font-semibold text-slate-300 bg-slate-800/80">
                                      {col}
                                    </th>
                                  </Fragment>
                                ))}
                              </tr>
                              <tr className="bg-slate-800/50 border-b border-slate-700">
                                <th className="px-3 py-2 border-r border-slate-700/50 text-center font-semibold text-slate-300">교사</th>
                                {classCols[changeActiveGrade].map(col => (
                                  <Fragment key={`teacher-${col}`}>
                                    <th colSpan={2} className="px-3 py-2 border-r border-slate-700/50 text-center text-slate-400">
                                      {timetableData[changeActiveGrade]?.[changeRosterTimeSlot]?.[col]?.teacher || "-"}
                                    </th>
                                  </Fragment>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(() => {
                                const colStudents: Record<string, any[]> = {};
                                classCols[changeActiveGrade].forEach(col => {
                                  colStudents[col] = [];
                                });
                                
                                const allStudents = parsedSampleData[changeActiveGrade] || [];
                                 // 1. Group columns by base subject
                                 const subjectGroups: Record<string, { col: string, num: number, original: string }[]> = {};
                                 classCols[changeActiveGrade].forEach(col => {
                                   const cellSubject = timetableData[changeActiveGrade]?.[changeRosterTimeSlot]?.[col]?.subject?.trim();
                                   if (!cellSubject) return;
                                   
                                   const match = cellSubject.match(/^(.*?)([\d\s]*)$/);
                                   const base = match ? match[1].trim() : cellSubject;
                                   const numMatch = cellSubject.match(/\d+/);
                                   const num = numMatch ? parseInt(numMatch[0], 10) : 1;
                                   
                                   if (!subjectGroups[base]) subjectGroups[base] = [];
                                   subjectGroups[base].push({ col, num, original: cellSubject });
                                 });

                                 // Sort each group by num (so class 1 gets the remainder if odd)
                                 Object.values(subjectGroups).forEach(group => {
                                   group.sort((a, b) => a.num - b.num);
                                 });

                                 // 2. Map students to their base subjects WITH VALIDATED CHANGES
                                 const studentsByBase: Record<string, any[]> = {};
                                 
                                 allStudents.forEach(student => {
                                   const chosenSubject = student.timeSlotMap[changeRosterTimeSlot];
                                   if (!chosenSubject) return;
                                   
                                   // Use adjustmentLog to apply only validated changes
                                   let effectiveSubject = chosenSubject;
                                   let isModified = false;
                                   const studentLogs = adjustmentLog[student.id];
                                   if (studentLogs) {
                                     // Check if any log entry changes this student's subject in this timeslot
                                     for (const entry of studentLogs) {
                                       // Parse the slot from beforeStr like "수학과제탐구(B)"
                                       const beforeMatch = entry.beforeStr.match(/^(.+)\(([^)]+)\)$/);
                                       const afterMatch = entry.afterStr.match(/^(.+)\(([^)]+)\)$/);
                                       if (beforeMatch && afterMatch) {
                                         const logBeforeSubject = beforeMatch[1];
                                         const logBeforeSlot = beforeMatch[2];
                                         const logAfterSubject = afterMatch[1];
                                         const logAfterSlot = afterMatch[2];
                                         
                                         // If this log moves the student OUT of this timeslot's subject
                                         if (logBeforeSlot === changeRosterTimeSlot && logBeforeSubject === chosenSubject) {
                                           // Student leaves this timeslot for this subject (removed)
                                           effectiveSubject = '__REMOVED__';
                                           isModified = true;
                                         }
                                         // If this log moves a subject INTO this timeslot
                                         if (logAfterSlot === changeRosterTimeSlot) {
                                           effectiveSubject = logAfterSubject;
                                           isModified = true;
                                         }
                                       }
                                     }
                                   }
                                   
                                   if (effectiveSubject === '__REMOVED__') return;
                                   
                                   let matchedBase = Object.keys(subjectGroups).find(base => {
                                     const cleanChosen = effectiveSubject.replace(/\s+/g, '');
                                     const cleanBase = base.replace(/\s+/g, '');
                                     if (!cleanBase) return false;
                                     return cleanChosen === cleanBase || cleanChosen.includes(cleanBase) || cleanBase.includes(cleanChosen);
                                   });

                                   if (matchedBase) {
                                     if (!studentsByBase[matchedBase]) studentsByBase[matchedBase] = [];
                                     studentsByBase[matchedBase].push({ ...student, isModified });
                                   }
                                 });

                                 // 3. Distribute students into columns
                                 Object.keys(studentsByBase).forEach(base => {
                                   const students = studentsByBase[base].sort((a, b) => {
                                     return a.id.localeCompare(b.id, undefined, { numeric: true });
                                   });
                                   const cols = subjectGroups[base];
                                   
                                   const baseCount = Math.floor(students.length / cols.length);
                                   const remainder = students.length % cols.length;

                                   let sIdx = 0;
                                   cols.forEach((colObj, idx) => {
                                     const count = baseCount + (idx < remainder ? 1 : 0);
                                     const assigned = students.slice(sIdx, sIdx + count);
                                     colStudents[colObj.col].push(...assigned);
                                     sIdx += count;
                                   });
                                 });
                                let maxStudents = 0;
                                classCols[changeActiveGrade].forEach(col => {
                                  if (colStudents[col].length > maxStudents) maxStudents = colStudents[col].length;
                                });
                                
                                const rows = [];
                                for (let r = 0; r < maxStudents; r++) {
                                  rows.push(
                                    <tr key={r} className="border-b border-slate-800/30 hover:bg-slate-800/20">
                                      <td className="px-3 py-1.5 border-r border-slate-700/50 text-center text-slate-500 bg-slate-900/50">{r + 1}</td>
                                      {classCols[changeActiveGrade].map(col => {
                                        const student = colStudents[col][r];
                                        const isModified = student?.isModified;
                                        const studentChangeLogs = student ? (adjustmentLog[student.id] || []) : [];
                                        const tooltipText = studentChangeLogs.map(l => `${l.beforeStr} → ${l.afterStr}`).join('\n');
                                        return (
                                          <Fragment key={`data-${col}-${r}`}>
                                            <td className={`px-2 py-1.5 border-r border-slate-700/50 text-center border-r-slate-800/30 text-xs ${
                                              isModified ? 'bg-amber-500/10 text-amber-300 font-bold' : 'text-slate-400'
                                            }`}>
                                              {student ? student.id : ""}
                                            </td>
                                            <td
                                              className={`px-2 py-1.5 border-r border-slate-700/50 text-center text-xs ${
                                                isModified ? 'bg-amber-500/10 text-amber-400 font-bold cursor-help' : 'text-slate-300 font-medium'
                                              }`}
                                              title={isModified && tooltipText ? tooltipText : undefined}
                                            >
                                              {student ? student.name : ""}
                                            </td>
                                          </Fragment>
                                        );
                                      })}
                                    </tr>
                                  );
                                }
                                
                                return (
                                  <>
                                    {rows}
                                    <tr className="bg-indigo-900/20 border-t-2 border-indigo-500/30">
                                      <td className="px-3 py-3 border-r border-slate-700/50 text-center font-bold text-indigo-300">총 인원</td>
                                      {classCols[changeActiveGrade].map(col => (
                                        <td key={`total-${col}`} colSpan={2} className="px-3 py-3 border-r border-slate-700/50 text-center font-bold text-indigo-300">
                                          {colStudents[col].length}명
                                        </td>
                                      ))}
                                    </tr>
                                  </>
                                );
                              })()}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}


                  {changeActiveTab === "roster" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex justify-between items-center mb-2">
                        <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                          <Users className="w-6 h-6 text-indigo-400" />
                          타임별 선택과목 명단
                        </h2>
                        
                        <div className="flex bg-slate-800/50 p-1 rounded-xl">
                          <button
                            onClick={() => setChangeActiveGrade("grade2")}
                            className={`px-6 py-2 rounded-lg font-medium transition-all ${
                              changeActiveGrade === "grade2"
                                ? "bg-indigo-500 text-white shadow-md"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            2학년
                          </button>
                          <button
                            onClick={() => setChangeActiveGrade("grade3")}
                            className={`px-6 py-2 rounded-lg font-medium transition-all ${
                              changeActiveGrade === "grade3"
                                ? "bg-indigo-500 text-white shadow-md"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            3학년
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap mb-4">
                        {timeSlots[changeActiveGrade].map(slot => (
                          <button
                            key={slot}
                            onClick={() => setChangeRosterTimeSlot(slot)}
                            className={`px-5 py-2 rounded-lg font-medium transition-all ${
                              changeRosterTimeSlot === slot
                                ? "bg-indigo-600 text-white shadow-md"
                                : "bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                            }`}
                          >
                            {slot}타임
                          </button>
                        ))}
                      </div>

                      <div className="bg-slate-900 rounded-2xl border border-slate-700/50 overflow-hidden shadow-xl">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left border-collapse">
                            <thead>
                              <tr className="bg-amber-400/20 text-amber-200 border-b-2 border-slate-700">
                                <th className="px-3 py-2 border-r border-slate-700/50 text-center font-bold min-w-[80px]">과목명</th>
                                {classCols[changeActiveGrade].map(col => (
                                  <th key={col} colSpan={2} className="px-3 py-2 border-r border-slate-700/50 text-center font-bold min-w-[120px]">
                                    {timetableData[changeActiveGrade]?.[changeRosterTimeSlot]?.[col]?.subject || "-"}
                                  </th>
                                ))}
                              </tr>
                              <tr className="bg-slate-800 border-b border-slate-700">
                                <th className="px-3 py-2 border-r border-slate-700/50 text-center font-semibold text-slate-300">강의실</th>
                                {classCols[changeActiveGrade].map(col => (
                                  <Fragment key={`room-${col}`}>
                                    <th colSpan={2} className="px-3 py-2 border-r border-slate-700/50 text-center font-semibold text-slate-300 bg-slate-800/80">
                                      {col}
                                    </th>
                                  </Fragment>
                                ))}
                              </tr>
                              <tr className="bg-slate-800/50 border-b border-slate-700">
                                <th className="px-3 py-2 border-r border-slate-700/50 text-center font-semibold text-slate-300">교사</th>
                                {classCols[changeActiveGrade].map(col => (
                                  <Fragment key={`teacher-${col}`}>
                                    <th colSpan={2} className="px-3 py-2 border-r border-slate-700/50 text-center text-slate-400">
                                      {timetableData[changeActiveGrade]?.[changeRosterTimeSlot]?.[col]?.teacher || "-"}
                                    </th>
                                  </Fragment>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(() => {
                                const colStudents: Record<string, StudentTimeData[]> = {};
                                classCols[changeActiveGrade].forEach(col => {
                                  colStudents[col] = [];
                                });
                                
                                const allStudents = parsedSampleData[changeActiveGrade] || [];
                                 // 1. Group columns by base subject
                                 const subjectGroups: Record<string, { col: string, num: number, original: string }[]> = {};
                                 classCols[changeActiveGrade].forEach(col => {
                                   const cellSubject = timetableData[changeActiveGrade]?.[changeRosterTimeSlot]?.[col]?.subject?.trim();
                                   if (!cellSubject) return;
                                   
                                   const match = cellSubject.match(/^(.*?)([\d\s]*)$/);
                                   const base = match ? match[1].trim() : cellSubject;
                                   const numMatch = cellSubject.match(/\d+/);
                                   const num = numMatch ? parseInt(numMatch[0], 10) : 1;
                                   
                                   if (!subjectGroups[base]) subjectGroups[base] = [];
                                   subjectGroups[base].push({ col, num, original: cellSubject });
                                 });

                                 // Sort each group by num (so class 1 gets the remainder if odd)
                                 Object.values(subjectGroups).forEach(group => {
                                   group.sort((a, b) => a.num - b.num);
                                 });

                                 // 2. Map students to their base subjects
                                 const studentsByBase: Record<string, StudentTimeData[]> = {};
                                 allStudents.forEach(student => {
                                   const chosenSubject = student.timeSlotMap[changeRosterTimeSlot];
                                   if (!chosenSubject) return;
                                   
                                   let matchedBase = Object.keys(subjectGroups).find(base => {
                                     const cleanChosen = chosenSubject.replace(/\s+/g, '');
                                     const cleanBase = base.replace(/\s+/g, '');
                                     if (!cleanBase) return false;
                                     return cleanChosen === cleanBase || cleanChosen.includes(cleanBase) || cleanBase.includes(cleanChosen);
                                   });

                                   if (matchedBase) {
                                     if (!studentsByBase[matchedBase]) studentsByBase[matchedBase] = [];
                                     studentsByBase[matchedBase].push(student);
                                   }
                                 });

                                 // 3. Distribute students into columns
                                 Object.keys(studentsByBase).forEach(base => {
                                   const students = studentsByBase[base].sort((a, b) => {
                                     return a.id.localeCompare(b.id, undefined, { numeric: true });
                                   });
                                   const cols = subjectGroups[base];
                                   
                                   const baseCount = Math.floor(students.length / cols.length);
                                   const remainder = students.length % cols.length;

                                   let sIdx = 0;
                                   cols.forEach((colObj, idx) => {
                                     const count = baseCount + (idx < remainder ? 1 : 0);
                                     const assigned = students.slice(sIdx, sIdx + count);
                                     colStudents[colObj.col].push(...assigned);
                                     sIdx += count;
                                   });
                                 });
                                let maxStudents = 0;
                                classCols[changeActiveGrade].forEach(col => {
                                  if (colStudents[col].length > maxStudents) maxStudents = colStudents[col].length;
                                });
                                
                                const rows = [];
                                for (let r = 0; r < maxStudents; r++) {
                                  rows.push(
                                    <tr key={r} className="border-b border-slate-800/30 hover:bg-slate-800/20">
                                      <td className="px-3 py-1.5 border-r border-slate-700/50 text-center text-slate-500 bg-slate-900/50">{r + 1}</td>
                                      {classCols[changeActiveGrade].map(col => {
                                        const student = colStudents[col][r];
                                        return (
                                          <Fragment key={`data-${col}-${r}`}>
                                            <td className="px-2 py-1.5 border-r border-slate-700/50 text-center text-slate-400 border-r-slate-800/30 text-xs">
                                              {student ? student.id : ""}
                                            </td>
                                            <td className="px-2 py-1.5 border-r border-slate-700/50 text-center text-slate-300 font-medium text-xs">
                                              {student ? student.name : ""}
                                            </td>
                                          </Fragment>
                                        );
                                      })}
                                    </tr>
                                  );
                                }
                                
                                return (
                                  <>
                                    {rows}
                                    <tr className="bg-indigo-900/20 border-t-2 border-indigo-500/30">
                                      <td className="px-3 py-3 border-r border-slate-700/50 text-center font-bold text-indigo-300">총 인원</td>
                                      {classCols[changeActiveGrade].map(col => (
                                        <td key={`total-${col}`} colSpan={2} className="px-3 py-3 border-r border-slate-700/50 text-center font-bold text-indigo-300">
                                          {colStudents[col].length}명
                                        </td>
                                      ))}
                                    </tr>
                                  </>
                                );
                              })()}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Fragment>
            )}
            
          </div>
        </div>
      </main>
    </div>
  );
}
