"use client";

import React, { useState, useEffect, useRef, Fragment, useMemo, useCallback } from "react";
import { Upload, FileText, Settings, Download, CheckCircle2, ChevronRight, Trash2, File as FileIcon, Save, FolderOpen, GitBranch, Plus, Users, RotateCcw, Menu } from "lucide-react";
import * as XLSX from "xlsx-js-style";

type SubjectCategory = "기초" | "사회" | "과학" | "기타";
type GradeKey = "pre1" | "grade1" | "grade2";

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
  isSplit?: boolean;
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
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [activeGrade, setActiveGrade] = useState<GradeKey>("pre1");
  const [isExampleModalOpen, setIsExampleModalOpen] = useState(false);

  const [changeActiveTab, setChangeActiveTab] = useState<"basic" | "upload" | "timetable" | "roster" | "application" | "roster_after" | "analysis" | "riroschool">("basic");
  const [changeActiveGrade, setChangeActiveGrade] = useState<"grade2" | "grade3">("grade2");
  const [sampleRawData, setSampleRawData] = useState<{ grade2: string | null, grade3: string | null }>({ grade2: null, grade3: null });
  const [showOnlyApplicants, setShowOnlyApplicants] = useState(false);
  const [changeRosterTimeSlot, setChangeRosterTimeSlot] = useState("A");
  const [rosterAfterSubjectFilter, setRosterAfterSubjectFilter] = useState<string>("전체");
  const [rosterSubjectFilter, setRosterSubjectFilter] = useState<string>("전체");

  const [changeTimeSlots, setChangeTimeSlots] = useState<{ grade2: string[], grade3: string[] }>({ grade2: [], grade3: [] });
  const [changeClassCols, setChangeClassCols] = useState<{ grade2: string[], grade3: string[] }>({ grade2: [], grade3: [] });
  const [changeTimetableData, setChangeTimetableData] = useState<any>({ grade2: {}, grade3: {} });
  const [changeParsedSampleData, setChangeParsedSampleData] = useState<any>({ grade2: [], grade3: [] });

  const initialTimeSlots = ["A", "B", "C", "D", "E", "F", "G"];
  const initialColsG2 = Array.from({ length: 9 }, (_, i) => `2-${i + 1}`);
  const initialColsG3 = Array.from({ length: 9 }, (_, i) => `3-${i + 1}`);

  const [timeSlots, setTimeSlots] = useState<{ grade2: string[], grade3: string[] }>({
    grade2: [...initialTimeSlots], grade3: [...initialTimeSlots]
  });
  const [classCols, setClassCols] = useState<{ grade2: string[], grade3: string[] }>({
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

  const [grade2HistoryData, setGrade2HistoryData] = useState<Record<string, Record<string, string[]>>>({ grade2: {}, grade3: {} });
  const [grade3Sem1HistoryData, setGrade3Sem1HistoryData] = useState<Record<string, Record<string, string[]>>>({ grade2: {}, grade3: {} });
  const [extraUploads, setExtraUploads] = useState<Record<string, { grade2Optional: boolean; grade3Sem1: boolean }>>({ grade2: { grade2Optional: false, grade3Sem1: false }, grade3: { grade2Optional: false, grade3Sem1: false } });
  const [changeUploadNames, setChangeUploadNames] = useState<Record<string, { timetable: string | null; grade2Optional: string | null; grade3Sem1: string | null }>>({
    grade2: { timetable: null, grade2Optional: null, grade3Sem1: null },
    grade3: { timetable: null, grade2Optional: null, grade3Sem1: null }
  });

  const handleDeleteSampleUpload = () => {
    if (confirm("업로드된 파일을 삭제하시겠습니까?")) {
      setParsedSampleData(prev => ({ ...prev, [changeActiveGrade]: [] }));
      setChangeUploadNames(prev => ({ ...prev, [changeActiveGrade]: { ...prev[changeActiveGrade], timetable: null } }));
    }
  };

  const handleDeleteExtraUpload = (key: 'grade2Optional' | 'grade3Sem1') => {
    if (confirm("업로드된 파일을 삭제하시겠습니까?")) {
      if (key === 'grade2Optional') {
        setGrade2HistoryData(prev => ({ ...prev, [changeActiveGrade]: {} }));
      } else {
        setGrade3Sem1HistoryData(prev => ({ ...prev, [changeActiveGrade]: {} }));
      }
      setExtraUploads(prev => ({ ...prev, [changeActiveGrade]: { ...prev[changeActiveGrade], [key]: false } }));
      setChangeUploadNames(prev => ({ ...prev, [changeActiveGrade]: { ...prev[changeActiveGrade], [key]: null } }));
    }
  };

  const handleExtraUpload = (key: 'grade2Optional' | 'grade3Sem1') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

      const parsedData: Record<string, string[]> = {};

      if (key === 'grade2Optional') {
        if (json.length >= 2) {
          const headers = json[1];
          for (let i = 2; i < json.length; i++) {
            const row = json[i];
            if (!row || row.length === 0 || !row[1] || String(row[1]) === '합계') continue;
            const studentId = String(row[1]).trim();
            const subjects: string[] = [];
            for (let c = 7; c < headers.length; c++) {
              if (row[c] && headers[c]) {
                const subj = String(headers[c]).trim();
                if (subj) subjects.push(subj);
              }
            }
            parsedData[studentId] = subjects;
          }
          setGrade2HistoryData(prev => ({ ...prev, [changeActiveGrade]: parsedData }));
        }
      } else if (key === 'grade3Sem1') {
        if (json.length >= 2) {
          const superHeaders = json[0];
          const headers = json[1];
          let lastSuperHeader = "";

          for (let i = 2; i < json.length; i++) {
            const row = json[i];
            if (!row || row.length === 0 || !row[1] || String(row[1]) === '합계') continue;
            const studentId = String(row[1]).trim();
            const subjects: string[] = [];

            let currentSuper = "";
            for (let c = 7; c < headers.length; c++) {
              const sHeader = String(superHeaders[c] || "").trim();
              if (sHeader) currentSuper = sHeader;

              if (currentSuper.includes('1학기') || currentSuper.includes('1,2학기')) {
                if (row[c] && headers[c]) {
                  const subj = String(headers[c]).trim();
                  if (subj) subjects.push(subj);
                }
              }
            }
            parsedData[studentId] = subjects;
          }
          setGrade3Sem1HistoryData(prev => ({ ...prev, [changeActiveGrade]: parsedData }));
        }
      }

      setExtraUploads(prev => ({ ...prev, [changeActiveGrade]: { ...prev[changeActiveGrade], [key]: true } }));
      setChangeUploadNames(prev => ({ ...prev, [changeActiveGrade]: { ...prev[changeActiveGrade], [key]: file.name } }));
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const [electiveChanges, setElectiveChanges] = useState<Record<string, any[]>>({ grade2: [], grade3: [] });
  const [electiveChangesArbitrary, setElectiveChangesArbitrary] = useState<Record<string, any[]>>({ grade2: [], grade3: [] });
  const [enableOptimization, setEnableOptimization] = useState(false);
  const handleTimetablePaste = (e: React.ClipboardEvent, startRowIndex: number, startColIndex: number, field: "subject" | "teacher") => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("Text");
    if (!pastedText) return;

    const rows = pastedText.split(/\r\n|\n|\r/).filter(row => row.trim() !== "");
    const newData = { ...timetableData[changeActiveGrade] };

    const currentCols = classCols[changeActiveGrade];
    const currentRows = timeSlots[changeActiveGrade];
    const remainingSlots = currentRows.length - startRowIndex;

    // Auto-detect interleaved format: if pasting on "subject" field
    // and the number of rows is roughly 2x the remaining time slots,
    // treat odd rows as subjects and even rows as teachers.
    if (field === "subject" && rows.length > remainingSlots && rows.length >= remainingSlots * 2) {
      for (let pairIdx = 0; pairIdx < remainingSlots; pairIdx++) {
        const subjectRow = rows[pairIdx * 2];
        const teacherRow = rows[pairIdx * 2 + 1];
        const targetRow = currentRows[startRowIndex + pairIdx];
        if (!targetRow) continue;
        if (!newData[targetRow]) newData[targetRow] = {};

        if (subjectRow) {
          const subjectCells = subjectRow.split('\t');
          subjectCells.forEach((cell, cIdx) => {
            const targetCol = currentCols[startColIndex + cIdx];
            if (targetCol) {
              const existingCell = newData[targetRow][targetCol] || { subject: "", teacher: "" };
              newData[targetRow][targetCol] = { ...existingCell, subject: cell.trim() };
            }
          });
        }

        if (teacherRow) {
          const teacherCells = teacherRow.split('\t');
          teacherCells.forEach((cell, cIdx) => {
            const targetCol = currentCols[startColIndex + cIdx];
            if (targetCol) {
              const existingCell = newData[targetRow][targetCol] || { subject: "", teacher: "" };
              newData[targetRow][targetCol] = { ...existingCell, teacher: cell.trim() };
            }
          });
        }
      }
    } else {
      // Original single-field paste logic
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
    }

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

  const [parsedCurriculumList, setParsedCurriculumList] = useState<{ [key in GradeKey]: ParsedCurriculumSubject[] }>({ pre1: [], grade1: [], grade2: [] });
  const [subjectMap, setSubjectMap] = useState<{ [key in GradeKey]: SubjectMap }>({ pre1: {}, grade1: {}, grade2: {} });
  const [isCurriculumParsed, setIsCurriculumParsed] = useState<{ [key in GradeKey]: boolean }>({ pre1: false, grade1: false, grade2: false });
  const [hierarchyRules, setHierarchyRules] = useState<{ [key in GradeKey]: HierarchyRule[] }>({ pre1: [], grade1: [], grade2: [] });

  const [changeParsedCurriculumList, setChangeParsedCurriculumList] = useState<Record<string, ParsedCurriculumSubject[]>>({});
  const [changeSubjectMap, setChangeSubjectMap] = useState<Record<string, SubjectMap>>({});
  const [changeIsCurriculumParsed, setChangeIsCurriculumParsed] = useState<Record<string, boolean>>({});
  const [changeHierarchyRules, setChangeHierarchyRules] = useState<Record<string, HierarchyRule[]>>({});

  const handleChangeSampleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result as string;
      setSampleRawData(prev => ({ ...prev, [changeActiveGrade]: bstr }));
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

        const id = String(row[1]).trim();
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
      setChangeUploadNames(prev => ({ ...prev, [changeActiveGrade]: { ...prev[changeActiveGrade], timetable: file.name } }));

      alert(`${changeActiveGrade === "grade2" ? "2학년" : "3학년"} 학생 데이터 ${students.length}명 파싱 완료!`);
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const [uploadedFiles, setUploadedFiles] = useState<{ [key in GradeKey]: { name: string, size: number, data: string } | null }>({ pre1: null, grade1: null, grade2: null });
  const [processedData, setProcessedData] = useState<{ [key in GradeKey]: ProcessedStudent[] }>({ pre1: [], grade1: [], grade2: [] });
  const [rawSheetData, setRawSheetData] = useState<{ [key in GradeKey]: any[] }>({ pre1: [], grade1: [], grade2: [] });
  const [previousHistoryFiles, setPreviousHistoryFiles] = useState<{ [key in GradeKey]: { name: string, size: number, data: string } | null }>({ pre1: null, grade1: null, grade2: null });
  const [previousSubjectMap, setPreviousSubjectMap] = useState<{ [key in GradeKey]: { [studentId: string]: { name: string, subjects: string[] } } }>({ pre1: {}, grade1: {}, grade2: {} });

  const [subjectStats, setSubjectStats] = useState<{ [key in GradeKey]: SubjectStat[] }>({ pre1: [], grade1: [], grade2: [] });
  const [standardClassSize, setStandardClassSize] = useState<{ [key in GradeKey]: number }>({ pre1: 25, grade1: 25, grade2: 25 });
  const [designatedSubjects, setDesignatedSubjects] = useState<{ [key in GradeKey]: DesignatedSubject[] }>({ pre1: [], grade1: [], grade2: [] });
  const [selectedSubjectHours, setSelectedSubjectHours] = useState<{ [key in GradeKey]: SelectedSubjectHours[] }>({ pre1: [], grade1: [], grade2: [] });
  const [totalClasses, setTotalClasses] = useState<{ [key in GradeKey]: number }>({ pre1: 10, grade1: 10, grade2: 10 });
  const [manualClassCounts, setManualClassCounts] = useState<{ [subjectKey: string]: number }>({});
  const [editingClasses, setEditingClasses] = useState<{ [subjectKey: string]: boolean }>({});
  const [teacherCounts, setTeacherCounts] = useState<{ [category: string]: number }>({});
  const [headTeacherReductions, setHeadTeacherReductions] = useState<{ [category: string]: number }>({});
  const [headTeacherCategoryInput, setHeadTeacherCategoryInput] = useState<string>("");
  const [editingTeachers, setEditingTeachers] = useState<{ [category: string]: boolean }>({});
  const [editingDetailedCategory, setEditingDetailedCategory] = useState<{ grade: GradeKey, index: number } | null>(null);
  const [detailedCategoryEditValue, setDetailedCategoryEditValue] = useState("");
  const [manualStep5Classes, setManualStep5Classes] = useState<{ [key: string]: string }>({});
  const [editingStep5Classes, setEditingStep5Classes] = useState<{ [key: string]: boolean }>({});


  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveBackup = async () => {
    const backupData = {
      parsedCurriculumList,
      subjectMap,
      isCurriculumParsed,
      hierarchyRules,
      changeParsedCurriculumList,
      changeSubjectMap,
      changeIsCurriculumParsed,
      changeHierarchyRules,
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
      parsedSampleData,
      timetableData,
      electiveChanges,
      timeSlots,
      classCols,
      grade2HistoryData,
      grade3Sem1HistoryData,
      extraUploads,
      changeUploadNames,
      headTeacherReductions,
      sampleRawData
    };
    
    const jsonString = JSON.stringify(backupData, null, 2);
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
        if (parsed.parsedCurriculumList) setParsedCurriculumList({ pre1: [], ...parsed.parsedCurriculumList });
        if (parsed.subjectMap) setSubjectMap({ pre1: {}, ...parsed.subjectMap });
        if (parsed.isCurriculumParsed) setIsCurriculumParsed({ pre1: false, ...parsed.isCurriculumParsed });
        if (parsed.hierarchyRules) setHierarchyRules({ pre1: [], ...parsed.hierarchyRules });
        if (parsed.changeParsedCurriculumList) setChangeParsedCurriculumList(parsed.changeParsedCurriculumList);
        if (parsed.changeSubjectMap) setChangeSubjectMap(parsed.changeSubjectMap);
        if (parsed.changeIsCurriculumParsed) setChangeIsCurriculumParsed(parsed.changeIsCurriculumParsed);
        if (parsed.changeHierarchyRules) setChangeHierarchyRules(parsed.changeHierarchyRules);
        if (parsed.uploadedFiles) setUploadedFiles({ pre1: null, ...parsed.uploadedFiles });
        if (parsed.processedData) setProcessedData({ pre1: [], ...parsed.processedData });
        if (parsed.rawSheetData) setRawSheetData({ pre1: [], ...parsed.rawSheetData });
        if (parsed.previousHistoryFiles) setPreviousHistoryFiles({ pre1: null, ...parsed.previousHistoryFiles });
        if (parsed.previousSubjectMap) setPreviousSubjectMap({ pre1: {}, ...parsed.previousSubjectMap });
        if (parsed.subjectStats) setSubjectStats({ pre1: [], ...parsed.subjectStats });
        if (parsed.standardClassSize) setStandardClassSize({ pre1: 25, ...parsed.standardClassSize });
        if (parsed.totalClasses) setTotalClasses({ pre1: 10, grade1: 10, grade2: 10, ...parsed.totalClasses });
        if (parsed.manualClassCounts) setManualClassCounts(parsed.manualClassCounts);
        if (parsed.manualStep5Classes) setManualStep5Classes(parsed.manualStep5Classes);
        if (parsed.teacherCounts) setTeacherCounts(parsed.teacherCounts);
        if (parsed.headTeacherReductions) setHeadTeacherReductions(parsed.headTeacherReductions);
        if (parsed.designatedSubjects) setDesignatedSubjects({ pre1: [], ...parsed.designatedSubjects });
        if (parsed.selectedSubjectHours) setSelectedSubjectHours({ pre1: [], ...parsed.selectedSubjectHours });
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
                const sem1Val = activeGrade === "pre1" ? sem1_1 : activeGrade === "grade1" ? sem2_1 : activeGrade === "grade2" ? sem3_1 : 0;
                const sem2Val = activeGrade === "pre1" ? sem1_2 : activeGrade === "grade1" ? sem2_2 : activeGrade === "grade2" ? sem3_2 : 0;
                
                const existing = newParsed.find(p => p.subject === sub);
                if (existing) {
                  existing.credits = Math.max(existing.credits, actualCredits);
                  existing.sem1 = Math.max(existing.sem1, sem1Val);
                  existing.sem2 = Math.max(existing.sem2, sem2Val);
                  
                  const semsSet = new Set(existing.semesters.split(', ').concat(sems).filter(s => s && s !== "미지정 (엑셀 빈칸)"));
                  existing.semesters = semsSet.size > 0 ? Array.from(semsSet).join(", ") : "미지정 (엑셀 빈칸)";
                } else {
                  newParsed.push({
                    type,
                    subject: sub,
                    category,
                    credits: actualCredits,
                    sem1: sem1Val,
                    sem2: sem2Val,
                    semesters: sems.length > 0 ? sems.join(", ") : "미지정 (엑셀 빈칸)"
                  });
                }

                // Populate backward compatibility states for the chosen grade
                let sem1ForGrade = 0, sem2ForGrade = 0;
                if (activeGrade === "pre1") {
                  sem1ForGrade = sem1_1; sem2ForGrade = sem1_2;
                } else if (activeGrade === "grade1") {
                  sem1ForGrade = sem2_1; sem2ForGrade = sem2_2;
                } else {
                  sem1ForGrade = sem3_1; sem2ForGrade = sem3_2;
                }

                // Determine broad category
                let broadCat: SubjectCategory = "기타";
                if (["국어", "수학", "영어"].includes(category)) broadCat = "기초";
                else if (["사회", "역사", "도덕", "사회(역사/도덕포함)"].includes(category)) broadCat = "사회";
                else if (["과학"].includes(category)) broadCat = "과학";

                if (type === "지정") {
                  if (sem1ForGrade > 0 || sem2ForGrade > 0) {
                    newDesignated.push({ subject: sub, category: broadCat, detailedCategory: category, isSplit: individualSubjects.length > 1, sem1: sem1ForGrade, sem2: sem2ForGrade });
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

  const handleDetailedCategoryUpdate = (grade: GradeKey, index: number, subjectName: string, newDetailedCategory: string) => {
    if (!newDetailedCategory.trim()) {
      setEditingDetailedCategory(null);
      return;
    }

    setParsedCurriculumList(prev => {
      const next = { ...prev };
      next[grade] = [...next[grade]];
      next[grade][index] = { ...next[grade][index], category: newDetailedCategory };
      return next;
    });

    setDesignatedSubjects(prev => {
      const next = { ...prev };
      next[grade] = next[grade].map(s => s.subject === subjectName ? { ...s, detailedCategory: newDetailedCategory } : s);
      return next;
    });

    setSelectedSubjectHours(prev => {
      const next = { ...prev };
      next[grade] = next[grade].map(s => s.subject === subjectName ? { ...s, detailedCategory: newDetailedCategory } : s);
      return next;
    });

    setEditingDetailedCategory(null);
  };

  const handleChangeCurriculumUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

      if (typeIdx === -1) typeIdx = 0;
      if (catIdx === -1) catIdx = 1;
      if (subjIdx === -1) subjIdx = 3;
      if (credIdx === -1) credIdx = 5;

      if (grade1Idx === -1) grade1Idx = 6;
      if (grade2Idx === -1) grade2Idx = 8;
      if (grade3Idx === -1) grade3Idx = 10;

      const newParsed: ParsedCurriculumSubject[] = [];
      const newMap: SubjectMap = {};

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
                const sem1Val = changeActiveGrade === "grade2" ? sem2_1 : changeActiveGrade === "grade3" ? sem3_1 : 0;
                const sem2Val = changeActiveGrade === "grade2" ? sem2_2 : changeActiveGrade === "grade3" ? sem3_2 : 0;
                
                const existing = newParsed.find(p => p.subject === sub);
                if (existing) {
                  existing.credits = Math.max(existing.credits, actualCredits);
                  existing.sem1 = Math.max(existing.sem1, sem1Val);
                  existing.sem2 = Math.max(existing.sem2, sem2Val);
                  
                  const semsSet = new Set(existing.semesters.split(', ').concat(sems).filter(s => s && s !== "미지정 (엑셀 빈칸)"));
                  existing.semesters = semsSet.size > 0 ? Array.from(semsSet).join(", ") : "미지정 (엑셀 빈칸)";
                } else {
                  newParsed.push({
                    type,
                    subject: sub,
                    category,
                    credits: actualCredits,
                    sem1: sem1Val,
                    sem2: sem2Val,
                    semesters: sems.length > 0 ? sems.join(", ") : "미지정 (엑셀 빈칸)"
                  });
                }

                let broadCat: SubjectCategory = "기타";
                if (["국어", "수학", "영어"].includes(category)) broadCat = "기초";
                else if (["사회", "역사", "도덕", "사회(역사/도덕포함)"].includes(category)) broadCat = "사회";
                else if (["과학"].includes(category)) broadCat = "과학";

                if (type !== "지정") {
                  newMap[sub] = broadCat;
                }
              }
            });
          }
        }
      }

      setChangeParsedCurriculumList(prev => ({ ...prev, [changeActiveGrade]: newParsed }));
      setChangeSubjectMap(prev => ({ ...prev, [changeActiveGrade]: newMap }));
      setChangeIsCurriculumParsed(prev => ({ ...prev, [changeActiveGrade]: true }));
      alert("교육과정 엑셀 파일이 성공적으로 업로드되었습니다!");
    };
    reader.readAsBinaryString(file);
  };

  const handleChangeCategoryChange = (subject: string, category: SubjectCategory) => {
    setChangeSubjectMap(prev => ({
      ...prev,
      [changeActiveGrade]: { ...prev[changeActiveGrade], [subject]: category }
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

  const getChangeSubjectCategory = useCallback((subjName: string, targetGrade: GradeKey): SubjectCategory => {
    const normalizedSubject = normalizeSubjectName(subjName);

    for (const grade of Object.keys(changeParsedCurriculumList)) {
      const list = changeParsedCurriculumList[grade as GradeKey] || [];
      for (const subj of list) {
        if (normalizeSubjectName(subj.subject) === normalizedSubject) {
          if (["국어", "수학", "영어"].includes(subj.category)) return "기초";
          if (subj.category.includes("사회") || subj.category.includes("역사") || subj.category.includes("도덕")) return "사회";
          if (subj.category.includes("과학")) return "과학";
          return "기타";
        }
      }
    }

    for (const grade of Object.keys(changeSubjectMap)) {
      const targetSubjectMap = changeSubjectMap[grade as GradeKey] || {};
      const sortedTargetMapEntries = Object.entries(targetSubjectMap).sort((a, b) => b[0].replace(/\s+/g, "").length - a[0].replace(/\s+/g, "").length);
      for (const [mapSubj, mapCat] of sortedTargetMapEntries) {
        const normalizedMapSubj = normalizeSubjectName(mapSubj);
        if (normalizedSubject.includes(normalizedMapSubj)) return mapCat;
      }
    }

    return "기타";
  }, [changeParsedCurriculumList, changeSubjectMap]);

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
  }, [activeGrade, rawSheetData, subjectMap, hierarchyRules, previousSubjectMap, parsedCurriculumList]);

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

    const titleText = `2026학년도 ${activeGrade === "pre1" ? "1학년" : activeGrade === "grade1" ? "2학년" : "3학년"} 선택과목 수요조사 결과`;

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
    let stagnationCounter = 0;
    
    let currentSizes = computeSizes(vSchedules);
    const idealSizes = getSubjectStats(currentSizes);

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
              
              swapMade = true;
              break; 
           }
       }

       if (!swapMade) {
           break; // Local minimum or fully balanced
       }
       iterations++;
    }

    // Compute net generated changes by comparing to original
    const generated: any[] = [];
    for (const s of students) {
        if (lockedStudents.has(String(s.id))) continue;
        const original = s.timeSlotMap;
        const optimized = vSchedules[s.id];
        
        for (const slot of Object.keys(original)) {
            if (original[slot] !== optimized[slot]) {
                let targetSlot = null;
                for (const ts of Object.keys(optimized)) {
                    if (optimized[ts] === original[slot]) {
                        targetSlot = ts;
                        break;
                    }
                }
                
                generated.push({
                    id: Date.now() + Math.random().toString(),
                    studentId: s.id,
                    studentName: s.name || "",
                    beforeSubject: original[slot],
                    afterSubject: original[slot],
                    _targetSlot: targetSlot
                });
            }
        }
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

  return (
    <div className="flex min-h-screen bg-slate-950 text-white selection:bg-indigo-500/30 font-sans">
      {/* Background Gradients */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-rose-600/20 blur-[120px]" />
      </div>

      {/* Sidebar (Collapsible Bookmark Style) */}
      <aside 
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        className={`fixed top-12 left-0 h-[calc(100vh-3rem)] z-[999] transition-all duration-300 ease-in-out flex flex-col gap-2 pointer-events-none overflow-hidden ${isSidebarHovered ? 'w-64' : 'w-16'}`}
      >
        <div className="p-4 pb-6 flex items-center h-[88px] w-64 bg-slate-900/95 backdrop-blur-xl border-t border-r border-b border-slate-800/80 rounded-tr-2xl shadow-[4px_0_15px_rgba(0,0,0,0.3)] pointer-events-auto transition-colors">
          <div className="w-8 h-8 flex flex-shrink-0 justify-center items-center text-indigo-400 transition-colors relative">
            <Menu className={`w-6 h-6 transition-opacity absolute pointer-events-none ${isSidebarHovered ? 'opacity-0' : 'opacity-100'}`} />
            <Settings className={`w-6 h-6 transition-opacity absolute pointer-events-none ${isSidebarHovered ? 'opacity-100' : 'opacity-0'}`} />
          </div>
          <h2 className={`text-xl font-extrabold text-white whitespace-nowrap transition-opacity duration-300 ml-2 ${isSidebarHovered ? 'opacity-100' : 'opacity-0'}`}>
            교육과정부
          </h2>
        </div>

        <div className="flex flex-col gap-4 mt-2 w-64 pointer-events-none">
          <button
            onClick={() => setActiveSidebarTab("survey")}
            className={`flex items-center gap-3 px-2 py-4 font-semibold transition-all duration-300 w-full cursor-pointer bg-slate-900/95 backdrop-blur-xl border-t border-r border-b rounded-r-2xl shadow-[4px_0_15px_rgba(0,0,0,0.3)] pointer-events-auto ${activeSidebarTab === "survey"
                ? "border-indigo-500/50 text-white shadow-[4px_0_20px_rgba(99,102,241,0.2)] bg-indigo-500/5"
                : "border-slate-800/80 text-white hover:text-white hover:bg-slate-800/40"
              }`}
          >
            <div className="w-6 h-6 flex flex-shrink-0 justify-center items-center ml-1">
              <FileText className="w-5 h-5 pointer-events-none" />
            </div>
            <span className={`whitespace-nowrap transition-opacity duration-300 ml-4 ${isSidebarHovered ? 'opacity-100' : 'opacity-0'}`}>수요조사</span>
          </button>
          <button
            onClick={() => setActiveSidebarTab("change")}
            className={`flex items-center gap-3 px-2 py-4 font-semibold transition-all duration-300 w-full cursor-pointer bg-slate-900/95 backdrop-blur-xl border-t border-r border-b rounded-r-2xl shadow-[4px_0_15px_rgba(0,0,0,0.3)] pointer-events-auto ${activeSidebarTab === "change"
                ? "border-indigo-500/50 text-white shadow-[4px_0_20px_rgba(99,102,241,0.2)] bg-indigo-500/5"
                : "border-slate-800/80 text-white hover:text-white hover:bg-slate-800/40"
              }`}
          >
            <div className="w-6 h-6 flex flex-shrink-0 justify-center items-center ml-1">
              <GitBranch className="w-5 h-5 pointer-events-none" />
            </div>
            <span className={`whitespace-nowrap transition-opacity duration-300 ml-4 ${isSidebarHovered ? 'opacity-100' : 'opacity-0'}`}>선택과목 변경</span>
          </button>
        </div>
      </aside>

      <main className="relative z-10 flex-1 flex flex-col max-h-screen overflow-hidden ml-16">
        {/* Global Header */}
        <header className="flex-none px-10 py-5 border-b border-slate-800/30 bg-slate-950/40 backdrop-blur-sm flex flex-col gap-4">
          <div className="flex items-center justify-between w-full">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              {activeSidebarTab === "survey" ? "명신고등학교 수요조사 데이터 정리" : "명신고등학교 선택과목 변경 시스템"}
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
            {activeSidebarTab === "survey" ? (
              <div className="flex gap-2 p-1 bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-800/50 w-fit overflow-x-auto max-w-[calc(100vw-120px)] scrollbar-hide">
                  <button onClick={() => setActiveTab('curriculum')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${activeTab === 'curriculum' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">1단계</span><div className="flex items-center gap-1.5"><Settings className="w-4 h-4" /><span>교육과정 편성표 입력</span></div></button>
                  <button onClick={() => setActiveTab('hierarchy')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${activeTab === 'hierarchy' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">2단계</span><div className="flex items-center gap-1.5"><GitBranch className="w-4 h-4" /><span>과목 위계 설정</span></div></button>
                  <button onClick={() => setActiveTab('upload')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${activeTab === 'upload' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">3단계</span><div className="flex items-center gap-1.5"><Upload className="w-4 h-4" /><span>데이터 업로드</span></div></button>
                  <button onClick={() => setActiveTab('preview')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${activeTab === 'preview' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">4단계</span><div className="flex items-center gap-1.5"><FileText className="w-4 h-4" /><span>수요조사 결과</span></div></button>
                  <button onClick={() => setActiveTab('classOpening')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${activeTab === 'classOpening' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">5단계</span><div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /><span>과목 개설 여부</span></div></button>
                  <button onClick={() => setActiveTab('categorySummary')} className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl font-medium transition-all duration-300 ${activeTab === 'categorySummary' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`}><span className="text-[10px] tracking-wider font-semibold opacity-50">6단계</span><div className="flex items-center gap-1.5"><FileText className="w-4 h-4" /><span>교과(군)별 시수 정리</span></div></button>
                </div>
            ) : (
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
            )}
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 pb-24">
          <div className="w-full mx-auto">

            {activeSidebarTab === "survey" && (
              <Fragment>
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
                                    <label className="block text-xs text-slate-300 mb-1">후행 과목 (나중에 듣는 과목)</label>
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
                          당해년도 수요조사 설문 파일과 이전 학년의 이수 이력 데이터(선택)를 업로드해 주세요.
                        </p>
                      </div>

                      {renderGradeTabs()}

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* 1. 당해년도 수강신청 파일 업로드 */}
                        <div className="space-y-3">
                          <h3 className="text-lg font-medium text-slate-200 flex items-center gap-2">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500/20 text-white text-xs font-bold">1</span>
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
                          4단계: 수요조사 결과 및 다운로드
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
                                    {Array.from({ length: maxSem2 }).map((_, i) => {
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
              </Fragment>
            )}

            {activeSidebarTab === "change" && (
              <Fragment>
                <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/60 rounded-3xl p-8 shadow-2xl">
                                    {changeActiveTab === "basic" && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                          <Settings className="w-6 h-6 text-indigo-400" />
                          선택과목 변경 기초자료 입력 (교육과정 및 위계)
                        </h2>
                        
                        
                          <div className="flex bg-slate-800/50 p-1 rounded-xl">
                          <button
                            onClick={() => setChangeActiveGrade("grade2")}
                            className={`px-6 py-2 rounded-lg font-medium transition-all ${changeActiveGrade === "grade2"
                                ? "bg-indigo-500 text-white shadow-md"
                                : "text-white hover:text-white"
                              }`}
                          >
                            2학년
                          </button>
                          <button
                            onClick={() => setChangeActiveGrade("grade3")}
                            className={`px-6 py-2 rounded-lg font-medium transition-all ${changeActiveGrade === "grade3"
                                ? "bg-indigo-500 text-white shadow-md"
                                : "text-white hover:text-white"
                              }`}
                          >
                            3학년
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-5 gap-8">
                        {/* Left Column: Curriculum Upload */}
                        <div className="col-span-3 space-y-6">
                          <div className="bg-slate-950/40 border border-slate-800/50 rounded-2xl p-6 h-full flex flex-col">
                            <h3 className="text-lg font-semibold text-slate-200 mb-2 flex items-center gap-2">
                              <Upload className="w-5 h-5 text-indigo-400" />
                              교육과정 엑셀 업로드
                            </h3>
                            <p className="text-sm text-slate-300 mb-6">
                              선택하신 학년이 기준이 됩니다. 수요조사와 독립적으로 검증에 사용될 교육과정 엑셀 파일을 업로드해 주세요.
                            </p>
                            
                            <div className="relative group mb-6 shrink-0">
                              <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleChangeCurriculumUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              />
                              <div className="flex flex-col items-center justify-center w-full h-32 bg-slate-900/50 border-2 border-dashed border-slate-700 rounded-xl group-hover:border-indigo-500/50 group-hover:bg-indigo-500/5 transition-all">
                                <Upload className="w-8 h-8 text-slate-300 group-hover:text-indigo-400 mb-2 transition-colors" />
                                <p className="text-slate-300 font-medium text-sm">엑셀 파일 업로드</p>
                              </div>
                            </div>

                            {changeIsCurriculumParsed[changeActiveGrade] && changeParsedCurriculumList[changeActiveGrade]?.length > 0 && (
                              <div className="flex-1 overflow-auto pr-2 custom-scrollbar">
                                <div className="rounded-lg border border-slate-800">
                                  <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-300 uppercase bg-slate-900/80 sticky top-0 z-10">
                                      <tr>
                                        <th className="px-4 py-3 font-medium">구분</th>
                                        <th className="px-4 py-3 font-medium">과목명</th>
                                        <th className="px-4 py-3 font-medium">교과(군)</th>
                                        <th className="px-4 py-3 font-medium text-center">학점</th>
                                        <th className="px-4 py-3 font-medium">학기</th>
                                        <th className="px-4 py-3 font-medium text-center">비고</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                      {changeParsedCurriculumList[changeActiveGrade].map((subj, idx) => (
                                        <tr key={idx} className="bg-slate-950/30 hover:bg-slate-900/50 transition-colors">
                                          <td className="px-4 py-3">
                                            <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider ${subj.type === "지정" ? "bg-rose-600/10 text-rose-400 border border-rose-500/20" : "bg-indigo-500/10 text-white border border-indigo-500/20"
                                              }`}>
                                              {subj.type}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3 font-medium text-slate-200">{subj.subject}</td>
                                          <td className="px-4 py-3 text-slate-300 text-xs">{subj.category}</td>
                                          <td className="px-4 py-3 text-center text-amber-400/90 font-mono">{subj.credits}</td>
                                          <td className="px-4 py-3 text-slate-300 text-[10px]">{subj.semesters}</td>
                                          <td className="px-4 py-3 text-center">
                                            {["국어", "수학", "영어"].includes(subj.category) && (
                                              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium">
                                                기초
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
                        </div>

                        {/* Right Column: Hierarchy Setup */}
                        <div className="col-span-2 space-y-6">
                          <div className="bg-slate-950/40 border border-slate-800/50 rounded-2xl p-6 h-full flex flex-col">
                            <div className="flex justify-between items-center mb-2">
                              <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                                <GitBranch className="w-5 h-5 text-indigo-400" />
                                위계 규칙 설정
                              </h3>
                              <button
                                onClick={() => {
                                  const subjects = Object.keys(changeSubjectMap[changeActiveGrade] || {});
                                  if (subjects.length > 0) {
                                    setChangeHierarchyRules(prev => ({
                                      ...prev,
                                      [changeActiveGrade]: [...(prev[changeActiveGrade] || []), { id: Date.now().toString(), prereq: subjects[0], advanced: subjects[0] }]
                                    }));
                                  } else {
                                    alert('먼저 교육과정 엑셀 파일을 업로드해 주세요.');
                                  }
                                }}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors border border-slate-700 flex items-center gap-1.5 text-xs"
                              >
                                <Plus className="w-3 h-3" />
                                규칙 추가
                              </button>
                            </div>
                            <p className="text-sm text-slate-300 mb-6">
                              변경 신청 시 위계 위반을 검증할 규칙을 설정합니다.
                            </p>

                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                              {(!changeHierarchyRules[changeActiveGrade] || changeHierarchyRules[changeActiveGrade].length === 0) ? (
                                <div className="p-6 border border-dashed border-slate-700/50 rounded-xl text-center text-slate-300 text-sm">
                                  설정된 위계 규칙이 없습니다.
                                </div>
                              ) : (
                                changeHierarchyRules[changeActiveGrade].map((rule, idx) => (
                                  <div key={rule.id} className="flex flex-col gap-2 p-3 bg-slate-900/80 border border-slate-700/50 rounded-xl relative group">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-slate-300 font-medium text-xs">규칙 #{idx + 1}</span>
                                      <button
                                        onClick={() => {
                                          const newRules = changeHierarchyRules[changeActiveGrade].filter(r => r.id !== rule.id);
                                          setChangeHierarchyRules(prev => ({ ...prev, [changeActiveGrade]: newRules }));
                                        }}
                                        className="text-slate-300 hover:text-rose-400 transition-colors"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <select
                                        value={rule.prereq}
                                        onChange={(e) => {
                                          const newRules = [...changeHierarchyRules[changeActiveGrade]];
                                          newRules[idx].prereq = e.target.value;
                                          setChangeHierarchyRules(prev => ({ ...prev, [changeActiveGrade]: newRules }));
                                        }}
                                        className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-slate-300 text-xs"
                                      >
                                        {Object.keys(changeSubjectMap[changeActiveGrade] || {}).map(subj => (
                                          <option key={subj} value={subj}>{subj}</option>
                                        ))}
                                      </select>
                                      <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                                      <select
                                        value={rule.advanced}
                                        onChange={(e) => {
                                          const newRules = [...changeHierarchyRules[changeActiveGrade]];
                                          newRules[idx].advanced = e.target.value;
                                          setChangeHierarchyRules(prev => ({ ...prev, [changeActiveGrade]: newRules }));
                                        }}
                                        className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-slate-300 text-xs"
                                      >
                                        {Object.keys(changeSubjectMap[changeActiveGrade] || {}).map(subj => (
                                          <option key={subj} value={subj}>{subj}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-8 flex justify-end">
                        <button
                          onClick={() => setChangeActiveTab("upload")}
                          className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-colors border border-slate-700 flex items-center gap-2"
                        >
                          다음 단계(데이터 업로드)로 이동
                          <Upload className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

{changeActiveTab === "upload" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex justify-between items-center mb-2">
                        <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                          <Upload className="w-6 h-6 text-indigo-400" />
                          2학기 타임별 선택과목 데이터 업로드
                        </h2>

                        <div className="flex bg-slate-800/50 p-1 rounded-xl">
                          <button
                            onClick={() => setChangeActiveGrade("grade2")}
                            className={`px-6 py-2 rounded-lg font-medium transition-all ${changeActiveGrade === "grade2"
                                ? "bg-indigo-500 text-white shadow-md"
                                : "text-white hover:text-white"
                              }`}
                          >
                            2학년
                          </button>
                          <button
                            onClick={() => setChangeActiveGrade("grade3")}
                            className={`px-6 py-2 rounded-lg font-medium transition-all ${changeActiveGrade === "grade3"
                                ? "bg-indigo-500 text-white shadow-md"
                                : "text-white hover:text-white"
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
                          <h3 className="text-xl font-medium text-slate-200 mb-2">학생 선택 데이터 파일 (sample3) 업로드</h3>
                          <p className="text-slate-300 mb-4 text-center max-w-md">
                            과목명이 열 헤더로 지정되어 있고, 셀 값으로 A, B, C, D 등의 선택 그룹이 명시된 수요조사 결과 파일을 업로드해 주세요.
                          </p>
                          <div className="flex flex-col items-center gap-2 mb-6">
                            <div className="flex items-center gap-2">
                              <FileIcon className="w-4 h-4 text-emerald-400" />
                              <span className="text-emerald-400 font-medium">
                                {changeUploadNames[changeActiveGrade]?.timetable || '업로드된 파일'}
                              </span>
                            </div>
                            <span className="text-slate-300 text-sm">
                              {changeActiveGrade === "grade2" ? "2학년" : "3학년"} 학생 선택 데이터: {parsedSampleData[changeActiveGrade].length}명 파싱 완료
                            </span>
                          </div>
                          <div className="flex gap-4">
                            <button
                              onClick={handleDeleteSampleUpload}
                              className="flex items-center gap-2 px-5 py-2.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20 font-medium rounded-xl transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                              삭제
                            </button>
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
                          <p className="text-slate-300 mb-6 text-center max-w-md">
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

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                        {/* 2학년 수강과목 데이터 업로드(선택) */}
                        <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50 flex flex-col items-center justify-center min-h-[250px]">
                          {extraUploads[changeActiveGrade]?.grade2Optional ? (
                            <>
                              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                              </div>
                              <h3 className="text-lg font-medium text-slate-200 mb-4">2학년 수강과목 데이터 업로드(선택)</h3>
                              <div className="flex items-center gap-2 mb-6 text-sm">
                                <FileIcon className="w-4 h-4 text-emerald-400" />
                                <span className="text-emerald-400 font-medium">
                                  {changeUploadNames[changeActiveGrade]?.grade2Optional || '업로드된 파일'}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleDeleteExtraUpload('grade2Optional')}
                                  className="flex items-center gap-2 px-3 py-2 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20 font-medium rounded-xl transition-all text-sm"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  삭제
                                </button>
                                <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-medium rounded-xl transition-all">
                                  <Upload className="w-4 h-4" />
                                  재업로드
                                  <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExtraUpload('grade2Optional')} />
                                </label>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                <FileIcon className="w-8 h-8 text-indigo-400" />
                              </div>
                              <h3 className="text-lg font-medium text-slate-200 mb-6">2학년 수강과목 데이터 업로드(선택)</h3>
                              <label className="cursor-pointer flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-medium rounded-xl transition-all shadow-sm">
                                <Upload className="w-4 h-4" />
                                파일 업로드
                                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExtraUpload('grade2Optional')} />
                              </label>
                            </>
                          )}
                        </div>

                        {/* 3학년 1학기 데이터 업로드 */}
                        <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50 flex flex-col items-center justify-center min-h-[250px]">
                          {extraUploads[changeActiveGrade]?.grade3Sem1 ? (
                            <>
                              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                              </div>
                              <h3 className="text-lg font-medium text-slate-200 mb-4">3학년 1학기 데이터 업로드</h3>
                              <div className="flex items-center gap-2 mb-6 text-sm">
                                <FileIcon className="w-4 h-4 text-emerald-400" />
                                <span className="text-emerald-400 font-medium">
                                  {changeUploadNames[changeActiveGrade]?.grade3Sem1 || '업로드된 파일'}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleDeleteExtraUpload('grade3Sem1')}
                                  className="flex items-center gap-2 px-3 py-2 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20 font-medium rounded-xl transition-all text-sm"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  삭제
                                </button>
                                <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-medium rounded-xl transition-all">
                                  <Upload className="w-4 h-4" />
                                  재업로드
                                  <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExtraUpload('grade3Sem1')} />
                                </label>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                <FileIcon className="w-8 h-8 text-indigo-400" />
                              </div>
                              <h3 className="text-lg font-medium text-slate-200 mb-6">3학년 1학기 데이터 업로드</h3>
                              <label className="cursor-pointer flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-medium rounded-xl transition-all shadow-sm">
                                <Upload className="w-4 h-4" />
                                파일 업로드
                                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExtraUpload('grade3Sem1')} />
                              </label>
                            </>
                          )}
                        </div>
                      </div>
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
                            className={`px-6 py-2 rounded-lg font-medium transition-all ${changeActiveGrade === "grade2"
                                ? "bg-indigo-500 text-white shadow-md"
                                : "text-white hover:text-white"
                              }`}
                          >
                            2학년
                          </button>
                          <button
                            onClick={() => setChangeActiveGrade("grade3")}
                            className={`px-6 py-2 rounded-lg font-medium transition-all ${changeActiveGrade === "grade3"
                                ? "bg-indigo-500 text-white shadow-md"
                                : "text-white hover:text-white"
                              }`}
                          >
                            3학년
                          </button>
                        </div>
                      </div>

                      <div className="bg-slate-900 rounded-2xl border border-slate-700/50 overflow-hidden shadow-xl">
                        <div className="p-4 border-b border-slate-800/80 bg-slate-800/30 flex justify-between items-center">
                          <div className="text-sm text-slate-300">
                            엑셀에서 복사한 데이터를 칸에 클릭 후 붙여넣기(Ctrl+V) 하시면 한 번에 자동으로 채워집니다.
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={handleExportTimetable}
                              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg font-medium text-sm transition-colors border border-emerald-500/30"
                            >
                              <Download className="w-4 h-4" /> 엑셀 다운로드
                            </button>
                            <button
                              onClick={addTimeSlot}
                              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500/20 text-white hover:bg-indigo-500/30 rounded-lg font-medium text-sm transition-colors border border-indigo-500/30"
                            >
                              <Plus className="w-4 h-4" /> 타임 추가
                            </button>
                            <button
                              onClick={addClassCol}
                              className="flex items-center gap-1 px-3 py-1.5 bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 rounded-lg font-medium text-sm transition-colors border border-rose-500/30"
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
                                          className="w-full flex-1 bg-transparent text-white px-2 text-center text-sm font-medium focus:outline-none focus:bg-indigo-500/10 focus:ring-1 focus:ring-indigo-500/50 border-b border-slate-800/50"
                                          value={timetableData[changeActiveGrade]?.[row]?.[col]?.subject || ""}
                                          onChange={(e) => updateTimetableCell(row, col, "subject", e.target.value)}
                                          onPaste={(e) => handleTimetablePaste(e, rIdx, cIdx, "subject")}
                                          placeholder="과목명"
                                        />
                                        <input
                                          type="text"
                                          className="w-full flex-1 bg-transparent text-white px-2 text-center text-xs focus:outline-none focus:bg-indigo-500/10 focus:ring-1 focus:ring-indigo-500/50"
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
                          선택과목 변경 신청 내역
                        </h2>
                        <div className="flex bg-slate-800/50 p-1 rounded-xl">
                          <button
                            onClick={() => setChangeActiveGrade("grade2")}
                            className={`px-6 py-2 rounded-lg font-medium transition-all ${changeActiveGrade === "grade2"
                                ? "bg-indigo-500 text-white shadow-md"
                                : "text-white hover:text-white"
                              }`}
                          >
                            2학년
                          </button>
                          <button
                            onClick={() => setChangeActiveGrade("grade3")}
                            className={`px-6 py-2 rounded-lg font-medium transition-all ${changeActiveGrade === "grade3"
                                ? "bg-indigo-500 text-white shadow-md"
                                : "text-white hover:text-white"
                              }`}
                          >
                            3학년
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        
                        <div className="flex flex-col gap-6 w-full min-w-0">
                          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-inner">
                          <div className="p-4 bg-slate-800/80 border-b border-slate-700/50">
                            <h3 className="font-semibold text-slate-200">변경 신청 입력(신청자)</h3>
                          </div>
                          <div className="overflow-auto relative">
                            <table className="w-full text-sm text-left text-slate-300 border-collapse">
                              <thead className="text-xs text-slate-300 bg-slate-800 border-b border-slate-700 uppercase">
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
                                        [changeActiveGrade]: [{
                                          id: Date.now().toString() + Math.random().toString(36).substring(7),
                                          studentId: "",
                                          studentName: "",
                                          beforeSubject: "",
                                          afterSubject: "",
                                          isNew: true
                                        }, ...prev[changeActiveGrade]]
                                      }));
                                    }} className="p-1 text-slate-300 hover:text-emerald-400 transition-colors">
                                      <Plus className="w-5 h-5 mx-auto" />
                                    </button>
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  const data = electiveChanges[changeActiveGrade];
                                  const sortedData = [...data].sort((a, b) => {
                                      const isCompleteA = (a.studentId||'').trim() && (a.studentName||'').trim() && (a.beforeSubject||'').trim() && (a.afterSubject||'').trim();
                                      const isCompleteB = (b.studentId||'').trim() && (b.studentName||'').trim() && (b.beforeSubject||'').trim() && (b.afterSubject||'').trim();
                                      const isPendingNewA = a.isNew;
                                      const isPendingNewB = b.isNew;
                                      if (isPendingNewA && !isPendingNewB) return -1;
                                      if (!isPendingNewA && isPendingNewB) return 1;
                                      if (isPendingNewA && isPendingNewB) return 0;
                                      const valA = String(a.studentId || "").trim();
                                      const valB = String(b.studentId || "").trim();
                                      return valA.localeCompare(valB);
                                  });
                                  if (sortedData.length === 0) {
                                    return (
                                      <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-slate-300">
                                          등록된 선택과목 변경 신청 내역이 없습니다.<br />
                                          우측 상단의 <Plus className="w-4 h-4 inline mx-1" /> 버튼을 눌러 추가하세요.
                                        </td>
                                      </tr>
                                    );
                                  }

                                  const groupedData: any[] = [];
                                  sortedData.forEach(item => {
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

                                      const handleBlur = () => {
                                        setElectiveChanges(prev => {
                                          const newData = [...prev[changeActiveGrade]];
                                          let modified = false;
                                          group.items.forEach((gItem: any) => {
                                            if (gItem.isNew) {
                                              const isComplete = (gItem.studentId||'').trim() && (gItem.studentName||'').trim() && (gItem.beforeSubject||'').trim() && (gItem.afterSubject||'').trim();
                                              if (isComplete) {
                                                const idx = newData.findIndex(x => x.id === gItem.id);
                                                if (idx > -1) {
                                                  newData[idx] = { ...newData[idx] };
                                                  delete newData[idx].isNew;
                                                  modified = true;
                                                }
                                              }
                                            }
                                          });
                                          return modified ? { ...prev, [changeActiveGrade]: newData } : prev;
                                        });
                                      };

                                      return (
                                        <tr key={item.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                                          <td className="px-3 py-2 text-center border-r border-slate-700/50 text-slate-300">{currentIndex + 1}</td>
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
                                                  onBlur={handleBlur}
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
                                                  onBlur={handleBlur}
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
                                              onBlur={handleBlur}
                                              className="w-full bg-slate-950/50 border border-slate-700 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-center text-sm"
                                            />
                                          </td>
                                          <td className="px-2 py-2 text-center text-slate-600 border-r border-slate-700/50">→</td>
                                          <td className="px-2 py-2 border-r border-slate-700/50">
                                            <input
                                              type="text"
                                              value={item.afterSubject}
                                              onChange={e => updateItem("afterSubject", e.target.value)}
                                              onBlur={handleBlur}
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
                                              }} className="p-1 text-slate-300 hover:text-emerald-400 transition-colors" title="같은 학생 과목 추가">
                                                <Plus className="w-3.5 h-3.5" />
                                              </button>
                                              <button onClick={() => {
                                                setElectiveChanges(prev => ({
                                                  ...prev,
                                                  [changeActiveGrade]: prev[changeActiveGrade].filter(x => x.id !== item.id)
                                                }));
                                              }} className="p-1 text-slate-300 hover:text-red-400 transition-colors" title="삭제">
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
                          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-inner">
                          <div className="p-4 bg-slate-800/80 border-b border-slate-700/50">
                            <h3 className="font-semibold text-emerald-300">인원 균등 분배를 위한 임의 변경</h3>
                          </div>
                          <div className="overflow-auto relative">
                            <table className="w-full text-sm text-left text-slate-300 border-collapse">
                              <thead className="text-xs text-slate-300 bg-slate-800 border-b border-slate-700 uppercase">
                                <tr>
                                  <th className="px-3 py-3 font-semibold text-center w-12 border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800 shadow-sm">순번</th>
                                  <th className="px-4 py-3 font-semibold text-center w-24 border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800 shadow-sm">학번</th>
                                  <th className="px-4 py-3 font-semibold text-center w-24 border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800 shadow-sm">이름</th>
                                  <th className="px-4 py-3 font-semibold text-center border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800 shadow-sm">변경전</th>
                                  <th className="px-2 py-3 font-semibold text-center w-8 border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800 shadow-sm">→</th>
                                  <th className="px-4 py-3 font-semibold text-center border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800 shadow-sm">변경후</th>
                                  <th className="px-2 py-3 font-semibold text-center w-12 sticky top-0 z-10 bg-slate-800 shadow-sm">
                                    <button onClick={() => {
                                      setElectiveChangesArbitrary(prev => ({
                                        ...prev,
                                        [changeActiveGrade]: [{
                                          id: Date.now().toString() + Math.random().toString(36).substring(7),
                                          studentId: "",
                                          studentName: "",
                                          beforeSubject: "",
                                          afterSubject: "",
                                          isNew: true
                                        }, ...prev[changeActiveGrade]]
                                      }));
                                    }} className="p-1 text-slate-300 hover:text-emerald-400 transition-colors">
                                      <Plus className="w-5 h-5 mx-auto" />
                                    </button>
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  const data = electiveChangesArbitrary[changeActiveGrade];
                                  const sortedData = [...data].sort((a, b) => {
                                      const isCompleteA = (a.studentId||'').trim() && (a.studentName||'').trim() && (a.beforeSubject||'').trim() && (a.afterSubject||'').trim();
                                      const isCompleteB = (b.studentId||'').trim() && (b.studentName||'').trim() && (b.beforeSubject||'').trim() && (b.afterSubject||'').trim();
                                      const isPendingNewA = a.isNew;
                                      const isPendingNewB = b.isNew;
                                      if (isPendingNewA && !isPendingNewB) return -1;
                                      if (!isPendingNewA && isPendingNewB) return 1;
                                      if (isPendingNewA && isPendingNewB) return 0;
                                      const valA = String(a.studentId || "").trim();
                                      const valB = String(b.studentId || "").trim();
                                      return valA.localeCompare(valB);
                                  });
                                  if (sortedData.length === 0) {
                                    return (
                                      <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-slate-300">
                                          등록된 선택과목 변경 신청 내역이 없습니다.<br />
                                          우측 상단의 <Plus className="w-4 h-4 inline mx-1" /> 버튼을 눌러 추가하세요.
                                        </td>
                                      </tr>
                                    );
                                  }

                                  const groupedData: any[] = [];
                                  sortedData.forEach(item => {
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
                                        setElectiveChangesArbitrary(prev => {
                                          const newData = [...prev[changeActiveGrade]];
                                          const index = newData.findIndex(x => x.id === item.id);
                                          if (index > -1) newData[index] = { ...newData[index], [field]: value };
                                          return { ...prev, [changeActiveGrade]: newData };
                                        });
                                      };

                                      const handleBlur = () => {
                                        setElectiveChangesArbitrary(prev => {
                                          const newData = [...prev[changeActiveGrade]];
                                          let modified = false;
                                          group.items.forEach((gItem: any) => {
                                            if (gItem.isNew) {
                                              const isComplete = (gItem.studentId||'').trim() && (gItem.studentName||'').trim() && (gItem.beforeSubject||'').trim() && (gItem.afterSubject||'').trim();
                                              if (isComplete) {
                                                const idx = newData.findIndex(x => x.id === gItem.id);
                                                if (idx > -1) {
                                                  newData[idx] = { ...newData[idx] };
                                                  delete newData[idx].isNew;
                                                  modified = true;
                                                }
                                              }
                                            }
                                          });
                                          return modified ? { ...prev, [changeActiveGrade]: newData } : prev;
                                        });
                                      };

                                      return (
                                        <tr key={item.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                                          <td className="px-3 py-2 text-center border-r border-slate-700/50 text-slate-300">{currentIndex + 1}</td>
                                          {isFirstInGroup && (
                                            <>
                                              <td rowSpan={rowSpan} className="px-2 py-2 border-r border-slate-700/50 align-top">
                                                <input
                                                  type="text"
                                                  value={item.studentId}
                                                  onChange={e => {
                                                    const val = e.target.value;
                                                    setElectiveChangesArbitrary(prev => {
                                                      const newData = [...prev[changeActiveGrade]];
                                                      group.items.forEach((gItem: any) => {
                                                        const idx = newData.findIndex(x => x.id === gItem.id);
                                                        if (idx > -1) newData[idx] = { ...newData[idx], studentId: val };
                                                      });
                                                      return { ...prev, [changeActiveGrade]: newData };
                                                    });
                                                  }}
                                                  onBlur={handleBlur}
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
                                                    setElectiveChangesArbitrary(prev => {
                                                      const newData = [...prev[changeActiveGrade]];
                                                      group.items.forEach((gItem: any) => {
                                                        const idx = newData.findIndex(x => x.id === gItem.id);
                                                        if (idx > -1) newData[idx] = { ...newData[idx], studentName: val };
                                                      });
                                                      return { ...prev, [changeActiveGrade]: newData };
                                                    });
                                                  }}
                                                  onBlur={handleBlur}
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
                                              onBlur={handleBlur}
                                              className="w-full bg-slate-950/50 border border-slate-700 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-center text-sm"
                                            />
                                          </td>
                                          <td className="px-2 py-2 text-center text-slate-600 border-r border-slate-700/50">→</td>
                                          <td className="px-2 py-2 border-r border-slate-700/50">
                                            <input
                                              type="text"
                                              value={item.afterSubject}
                                              onChange={e => updateItem("afterSubject", e.target.value)}
                                              onBlur={handleBlur}
                                              className="w-full bg-slate-950/50 border border-slate-700 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-center text-sm"
                                            />
                                          </td>
                                          <td className="px-2 py-2 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                              <button onClick={() => {
                                                setElectiveChangesArbitrary(prev => {
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
                                              }} className="p-1 text-slate-300 hover:text-emerald-400 transition-colors" title="같은 학생 과목 추가">
                                                <Plus className="w-3.5 h-3.5" />
                                              </button>
                                              <button onClick={() => {
                                                setElectiveChangesArbitrary(prev => ({
                                                  ...prev,
                                                  [changeActiveGrade]: prev[changeActiveGrade].filter(x => x.id !== item.id)
                                                }));
                                              }} className="p-1 text-slate-300 hover:text-red-400 transition-colors" title="삭제">
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
                        </div>
                        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-inner flex flex-col h-full">
                          <div className="p-4 bg-slate-800/80 border-b border-slate-700/50 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                              <h3 className="font-semibold text-emerald-400">자동 변경 결과 내역</h3>
                              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={enableOptimization}
                                  onChange={(e) => setEnableOptimization(e.target.checked)}
                                  className="form-checkbox rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-emerald-500"
                                />
                                인원 균등화 최적화 알고리즘
                              </label>
                            </div>
                            <button
                              onClick={handleExportChanges}
                              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg shadow-md transition-all"
                            >
                              <Download className="w-3.5 h-3.5" />
                              엑셀 다운로드
                            </button>
                          </div>
                          <div className="overflow-auto flex-1">
                            <table className="w-full text-sm text-left text-slate-300 border-collapse">
                              <thead className="text-xs text-slate-300 bg-slate-800/50 border-b border-slate-700 uppercase">
                                <tr>
                                  <th className="px-4 py-3 font-semibold text-center w-24 border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800/90 backdrop-blur shadow-sm">학번</th>
                                  <th className="px-4 py-3 font-semibold text-center w-24 border-r border-slate-700/50 sticky top-0 z-10 bg-slate-800/90 backdrop-blur shadow-sm">이름</th>
                                  <th className="px-4 py-3 font-semibold text-center sticky top-0 z-10 bg-slate-800/90 backdrop-blur shadow-sm">변경 내역</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  const data = electiveChanges[changeActiveGrade] || [];
                                  const dataLower = electiveChangesArbitrary[changeActiveGrade] || [];
                                  
                                  if (data.length === 0 && dataLower.length === 0) {
                                    return (
                                      <tr>
                                        <td colSpan={3} className="px-6 py-12 text-center text-slate-300">
                                          신청 내역을 입력하면 자동 변경 결과가 이곳에 표시됩니다.
                                        </td>
                                      </tr>
                                    );
                                  }

                                  const studentsUpper = Array.from(new Set(data.map(d => d.studentId))).filter(id => id).sort((a, b) => String(a).localeCompare(String(b)));
                                  const studentsLower = Array.from(new Set(dataLower.map(d => d.studentId))).filter(id => id).sort((a, b) => String(a).localeCompare(String(b)));

                                  if (studentsUpper.length === 0 && studentsLower.length === 0) {
                                    return (
                                      <tr>
                                        <td colSpan={3} className="px-6 py-12 text-center text-slate-300">
                                          유효한 학번이 입력되지 않았습니다.
                                        </td>
                                      </tr>
                                    );
                                  }

                                  const renderSection = (students: string[], source: 'applicant' | 'arbitrary', title: string, originalData: any[]) => {
                                    if (students.length === 0) return null;
                                    
                                    const rows = students.map(studentId => {
                                      const logs = adjustmentLog[studentId] || [];
                                      const filteredLogs = logs.filter(l => l.source === source);
                                      if (filteredLogs.length === 0) return null;
                                      
                                      const studentName = originalData.find(d => d.studentId === studentId)?.studentName || "";

                                      return (
                                        <tr key={studentId} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                                          <td className="px-4 py-3 text-center border-r border-slate-700/50 font-medium">{studentId}</td>
                                          <td className="px-4 py-3 text-center border-r border-slate-700/50">{studentName}</td>
                                          <td className="px-4 py-3">
                                            {filteredLogs.length > 0 ? (
                                              <div className="space-y-1">
                                                {filteredLogs.map((log, i) => (
                                                  <div
                                                    key={i}
                                                    className={`inline-block px-2 py-1 rounded border text-xs mr-2 mb-1 ${log.status === 'success'
                                                        ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
                                                        : 'text-rose-300 bg-rose-600/10 border-rose-500/20 cursor-help'
                                                      }`}
                                                    title={log.reason}
                                                  >
                                                    {log.beforeStr} → {log.afterStr}
                                                    {log.status === 'failed' && <span className="ml-1 font-bold">(불가)</span>}
                                                  </div>
                                                ))}
                                              </div>
                                            ) : (
                                              <span className="text-slate-300 italic text-xs">일치하는 수강 명단 없음</span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    }).filter(Boolean);

                                    if (rows.length === 0) return null;

                                    return (
                                      <>
                                        <tr>
                                          <td colSpan={3} className="px-4 py-2 bg-slate-800/80 border-y border-slate-700/50 text-emerald-400 font-semibold text-sm">
                                            {title}
                                          </td>
                                        </tr>
                                        {rows}
                                      </>
                                    );
                                  };

                                  return (
                                    <>
                                      {renderSection(studentsUpper, 'applicant', '■ 변경 신청 결과 (신청자)', data)}
                                      {renderSection(studentsLower, 'arbitrary', '■ 인원 균등 분배 임의 변경 결과', dataLower)}
                                    </>
                                  );
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
                        <div className="flex items-center gap-4">
                          <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                            <Users className="w-6 h-6 text-indigo-400" />
                            타임별 선택과목 명단(변경 후)
                          </h2>
                          <div className="flex items-center gap-3 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50 text-xs font-medium">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                              <span className="text-amber-200">학생 신청 변경</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                              <span className="text-emerald-200">인원 균등 분배(자동)</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => handleExportRoster(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg shadow-md transition-all"
                          >
                            <Download className="w-4 h-4" />
                            엑셀 다운로드
                          </button>
                          <div className="flex bg-slate-800/50 p-1 rounded-xl">
                            <button
                              onClick={() => setChangeActiveGrade("grade2")}
                              className={`px-6 py-2 rounded-lg font-medium transition-all ${changeActiveGrade === "grade2"
                                  ? "bg-indigo-500 text-white shadow-md"
                                  : "text-white hover:text-white"
                                }`}
                            >
                              2학년
                            </button>
                            <button
                              onClick={() => setChangeActiveGrade("grade3")}
                              className={`px-6 py-2 rounded-lg font-medium transition-all ${changeActiveGrade === "grade3"
                                  ? "bg-indigo-500 text-white shadow-md"
                                  : "text-white hover:text-white"
                                }`}
                            >
                              3학년
                            </button>
                          </div>
                        </div>
                      </div>

                      {(() => {
                        const currentSubjects = Array.from(new Set(
                          timeSlots[changeActiveGrade].flatMap(slot => 
                            classCols[changeActiveGrade]
                              .map(col => {
                                const cellSubject = timetableData[changeActiveGrade]?.[slot]?.[col]?.subject?.trim();
                                if (!cellSubject) return null;
                                const match = cellSubject.match(/^(.*?)([\d\s]*)$/);
                                return match ? match[1].trim() : cellSubject;
                              })
                              .filter(Boolean)
                          )
                        )).sort() as string[];

                        const displayCols: { slot: string, col: string, original: string }[] = [];
                        if (rosterAfterSubjectFilter === "전체") {
                          classCols[changeActiveGrade].forEach(col => {
                            const cellSubject = timetableData[changeActiveGrade]?.[changeRosterTimeSlot]?.[col]?.subject?.trim();
                            displayCols.push({ slot: changeRosterTimeSlot, col, original: cellSubject || "" });
                          });
                        } else {
                          timeSlots[changeActiveGrade].forEach(slot => {
                            classCols[changeActiveGrade].forEach(col => {
                              const cellSubject = timetableData[changeActiveGrade]?.[slot]?.[col]?.subject?.trim();
                              if (!cellSubject) return;
                              const match = cellSubject.match(/^(.*?)([\d\s]*)$/);
                              const base = match ? match[1].trim() : cellSubject;
                              if (base === rosterAfterSubjectFilter) {
                                displayCols.push({ slot, col, original: cellSubject });
                              }
                            });
                          });
                        }

                                                const maxCols = classCols[changeActiveGrade].length;
                        const firstColWidth = 8;
                        const dataColWidth = (100 - firstColWidth) / maxCols;
                        const emptyColCount = maxCols - displayCols.length;

                        return (
                          <>
                            <div className="flex gap-2 flex-wrap mb-4">
                              {timeSlots[changeActiveGrade].map(slot => (
                                <button
                                  key={slot}
                                  onClick={() => {
                                    setChangeRosterTimeSlot(slot);
                                    setRosterAfterSubjectFilter("전체");
                                  }}
                                  className={`px-5 py-2 rounded-lg font-medium transition-all ${changeRosterTimeSlot === slot && rosterAfterSubjectFilter === "전체"
                                      ? "bg-indigo-600 text-white shadow-md"
                                      : "bg-slate-800/50 text-white hover:bg-slate-700 hover:text-white"
                                    }`}
                                >
                                  {slot}타임
                                </button>
                              ))}
                            </div>
                            
                            {currentSubjects.length > 0 && (
                              <div className="flex gap-2 flex-wrap mb-4">
                                <button
                                  onClick={() => setRosterAfterSubjectFilter("전체")}
                                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${rosterAfterSubjectFilter === "전체"
                                      ? "bg-amber-500 text-white shadow-md"
                                      : "bg-slate-800/50 text-white hover:bg-slate-700 hover:text-white"
                                    }`}
                                >
                                  전체 과목 (타임별)
                                </button>
                                {currentSubjects.map(sub => (
                                  <button
                                    key={sub}
                                    onClick={() => setRosterAfterSubjectFilter(sub)}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${rosterAfterSubjectFilter === sub
                                        ? "bg-amber-500 text-white shadow-md"
                                        : "bg-slate-800/50 text-white hover:bg-slate-700 hover:text-white"
                                      }`}
                                  >
                                    {sub}
                                  </button>
                                ))}
                              </div>
                            )}

                            <div className="bg-slate-900 rounded-2xl border border-slate-700/50 overflow-hidden shadow-xl">
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse table-fixed">
                                  <thead>
                                    <tr className="bg-amber-400/20 text-amber-200 border-b-2 border-slate-700">
                                      <th style={{ width: `${firstColWidth}%` }} className="px-3 py-2 border-r border-slate-700/50 text-center font-bold">과목명</th>
                                      {displayCols.map(c => (
                                        <th key={`${c.slot}-${c.col}`} colSpan={2} style={{ width: `${dataColWidth}%` }} className="px-3 py-2 border-r border-slate-700/50 text-center font-bold">
                                          {rosterAfterSubjectFilter === "전체" ? c.original : `${c.slot}타임 ${c.original}`}
                                        </th>
                                      ))}
                                      {emptyColCount > 0 && <th style={{ width: `${emptyColCount * dataColWidth}%` }}></th>}
                                    </tr>
                                    <tr className="bg-slate-800 border-b border-slate-700">
                                      <th className="px-3 py-2 border-r border-slate-700/50 text-center font-semibold text-slate-300">강의실</th>
                                      {displayCols.map(c => (
                                        <Fragment key={`room-${c.slot}-${c.col}`}>
                                          <th colSpan={2} className="px-3 py-2 border-r border-slate-700/50 text-center font-semibold text-slate-300 bg-slate-800/80">
                                            {c.col}
                                          </th>
                                        </Fragment>
                                      ))}
                                      {emptyColCount > 0 && <th></th>}
                                    </tr>
                                    <tr className="bg-slate-800/50 border-b border-slate-700">
                                      <th className="px-3 py-2 border-r border-slate-700/50 text-center font-semibold text-slate-300">교사</th>
                                      {displayCols.map(c => (
                                        <Fragment key={`teacher-${c.slot}-${c.col}`}>
                                          <th colSpan={2} className="px-3 py-2 border-r border-slate-700/50 text-center text-slate-300">
                                            {timetableData[changeActiveGrade]?.[c.slot]?.[c.col]?.teacher || "-"}
                                          </th>
                                        </Fragment>
                                      ))}
                                      {emptyColCount > 0 && <th></th>}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(() => {
                                      const colStudents: Record<string, any[]> = {};
                                      displayCols.forEach(c => {
                                        colStudents[`${c.slot}-${c.col}`] = [];
                                      });

                                      const allStudents = parsedSampleData[changeActiveGrade] || [];
                                      
                                      const slotGroups: Record<string, Record<string, { col: string, num: number, original: string }[]>> = {};
                                      displayCols.forEach(c => {
                                        if (!slotGroups[c.slot]) slotGroups[c.slot] = {};
                                        const match = c.original.match(/^(.*?)([\d\s]*)$/);
                                        const base = match ? match[1].trim() : c.original;
                                        const numMatch = c.original.match(/\d+/);
                                        const num = numMatch ? parseInt(numMatch[0], 10) : 1;
                                        if (!slotGroups[c.slot][base]) slotGroups[c.slot][base] = [];
                                        slotGroups[c.slot][base].push({ col: c.col, num, original: c.original });
                                      });

                                      Object.values(slotGroups).forEach(bases => {
                                        Object.values(bases).forEach(group => group.sort((a, b) => a.num - b.num));
                                      });

                                      Object.keys(slotGroups).forEach(slot => {
                                        const bases = slotGroups[slot];
                                        const studentsByBase: Record<string, any[]> = {};

                                        allStudents.forEach(student => {
                                          const chosenSubject = student.timeSlotMap[slot];
                                          if (!chosenSubject) return;

                                          let effectiveSubject = chosenSubject;
                                          let isModified = false;
                                          let modifiedSource = null;
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
                                              
                                              for (const s of (timeSlots[changeActiveGrade] || [])) {
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

                                              for (const s of (timeSlots[changeActiveGrade] || [])) {
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
                                                if (logBeforeSlot === slot && norm(logBeforeSubject) === norm(chosenSubject as string)) {
                                                  movedOut = true;
                                                }
                                                if (logAfterSlot === slot) {
                                                  movedInto = logAfterSubject;
                                                  isModified = true;
                                                  modifiedSource = entry.source;
                                                }
                                              }
                                            }
                                            if (movedOut && !movedInto) effectiveSubject = '__REMOVED__';
                                            else if (movedInto) effectiveSubject = movedInto;
                                          }

                                          if (effectiveSubject === '__REMOVED__') return;

                                          let matchedBase = Object.keys(bases).find(base => {
                                            const cleanChosen = effectiveSubject.replace(/\s+/g, '');
                                            const cleanBase = base.replace(/\s+/g, '');
                                            if (!cleanBase) return false;
                                            return cleanChosen === cleanBase || cleanChosen.includes(cleanBase) || cleanBase.includes(cleanChosen);
                                          });

                                          if (matchedBase) {
                                            if (!studentsByBase[matchedBase]) studentsByBase[matchedBase] = [];
                                            studentsByBase[matchedBase].push({ ...student, isModified, modifiedSource });
                                          }
                                        });

                                        Object.keys(studentsByBase).forEach(base => {
                                          const students = studentsByBase[base].sort((a, b) => {
                                            return a.id.localeCompare(b.id, undefined, { numeric: true });
                                          });
                                          const cols = bases[base];

                                          const baseCount = Math.floor(students.length / cols.length);
                                          const remainder = students.length % cols.length;

                                          let sIdx = 0;
                                          cols.forEach((colObj, idx) => {
                                            const count = baseCount + (idx < remainder ? 1 : 0);
                                            const assigned = students.slice(sIdx, sIdx + count);
                                            colStudents[`${slot}-${colObj.col}`].push(...assigned);
                                            sIdx += count;
                                          });
                                        });
                                      });

                                      let maxStudents = 0;
                                      displayCols.forEach(c => {
                                        if (colStudents[`${c.slot}-${c.col}`].length > maxStudents) maxStudents = colStudents[`${c.slot}-${c.col}`].length;
                                      });

                                      const rows = [];
                                      for (let r = 0; r < maxStudents; r++) {
                                        rows.push(
                                          <tr key={`row-${r}`} className={`${r % 2 === 0 ? "bg-slate-900/20" : "bg-slate-800/20"} hover:bg-indigo-900/20 transition-colors`}>
                                            <td className="px-3 py-1.5 border-r border-slate-700/50 text-center text-slate-300 bg-slate-900/50">
                                              {r + 1}
                                            </td>
                                            {displayCols.map(c => {
                                              const student = colStudents[`${c.slot}-${c.col}`][r];
                                              const isModified = student?.isModified;
                                              const studentChangeLogs = student ? (adjustmentLog[student.id] || []) : [];
                                              const tooltipText = studentChangeLogs.map(l => `${l.beforeStr} → ${l.afterStr}`).join('\n');
                                              return (
                                                <Fragment key={`${c.slot}-${c.col}-${r}`}>
                                                  <td className={`px-2 py-1.5 border-r border-slate-700/50 text-center border-r-slate-800/30 text-xs ${isModified ? (student.modifiedSource === 'applicant' ? 'bg-amber-500/10 text-amber-300 font-bold' : 'bg-emerald-500/10 text-emerald-300 font-bold') : 'text-white'}`}>
                                                    {student ? student.id : ""}
                                                  </td>
                                                  <td 
                                                    className={`px-2 py-1.5 border-r border-slate-700/50 text-center text-xs ${isModified ? (student.modifiedSource === 'applicant' ? 'bg-amber-500/10 text-amber-400 font-bold cursor-help' : 'bg-emerald-500/10 text-emerald-400 font-bold cursor-help') : 'text-white font-medium'}`}
                                                    title={isModified && tooltipText ? tooltipText : undefined}
                                                  >
                                                    {student ? student.name : ""}
                                                  </td>
                                                </Fragment>
                                              );
                                            })}
                                            {emptyColCount > 0 && <td></td>}
                                          </tr>
                                        );
                                      }

                                      return (
                                        <>
                                          {rows}
                                          <tr className="bg-indigo-900/20 border-t-2 border-indigo-500/30">
                                            <td className="px-3 py-3 border-r border-slate-700/50 text-center font-bold text-indigo-300">총 인원</td>
                                            {displayCols.map(c => (
                                              <td key={`total-${c.slot}-${c.col}`} colSpan={2} className="px-3 py-3 border-r border-slate-700/50 text-center font-bold text-indigo-300">
                                                {colStudents[`${c.slot}-${c.col}`].length}명
                                              </td>
                                            ))}
                                            {emptyColCount > 0 && <td></td>}
                                          </tr>
                                        </>
                                      );
                                    })()}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}


                  {changeActiveTab === "roster" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex justify-between items-center mb-2">
                        <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                          <Users className="w-6 h-6 text-indigo-400" />
                          타임별 선택과목 명단
                        </h2>

                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => handleExportRoster(false)}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg shadow-md transition-all"
                          >
                            <Download className="w-4 h-4" />
                            엑셀 다운로드
                          </button>
                          <div className="flex bg-slate-800/50 p-1 rounded-xl">
                            <button
                              onClick={() => setChangeActiveGrade("grade2")}
                              className={`px-6 py-2 rounded-lg font-medium transition-all ${changeActiveGrade === "grade2"
                                  ? "bg-indigo-500 text-white shadow-md"
                                  : "text-white hover:text-white"
                                }`}
                            >
                              2학년
                            </button>
                            <button
                              onClick={() => setChangeActiveGrade("grade3")}
                              className={`px-6 py-2 rounded-lg font-medium transition-all ${changeActiveGrade === "grade3"
                                  ? "bg-indigo-500 text-white shadow-md"
                                  : "text-white hover:text-white"
                                }`}
                            >
                              3학년
                            </button>
                          </div>
                        </div>
                      </div>

                      {(() => {
                        const currentSubjects = Array.from(new Set(
                          timeSlots[changeActiveGrade].flatMap(slot => 
                            classCols[changeActiveGrade]
                              .map(col => {
                                const cellSubject = timetableData[changeActiveGrade]?.[slot]?.[col]?.subject?.trim();
                                if (!cellSubject) return null;
                                const match = cellSubject.match(/^(.*?)([\d\s]*)$/);
                                return match ? match[1].trim() : cellSubject;
                              })
                              .filter(Boolean)
                          )
                        )).sort() as string[];

                        const displayCols: { slot: string, col: string, original: string }[] = [];
                        if (rosterSubjectFilter === "전체") {
                          classCols[changeActiveGrade].forEach(col => {
                            const cellSubject = timetableData[changeActiveGrade]?.[changeRosterTimeSlot]?.[col]?.subject?.trim();
                            displayCols.push({ slot: changeRosterTimeSlot, col, original: cellSubject || "" });
                          });
                        } else {
                          timeSlots[changeActiveGrade].forEach(slot => {
                            classCols[changeActiveGrade].forEach(col => {
                              const cellSubject = timetableData[changeActiveGrade]?.[slot]?.[col]?.subject?.trim();
                              if (!cellSubject) return;
                              const match = cellSubject.match(/^(.*?)([\d\s]*)$/);
                              const base = match ? match[1].trim() : cellSubject;
                              if (base === rosterSubjectFilter) {
                                displayCols.push({ slot, col, original: cellSubject });
                              }
                            });
                          });
                        }

                        const maxCols = classCols[changeActiveGrade].length;
                        const firstColWidth = 8;
                        const dataColWidth = (100 - firstColWidth) / maxCols;
                        const emptyColCount = maxCols - displayCols.length;

                        return (
                          <>
                            <div className="flex gap-2 flex-wrap mb-4">
                              {timeSlots[changeActiveGrade].map(slot => (
                                <button
                                  key={slot}
                                  onClick={() => {
                                    setChangeRosterTimeSlot(slot);
                                    setRosterSubjectFilter("전체");
                                  }}
                                  className={`px-5 py-2 rounded-lg font-medium transition-all ${changeRosterTimeSlot === slot && rosterSubjectFilter === "전체"
                                      ? "bg-indigo-600 text-white shadow-md"
                                      : "bg-slate-800/50 text-white hover:bg-slate-700 hover:text-white"
                                    }`}
                                >
                                  {slot}타임
                                </button>
                              ))}
                            </div>
                            
                            {currentSubjects.length > 0 && (
                              <div className="flex gap-2 flex-wrap mb-4">
                                <button
                                  onClick={() => setRosterSubjectFilter("전체")}
                                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${rosterSubjectFilter === "전체"
                                      ? "bg-amber-500 text-white shadow-md"
                                      : "bg-slate-800/50 text-white hover:bg-slate-700 hover:text-white"
                                    }`}
                                >
                                  전체 과목 (타임별)
                                </button>
                                {currentSubjects.map(sub => (
                                  <button
                                    key={sub}
                                    onClick={() => setRosterSubjectFilter(sub)}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${rosterSubjectFilter === sub
                                        ? "bg-amber-500 text-white shadow-md"
                                        : "bg-slate-800/50 text-white hover:bg-slate-700 hover:text-white"
                                      }`}
                                  >
                                    {sub}
                                  </button>
                                ))}
                              </div>
                            )}

                            <div className="bg-slate-900 rounded-2xl border border-slate-700/50 overflow-hidden shadow-xl">
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse table-fixed">
                                  <thead>
                                    <tr className="bg-amber-400/20 text-amber-200 border-b-2 border-slate-700">
                                      <th style={{ width: `${firstColWidth}%` }} className="px-3 py-2 border-r border-slate-700/50 text-center font-bold">과목명</th>
                                      {displayCols.map(c => (
                                        <th key={`${c.slot}-${c.col}`} colSpan={2} style={{ width: `${dataColWidth}%` }} className="px-3 py-2 border-r border-slate-700/50 text-center font-bold">
                                          {rosterSubjectFilter === "전체" ? c.original : `${c.slot}타임 ${c.original}`}
                                        </th>
                                      ))}
                                      {emptyColCount > 0 && <th style={{ width: `${emptyColCount * dataColWidth}%` }}></th>}
                                    </tr>
                                    <tr className="bg-slate-800 border-b border-slate-700">
                                      <th className="px-3 py-2 border-r border-slate-700/50 text-center font-semibold text-slate-300">강의실</th>
                                      {displayCols.map(c => (
                                        <Fragment key={`room-${c.slot}-${c.col}`}>
                                          <th colSpan={2} className="px-3 py-2 border-r border-slate-700/50 text-center font-semibold text-slate-300 bg-slate-800/80">
                                            {c.col}
                                          </th>
                                        </Fragment>
                                      ))}
                                      {emptyColCount > 0 && <th></th>}
                                    </tr>
                                    <tr className="bg-slate-800/50 border-b border-slate-700">
                                      <th className="px-3 py-2 border-r border-slate-700/50 text-center font-semibold text-slate-300">교사</th>
                                      {displayCols.map(c => (
                                        <Fragment key={`teacher-${c.slot}-${c.col}`}>
                                          <th colSpan={2} className="px-3 py-2 border-r border-slate-700/50 text-center text-slate-300">
                                            {timetableData[changeActiveGrade]?.[c.slot]?.[c.col]?.teacher || "-"}
                                          </th>
                                        </Fragment>
                                      ))}
                                      {emptyColCount > 0 && <th></th>}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(() => {
                                      const colStudents: Record<string, any[]> = {};
                                      displayCols.forEach(c => {
                                        colStudents[`${c.slot}-${c.col}`] = [];
                                      });

                                      const allStudents = parsedSampleData[changeActiveGrade] || [];
                                      
                                      const slotGroups: Record<string, Record<string, { col: string, num: number, original: string }[]>> = {};
                                      displayCols.forEach(c => {
                                        if (!slotGroups[c.slot]) slotGroups[c.slot] = {};
                                        const match = c.original.match(/^(.*?)([\d\s]*)$/);
                                        const base = match ? match[1].trim() : c.original;
                                        const numMatch = c.original.match(/\d+/);
                                        const num = numMatch ? parseInt(numMatch[0], 10) : 1;
                                        if (!slotGroups[c.slot][base]) slotGroups[c.slot][base] = [];
                                        slotGroups[c.slot][base].push({ col: c.col, num, original: c.original });
                                      });

                                      Object.values(slotGroups).forEach(bases => {
                                        Object.values(bases).forEach(group => group.sort((a, b) => a.num - b.num));
                                      });

                                      Object.keys(slotGroups).forEach(slot => {
                                        const bases = slotGroups[slot];
                                        const studentsByBase: Record<string, any[]> = {};

                                        allStudents.forEach(student => {
                                          const chosenSubject = student.timeSlotMap[slot];
                                          if (!chosenSubject) return;

                                          let effectiveSubject = chosenSubject;

                                          let matchedBase = Object.keys(bases).find(base => {
                                            const cleanChosen = effectiveSubject.replace(/\s+/g, '');
                                            const cleanBase = base.replace(/\s+/g, '');
                                            if (!cleanBase) return false;
                                            return cleanChosen === cleanBase || cleanChosen.includes(cleanBase) || cleanBase.includes(cleanChosen);
                                          });

                                          if (matchedBase) {
                                            if (!studentsByBase[matchedBase]) studentsByBase[matchedBase] = [];
                                            studentsByBase[matchedBase].push(student);
                                          }
                                        });

                                        Object.keys(studentsByBase).forEach(base => {
                                          const students = studentsByBase[base].sort((a, b) => {
                                            return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
                                          });
                                          const cols = bases[base];

                                          const baseCount = Math.floor(students.length / cols.length);
                                          const remainder = students.length % cols.length;

                                          let sIdx = 0;
                                          cols.forEach((colObj, idx) => {
                                            const count = baseCount + (idx < remainder ? 1 : 0);
                                            const assigned = students.slice(sIdx, sIdx + count);
                                            colStudents[`${slot}-${colObj.col}`].push(...assigned);
                                            sIdx += count;
                                          });
                                        });
                                      });

                                      let maxStudents = 0;
                                      displayCols.forEach(c => {
                                        if (colStudents[`${c.slot}-${c.col}`].length > maxStudents) {
                                          maxStudents = colStudents[`${c.slot}-${c.col}`].length;
                                        }
                                      });

                                      const rows = [];
                                      for (let r = 0; r < maxStudents; r++) {
                                        rows.push(
                                          <tr key={r} className="border-b border-slate-800/30 hover:bg-slate-800/20">
                                            <td className="px-3 py-1.5 border-r border-slate-700/50 text-center text-slate-300 bg-slate-900/50">{r + 1}</td>
                                            {displayCols.map(c => {
                                              const student = colStudents[`${c.slot}-${c.col}`][r];
                                              return (
                                                <Fragment key={`data-${c.slot}-${c.col}-${r}`}>
                                                  <td className="px-2 py-1.5 border-r border-slate-700/50 text-center text-slate-300 border-r-slate-800/30 text-xs">
                                                    {student ? student.id : ""}
                                                  </td>
                                                  <td className="px-2 py-1.5 border-r border-slate-700/50 text-center text-slate-300 font-medium text-xs">
                                                    {student ? student.name : ""}
                                                  </td>
                                                </Fragment>
                                              );
                                            })}
                                            {emptyColCount > 0 && <td colSpan={emptyColCount * 2}></td>}
                                          </tr>
                                        );
                                      }

                                      return (
                                        <>
                                          {rows.length > 0 ? rows : (
                                            <tr>
                                              <td colSpan={displayCols.length * 2 + 1} className="px-6 py-12 text-center text-slate-400">
                                                표시할 학생 데이터가 없습니다.
                                              </td>
                                            </tr>
                                          )}
                                          {rows.length > 0 && (
                                            <tr className="bg-indigo-900/20 border-t-2 border-indigo-500/30">
                                              <td className="px-3 py-3 border-r border-slate-700/50 text-center font-bold text-indigo-300">총 인원</td>
                                              {displayCols.map(c => (
                                                <td key={`total-${c.slot}-${c.col}`} colSpan={2} className="px-3 py-3 border-r border-slate-700/50 text-center font-bold text-indigo-300">
                                                  {colStudents[`${c.slot}-${c.col}`].length}명
                                                </td>
                                              ))}
                                              {emptyColCount > 0 && <td colSpan={emptyColCount * 2}></td>}
                                            </tr>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                  {changeActiveTab === "analysis" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <div className="flex items-center gap-4">
                            <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                              <FileText className="w-6 h-6 text-indigo-400" />
                              다년도 수강 내역 위계 및 분석
                            </h2>
                            <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50 text-xs font-medium mt-1">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/50 border border-amber-500"></span>
                              <span className="text-amber-200">학생 직접 변경자 (5단계 수동 신청 반영)</span>
                            </div>
                          </div>
                          <p className="text-slate-300 text-sm mt-1 mb-4 ml-8">
                            * 위계성 검사는 '수요조사' 탭의 2단계에서 설정한 위계 규칙을 공유하여 그대로 적용합니다.
                          </p>
                        </div>

                        <div className="flex items-center gap-4 -mt-4">
                          <button
                            onClick={handleExportStep6}
                            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-emerald-500/25 flex items-center gap-2"
                            disabled={step6Data.length === 0}
                          >
                            <Download className="w-4 h-4" />
                            엑셀 다운로드
                          </button>
                          <button
                            onClick={() => setShowOnlyApplicants(!showOnlyApplicants)}
                            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors flex items-center gap-2 ${
                              showOnlyApplicants
                                ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                                : "bg-slate-800/50 border-slate-700/50 text-white hover:text-white"
                            }`}
                          >
                            직접 변경자만 보기
                          </button>
                          <div className="flex bg-slate-800/50 p-1 rounded-xl">
                            <button
                              onClick={() => setChangeActiveGrade("grade2")}
                              className={`px-6 py-2 rounded-lg font-medium transition-all ${changeActiveGrade === "grade2"
                                  ? "bg-slate-700 text-white shadow"
                                  : "text-slate-300 hover:text-slate-200"
                                }`}
                            >
                              2학년
                            </button>
                            <button
                              onClick={() => setChangeActiveGrade("grade3")}
                              className={`px-6 py-2 rounded-lg font-medium transition-all ${changeActiveGrade === "grade3"
                                  ? "bg-slate-700 text-white shadow"
                                  : "text-slate-300 hover:text-slate-200"
                                }`}
                            >
                              3학년
                            </button>
                          </div>
                        </div>
                      </div>

                      {step6Data.length === 0 ? (
                        <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-8 text-center">
                          <p className="text-slate-300">선택하신 학년의 데이터가 아직 없습니다.</p>
                        </div>
                      ) : (
                        <div className="bg-slate-950/50 border border-slate-800 rounded-2xl overflow-hidden">
                          <div className="overflow-auto max-h-[650px] relative">
                            <table className="w-full text-sm text-left text-slate-300 border-collapse">
                              <thead className="text-xs text-slate-300 uppercase bg-slate-900 border-b border-slate-800">
                                <tr>
                                  <th rowSpan={2} className="px-2 py-2.5 whitespace-nowrap sticky top-0 left-0 z-40 bg-slate-900 min-w-[50px] max-w-[50px] border-r border-b border-slate-800 text-center align-middle">순번</th>
                                  <th rowSpan={2} className="px-2 py-2.5 whitespace-nowrap sticky top-0 left-[50px] z-40 bg-slate-900 min-w-[80px] max-w-[80px] border-r border-b border-slate-800 text-center align-middle">학번</th>
                                  <th rowSpan={2} className="px-2 py-2.5 whitespace-nowrap sticky top-0 left-[130px] z-40 bg-slate-900 min-w-[80px] max-w-[80px] border-r border-b border-slate-800/50 text-center shadow-[2px_0_5px_rgba(0,0,0,0.3)] align-middle">이름</th>
                                  <th rowSpan={2} className="px-2 py-2.5 text-center whitespace-nowrap sticky top-0 z-10 bg-slate-900 border-r border-b border-slate-800 align-middle">과거 이수 과목</th>
                                  <th colSpan={timeSlots[changeActiveGrade]?.length || 1} className="px-2 py-1 text-center whitespace-nowrap sticky top-0 z-10 bg-slate-900 border-r border-b border-slate-800 text-[11px] text-slate-400">2학기 과목</th>
                                  <th rowSpan={2} className="px-2 py-2.5 whitespace-nowrap sticky top-0 z-10 bg-slate-900 border-l border-b border-slate-800 text-center align-middle">기초과목</th>
                                  <th rowSpan={2} className="px-2 py-2.5 whitespace-nowrap sticky top-0 z-10 bg-slate-900 border-b border-slate-800 text-center align-middle">사회</th>
                                  <th rowSpan={2} className="px-2 py-2.5 whitespace-nowrap sticky top-0 z-10 bg-slate-900 border-b border-slate-800 text-center align-middle">과학</th>
                                  <th rowSpan={2} className="px-2 py-2.5 whitespace-nowrap sticky top-0 z-10 bg-slate-900 border-b border-slate-800 align-middle">비고(중복/위계)</th>
                                </tr>
                                <tr>
                                  {timeSlots[changeActiveGrade]?.map(slot => (
                                    <th key={slot} className="px-2 py-1.5 text-center whitespace-nowrap sticky top-[25px] z-10 bg-slate-900 border-r border-b border-slate-800 text-indigo-400">{slot}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(showOnlyApplicants ? step6Data.filter(row => adjustmentLog[row.id]?.some(l => l.status === 'success' && l.source === 'applicant')) : step6Data).map((row, idx) => {
                                  const hasChanges = adjustmentLog[row.id] && adjustmentLog[row.id].some(l => l.status === 'success' && l.source === 'applicant');
                                  const highlightClass = hasChanges ? "bg-amber-500/10 text-amber-300" : "bg-slate-950 text-white";
                                  const nameHighlightClass = hasChanges ? "bg-amber-500/10 text-amber-300" : "bg-slate-950 text-white";
                                  const hoverClass = hasChanges ? "group-hover:bg-amber-500/20" : "group-hover:bg-slate-900";
                                  return (
                                  <tr key={idx} className="group border-b border-slate-800/50 hover:bg-slate-900/50">
                                    <td className="px-2 py-2.5 whitespace-nowrap sticky left-0 z-20 bg-slate-950 group-hover:bg-slate-900 min-w-[50px] max-w-[50px] border-r border-slate-800 text-center">{idx + 1}</td>
                                    <td className={`px-2 py-2.5 font-medium whitespace-nowrap sticky left-[50px] z-20 min-w-[80px] max-w-[80px] border-r border-slate-800 text-center ${highlightClass} ${hoverClass}`}>{row.id}</td>
                                    <td className={`px-2 py-2.5 font-medium whitespace-nowrap sticky left-[130px] z-20 min-w-[80px] max-w-[80px] border-r border-slate-800/50 text-center shadow-[2px_0_5px_rgba(0,0,0,0.3)] ${nameHighlightClass} ${hoverClass}`}>{row.name}</td>
                                    <td className="px-2 py-2.5 border-r border-slate-800 max-w-[250px] text-xs leading-relaxed break-words" title={row.completedBefore.join(", ")}>
                                      {row.completedBefore.length > 0 ? row.completedBefore.join(", ") : <span className="text-slate-600">-</span>}
                                    </td>
                                    {timeSlots[changeActiveGrade]?.map(slot => {
                                      const subject = row.currentSubjectsMap?.[slot] || "";
                                      const normS = (s: string) => s ? s.replace(/\s+/g, '').replace(/Ⅰ/g, 'I').replace(/Ⅱ/g, 'II').replace(/Ⅲ/g, 'III') : '';
                                      const isDuplicate = subject && row.duplicateSubjects?.some((d: string) => normS(d) === normS(subject));
                                      const isHierarchyViolation = subject && row.hierarchyViolations?.some((v: any) => normS(v.subject) === normS(subject) || normS(v.prereq) === normS(subject));
                                      
                                      let isChangedByApplicant = false;
                                      let debugInfo = "";
                                      if (adjustmentLog[row.id] && subject) {
                                          isChangedByApplicant = adjustmentLog[row.id].some(l => {
                                              if (l.status !== 'success' || l.source !== 'applicant') return false;
                                              const timeSlotsForGrade = timeSlots[changeActiveGrade] || [];
                                              let afterSubj = l.afterStr;
                                              let found = false;
                                              for (const ts of timeSlotsForGrade) {
                                                  if (l.afterStr.endsWith(`(${ts})`)) {
                                                      afterSubj = l.afterStr.slice(0, -(ts.length + 2));
                                                      found = true;
                                                      break;
                                                  }
                                              }
                                              if (!found) {
                                                  const match = l.afterStr.match(/^(.+)\(([^)]+)\)$/);
                                                  if (match) afterSubj = match[1];
                                              }
                                              const norm = (s: string) => s.replace(/\s+/g, '').replace(/Ⅰ/g, 'I').replace(/Ⅱ/g, 'II').replace(/Ⅲ/g, 'III');
                                              return norm(afterSubj) === norm(subject);
                                          });
                                      }

                                      let cellClass = "inline-block px-1.5 py-0.5 rounded text-xs ";
                                      if (isChangedByApplicant) {
                                          if (isHierarchyViolation) {
                                              cellClass += "bg-amber-500/20 text-cyan-400 font-black ring-1 ring-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.5)]";
                                          } else if (isDuplicate) {
                                              cellClass += "bg-amber-500/20 text-rose-400 font-black ring-1 ring-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]";
                                          } else {
                                              cellClass += "bg-amber-500/20 text-amber-300 font-bold ring-1 ring-amber-500/50";
                                          }
                                      } else {
                                          if (isHierarchyViolation) cellClass += "text-cyan-400 font-bold bg-cyan-400/10";
                                          else if (isDuplicate) cellClass += "text-yellow-400 font-bold bg-yellow-400/10";
                                          else cellClass += "bg-slate-800 text-slate-300";
                                      }

                                      return (
                                        <td key={slot} className="px-2 py-2.5 border-r border-slate-800 text-center">
                                          {subject ? (
                                              <span className={cellClass} title={debugInfo}>
                                                  {subject}
                                              </span>
                                          ) : (
                                              <span className="text-slate-600">-</span>
                                          )}
                                        </td>
                                      );
                                    })}
                                    <td className="px-2 py-2.5 text-center text-indigo-400 font-medium whitespace-nowrap">{row.basicCount}</td>
                                    <td className="px-2 py-2.5 text-center text-rose-400 font-medium whitespace-nowrap">{row.socialCount}</td>
                                    <td className="px-2 py-2.5 text-center text-emerald-400 font-medium whitespace-nowrap">{row.scienceCount}</td>
                                    <td className="px-2 py-2.5 font-medium flex flex-col gap-1 whitespace-nowrap">
                                      {row.basicCount >= 10 && <span className="text-rose-400 whitespace-nowrap">기초과목 최대학점 초과</span>}
                                      {row.duplicateSubjects?.length > 0 && <span className="text-yellow-400 whitespace-nowrap">중복선택: {row.duplicateSubjects.join(", ")}</span>}
                                      {row.hierarchyViolations?.map((v: any, i: number) => (
                                        <span key={i} className="text-cyan-400 text-xs whitespace-nowrap">
                                          {v.message}
                                        </span>
                                      ))}
                                    </td>
                                  </tr>
                                );})}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {changeActiveTab === "riroschool" && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                          <Download className="w-6 h-6 text-indigo-400" />
                          리로스쿨 업로드용 파일 다운로드
                        </h2>
                      </div>
                      
                      <div className="bg-slate-800/30 rounded-2xl p-6 md:p-10 border border-slate-700/50">
                        <div className="flex flex-col items-center justify-center text-center space-y-4 max-w-2xl mx-auto">
                          <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-full flex items-center justify-center mb-2">
                            <FileIcon className="w-8 h-8 text-indigo-400" />
                          </div>
                          <h3 className="text-xl font-bold text-white">
                            최종 선택과목 데이터 엑셀 다운로드
                          </h3>
                          <p className="text-slate-300 text-sm md:text-base leading-relaxed">
                            2단계에서 업로드했던 원본 엑셀 파일(sample3)의 형태와 서식을 그대로 유지한 채,<br />
                            학생들의 변경 신청 결과에 맞춰 선택과목 알파벳 마킹(A, B, C, D)만 정확히 최신화하여 다운로드합니다.
                          </p>

                          <div className="flex gap-4 mt-8 pt-4">
                            <button
                              onClick={() => handleDownloadRiroschool('grade2')}
                              disabled={!sampleRawData['grade2']}
                              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg ${
                                sampleRawData['grade2'] 
                                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 hover:scale-105' 
                                  : 'bg-slate-800 text-white cursor-not-allowed border border-slate-700'
                              }`}
                            >
                              <Download className="w-5 h-5" />
                              2학년 리로스쿨 엑셀 다운로드
                            </button>
                            <button
                              onClick={() => handleDownloadRiroschool('grade3')}
                              disabled={!sampleRawData['grade3']}
                              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg ${
                                sampleRawData['grade3'] 
                                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 hover:scale-105' 
                                  : 'bg-slate-800 text-white cursor-not-allowed border border-slate-700'
                              }`}
                            >
                              <Download className="w-5 h-5" />
                              3학년 리로스쿨 엑셀 다운로드
                            </button>
                          </div>
                          
                          {(!sampleRawData['grade2'] && !sampleRawData['grade3']) && (
                            <p className="text-rose-400 text-sm mt-4">
                              ⚠️ 2단계 탭에서 원본 파일을 먼저 업로드해야 다운로드가 가능합니다.
                            </p>
                          )}
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
      {/* Example Modal */}
      {isExampleModalOpen && (
        <div style={{ zIndex: 99999 }} className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-[80vw] flex flex-col my-auto max-h-[95vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-slate-800/80 shrink-0">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                💡 올바른 엑셀 시수 입력 예시
              </h3>
              <button onClick={() => setIsExampleModalOpen(false)} className="text-slate-300 hover:text-white transition-colors p-2 rounded-full hover:bg-slate-800">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 md:p-6 overflow-y-auto flex-1 bg-slate-950/50">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="bg-slate-950 rounded-xl p-4 border-2 border-rose-500/30 flex-1">
                  <h4 className="text-rose-400 font-bold mb-3 flex items-center gap-2 text-base">
                    <span>❌ 잘못된 예 (수정 전)</span>
                  </h4>
                  <p className="text-sm text-slate-300 mb-4">동일한 선택과목군에서 4과목 선택하는 경우 편제표</p>
                  <div className="bg-slate-900 rounded-lg border border-slate-800 flex justify-center items-center p-4">
                     <img src="/excel-wrong.png" alt="잘못된 엑셀 입력 예시" className="w-auto h-auto max-w-full max-h-[35vh] object-contain shadow-lg rounded" />
                  </div>
                </div>
                <div className="bg-slate-950 rounded-xl p-4 border-2 border-emerald-500/30 flex-1">
                  <h4 className="text-emerald-400 font-bold mb-3 flex items-center gap-2 text-base">
                    <span>⭕ 올바른 예 (수정 후)</span>
                  </h4>
                  <p className="text-sm text-slate-300 mb-4">동일한 선택과목군에 모두 같은 학점을 입력하고 업로드 하세요</p>
                  <div className="bg-slate-900 rounded-lg border border-slate-800 flex justify-center items-center p-4">
                     <img src="/excel-right.png" alt="올바른 엑셀 입력 예시" className="w-auto h-auto max-w-full max-h-[35vh] object-contain shadow-lg rounded" />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 md:p-6 border-t border-slate-800/80 flex justify-end shrink-0 bg-slate-900">
              <button onClick={() => setIsExampleModalOpen(false)} className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-colors shadow-lg">
                확인 및 닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}