"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, FileText, Settings, Download, CheckCircle2, ChevronRight, Trash2, File as FileIcon, Save, FolderOpen, GitBranch, Plus } from "lucide-react";
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
  hierarchyViolations: { subject: string; message: string }[];
  originalRow: any;
  completedBefore?: string[];
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("curriculum");
  const [activeGrade, setActiveGrade] = useState<GradeKey>("grade1");

  const [curriculumText, setCurriculumText] = useState<{ [key in GradeKey]: string }>({ grade1: "", grade2: "" });
  const [subjectMap, setSubjectMap] = useState<{ [key in GradeKey]: SubjectMap }>({ grade1: {}, grade2: {} });
  const [isCurriculumParsed, setIsCurriculumParsed] = useState<{ [key in GradeKey]: boolean }>({ grade1: false, grade2: false });
  const [hierarchyRules, setHierarchyRules] = useState<{ [key in GradeKey]: HierarchyRule[] }>({ grade1: [], grade2: [] });
  
  const [uploadedFiles, setUploadedFiles] = useState<{ [key in GradeKey]: { name: string, size: number, data: string } | null }>({ grade1: null, grade2: null });
  const [processedData, setProcessedData] = useState<{ [key in GradeKey]: ProcessedStudent[] }>({ grade1: [], grade2: [] });
  const [rawSheetData, setRawSheetData] = useState<{ [key in GradeKey]: any[] }>({ grade1: [], grade2: [] });
  const [previousHistoryFiles, setPreviousHistoryFiles] = useState<{ [key in GradeKey]: { name: string, size: number, data: string } | null }>({ grade1: null, grade2: null });
  const [previousSubjectMap, setPreviousSubjectMap] = useState<{ [key in GradeKey]: { [studentId: string]: { name: string, subjects: string[] } } }>({ grade1: {}, grade2: {} });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveBackup = () => {
    const backupData = { 
      curriculumText, 
      subjectMap, 
      isCurriculumParsed, 
      hierarchyRules, 
      uploadedFiles, 
      processedData,
      rawSheetData,
      previousHistoryFiles,
      previousSubjectMap
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
        if (parsed.curriculumText) setCurriculumText(parsed.curriculumText);
        if (parsed.subjectMap) setSubjectMap(parsed.subjectMap);
        if (parsed.isCurriculumParsed) setIsCurriculumParsed(parsed.isCurriculumParsed);
        if (parsed.hierarchyRules) setHierarchyRules(parsed.hierarchyRules);
        if (parsed.uploadedFiles) setUploadedFiles(parsed.uploadedFiles);
        if (parsed.processedData) setProcessedData(parsed.processedData);
        if (parsed.rawSheetData) setRawSheetData(parsed.rawSheetData);
        if (parsed.previousHistoryFiles) setPreviousHistoryFiles(parsed.previousHistoryFiles);
        if (parsed.previousSubjectMap) setPreviousSubjectMap(parsed.previousSubjectMap);
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

  const parseCurriculum = () => {
    const lines = curriculumText[activeGrade].split("\n").filter(Boolean);
    const newMap: SubjectMap = {};

    let currentGroup = "";
    
    for (let line of lines) {
      line = line.replace(/\r/g, "");
      const parts = line.trim().split(/\s+/);
      
      const columns = line.split("\t").map(c => c.trim());
      const checkArea = columns.length > 1 
        ? columns.slice(0, Math.min(3, columns.length)).join(" ") 
        : parts.slice(0, 3).join(" ");
      
      if ((line.includes("국어") && !line.includes("외국어") && !line.includes("중국어")) || line.includes("수학") || line.includes("영어")) {
        currentGroup = "기초";
      } else if (checkArea.includes("사회") || checkArea.includes("역사") || checkArea.includes("도덕") || checkArea.includes("한국사")) {
        currentGroup = "사회";
      } else if (checkArea.includes("과학")) {
        currentGroup = "과학";
      } else if (
        checkArea.includes("체육") || checkArea.includes("예술") || checkArea.includes("정보") || 
        checkArea.includes("교양") || checkArea.includes("제2외국어") || checkArea.includes("외국어") || 
        checkArea.includes("한문") || checkArea.includes("기술") || checkArea.includes("가정") ||
        line.includes("일본어") || line.includes("중국어")
      ) {
        currentGroup = "기타";
      }

      const hasNumber = /\d+/.test(line);
      if (hasNumber && currentGroup && !line.includes("합계") && !line.includes("소계") && !line.includes("총계")) {
        const match = line.match(/^(.*?)\s+\d/);
        if (match) {
          let subjectStr = match[1].trim();
          let subjectName = "";
          
          const typeMatch = subjectStr.match(/(?:공통|일반|진로|융합)\s+(.+)$/);
          if (typeMatch) {
            subjectName = typeMatch[1].trim();
          } else {
            if (/(?:공통|일반|진로|융합)$/.test(subjectStr)) {
               subjectName = ""; 
            } else {
               const words = subjectStr.split(/\s+/);
               subjectName = words.slice(-2).join(" ");
            }
          }

          if (subjectName && subjectName.length > 1) {
             const individualSubjects = subjectName.split("↔").map(s => s.trim());
             individualSubjects.forEach(sub => {
               if (sub && sub.length > 1) {
                 newMap[sub] = currentGroup as SubjectCategory;
               }
             });
          }
        }
      }
    }

    setSubjectMap(prev => ({ ...prev, [activeGrade]: newMap }));
    setIsCurriculumParsed(prev => ({ ...prev, [activeGrade]: true }));
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
    
    // 1. Check target grade's subjectMap first
    const targetSubjectMap = subjectMap[targetGrade] || {};
    const sortedTargetMapEntries = Object.entries(targetSubjectMap).sort((a, b) => b[0].replace(/\s+/g, "").length - a[0].replace(/\s+/g, "").length);
    for (const [mapSubj, mapCat] of sortedTargetMapEntries) {
      const normalizedMapSubj = normalizeSubjectName(mapSubj);
      if (normalizedSubject.includes(normalizedMapSubj)) return mapCat;
    }
    
    // 2. Check other grade's subjectMap as fallback
    const otherGradeKey: GradeKey = targetGrade === "grade2" ? "grade1" : "grade2";
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

          if (k.includes("제2외국어") || k.includes("외국어")) {
            scienceCount++;
          }

          if (matchedCategory === "기초") basicCount++;
          if (matchedCategory === "사회") socialCount++;
          if (matchedCategory === "과학") scienceCount++;
        });
      });

      const allSubjects = [...semester1, ...semester2].filter(Boolean);
      const subjectCounts: Record<string, number> = {};
      allSubjects.forEach(s => {
        subjectCounts[s] = (subjectCounts[s] || 0) + 1;
      });
      const duplicateSubjects = Object.keys(subjectCounts).filter(s => subjectCounts[s] > 1);

      const hierarchyViolations: { subject: string; message: string }[] = [];
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
            hierarchyViolations.push({ subject: rule.advanced, message: `선행 미이수(${rule.prereq})` });
          } else if (prereqSem > advancedSem) {
            // Enrolled in later semester this year
            hierarchyViolations.push({ subject: rule.advanced, message: `선후수 역전(${rule.prereq}가 후순위)` });
          } else if (prereqSem === advancedSem) {
            // Enrolled in same semester this year (simultaneous)
            hierarchyViolations.push({ subject: rule.advanced, message: `선후수 동시선택(${rule.prereq})` });
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

    setProcessedData(prev => ({ ...prev, [activeGrade]: processed }));
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
        if (student.duplicateSubjects?.length) remarks.push(`중복선택: ${student.duplicateSubjects.join(", ")}`);
        if (student.hierarchyViolations?.length) remarks.push(`위계위반: ${student.hierarchyViolations.map(v => v.message).join(", ")}`);
        
        row.push(student.basicCount || 0, student.socialCount || 0, student.scienceCount || 0, remarks.join(" / "));
        
        aoa.push(row);
      });

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // Apply Styles
      const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[cellAddress]) ws[cellAddress] = { t: "s", v: "" }; // Create empty cell if not exists for border styling
          
          ws[cellAddress].s = {
            alignment: { horizontal: "center", vertical: "center" },
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
          }
        }
      }

      // Add Merges for "1학기" and "2학기" headers
      if (!ws["!merges"]) ws["!merges"] = [];
      ws["!merges"].push({ s: { r: 0, c: 3 }, e: { r: 0, c: 3 + maxSem1 - 1 } });
      ws["!merges"].push({ s: { r: 0, c: 3 + maxSem1 }, e: { r: 0, c: 3 + maxSem1 + maxSem2 - 1 } });

      // Add column widths
      const cols = [
        { wch: 5 },  // 순번
        { wch: 10 }, // 학번
        { wch: 10 }, // 이름
      ];
      for (let i = 0; i < maxSem1; i++) cols.push({ wch: 15 });
      for (let i = 0; i < maxSem2; i++) cols.push({ wch: 15 });
      cols.push({ wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 20 });
      ws["!cols"] = cols;

      XLSX.utils.book_append_sheet(wb, ws, cls);
    });

    XLSX.writeFile(wb, `Subject_Selection_${activeGrade === "grade1" ? "1학년" : "2학년"}_Processed.xlsx`);
  };

  const activeData = processedData[activeGrade];
  const maxSem1 = activeData.length > 0 ? Math.max(4, ...activeData.map(d => d.semester1.length)) : 4;
  const maxSem2 = activeData.length > 0 ? Math.max(4, ...activeData.map(d => d.semester2.length)) : 4;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500/30 font-sans pb-20">
      {/* Background Gradients */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-rose-600/20 blur-[120px]" />
      </div>

      <main className="relative z-10 max-w-[95%] 2xl:max-w-[1600px] mx-auto px-6 py-12">
        <header className="mb-12 text-center relative">
          <div className="absolute top-0 right-0 flex gap-2">
            <input 
              type="file" 
              accept=".json" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleLoadBackup} 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 hover:bg-slate-800 text-slate-300 text-sm font-medium rounded-lg transition-colors border border-slate-700/50"
            >
              <FolderOpen className="w-4 h-4" />
              불러오기
            </button>
            <button 
              onClick={handleSaveBackup}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 hover:bg-slate-800 text-slate-300 text-sm font-medium rounded-lg transition-colors border border-slate-700/50"
            >
              <Save className="w-4 h-4" />
              저장하기
            </button>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-rose-400 text-transparent bg-clip-text mb-4">
            수강 신청 데이터 처리기
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            학생 수강 신청 엑셀 파일을 업로드하면, 학급별 시트 분리 및 기초/사회/과학 과목 통계가 계산된 엑셀 파일로 변환해 드립니다.
          </p>
        </header>

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
                선택하신 학년의 교육과정 편성표를 복사하여 붙여넣어 주세요. 과목을 자동으로 추출하여 매핑합니다.
              </p>
              
              <textarea
                className="w-full h-64 bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-sm font-mono text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-none placeholder:text-slate-600"
                placeholder={`${activeGrade === "grade1" ? "1학년" : "2학년"} 교육과정 편성표 텍스트를 붙여넣으세요...`}
                value={curriculumText[activeGrade]}
                onChange={(e) => setCurriculumText(prev => ({ ...prev, [activeGrade]: e.target.value }))}
              ></textarea>
              
              <div className="flex justify-end">
                <button 
                  onClick={parseCurriculum}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-indigo-500/25 flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  {activeGrade === "grade1" ? "1학년" : "2학년"} 교육과정 분석 및 추출
                </button>
              </div>

              {isCurriculumParsed[activeGrade] && Object.keys(subjectMap[activeGrade]).length > 0 && (
                <div className="mt-8 p-6 bg-slate-950/50 border border-slate-800 rounded-2xl animate-in fade-in">
                  <h3 className="text-xl font-medium text-slate-200 mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    추출된 과목 자동 매핑 결과 ({activeGrade === "grade1" ? "1학년" : "2학년"})
                  </h3>
                  <p className="text-sm text-slate-400 mb-6">
                    매핑이 정확한지 확인하시고, 필요한 경우 직접 수정해 주세요. '기초, 사회, 과학'으로 매핑된 과목들만 이수 통계에 반영됩니다.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(subjectMap[activeGrade]).map(([subject, category]) => (
                      <div key={subject} className="flex items-center justify-between p-3 bg-slate-900 border border-slate-700/50 rounded-lg">
                        <span className="font-medium text-slate-300 truncate mr-2" title={subject}>{subject}</span>
                        <select 
                          value={category}
                          onChange={(e) => handleCategoryChange(subject, e.target.value as SubjectCategory)}
                          className="bg-slate-950 border border-slate-700 text-sm rounded-md px-2 py-1 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="기초">기초</option>
                          <option value="사회">사회</option>
                          <option value="과학">과학</option>
                          <option value="기타">기타</option>
                        </select>
                      </div>
                    ))}
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
                               const isHierarchyViolation = subject && row.hierarchyViolations?.some(v => v.subject === subject);
                               let cellClass = "px-2 py-2.5 whitespace-nowrap ";
                               if (isHierarchyViolation) cellClass += "text-amber-400 font-bold bg-amber-500/10 rounded-md";
                               else if (isDuplicate) cellClass += "text-rose-400 font-bold bg-rose-500/10 rounded-md";

                               return (
                                 <td key={`s1-${i}`} className={cellClass}>
                                   {subject}
                                 </td>
                               );
                            })}
                            {Array.from({length: maxSem2}).map((_, i) => {
                               const subject = row.semester2[i] || "";
                               const isDuplicate = subject && row.duplicateSubjects?.includes(subject);
                               const isHierarchyViolation = subject && row.hierarchyViolations?.some(v => v.subject === subject);
                               let cellClass = "px-2 py-2.5 whitespace-nowrap ";
                               if (isHierarchyViolation) cellClass += "text-amber-400 font-bold bg-amber-500/10 rounded-md";
                               else if (isDuplicate) cellClass += "text-rose-400 font-bold bg-rose-500/10 rounded-md";

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
                              {row.duplicateSubjects?.length > 0 && <span className="text-rose-400 whitespace-nowrap">중복: {row.duplicateSubjects.join(", ")}</span>}
                              {row.hierarchyViolations?.length > 0 && (
                                <span className="text-amber-400 text-xs whitespace-nowrap">
                                  {row.hierarchyViolations.map(v => `위반: ${v.subject}(${v.message})`).join(", ")}
                                </span>
                              )}
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
        </div>
      </main>
    </div>
  );
}
