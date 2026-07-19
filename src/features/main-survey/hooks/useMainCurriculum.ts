import { useState } from "react";
import * as XLSX from "xlsx-js-style";
import type {
  DesignatedSubject,
  GradeKey,
  HierarchyRule,
  ParsedCurriculumSubject,
  SelectedSubjectHours,
  SubjectCategory,
  SubjectMap,
} from "../../../types";

export function useMainCurriculum(activeGrade: GradeKey) {
  const [parsedCurriculumList, setParsedCurriculumList] = useState<{ [key in GradeKey]: ParsedCurriculumSubject[] }>({ pre1: [], grade1: [], grade2: [] });
  const [subjectMap, setSubjectMap] = useState<{ [key in GradeKey]: SubjectMap }>({ pre1: {}, grade1: {}, grade2: {} });
  const [isCurriculumParsed, setIsCurriculumParsed] = useState<{ [key in GradeKey]: boolean }>({ pre1: false, grade1: false, grade2: false });
  const [hierarchyRules, setHierarchyRules] = useState<{ [key in GradeKey]: HierarchyRule[] }>({ pre1: [], grade1: [], grade2: [] });
  const [designatedSubjects, setDesignatedSubjects] = useState<{ [key in GradeKey]: DesignatedSubject[] }>({ pre1: [], grade1: [], grade2: [] });
  const [selectedSubjectHours, setSelectedSubjectHours] = useState<{ [key in GradeKey]: SelectedSubjectHours[] }>({ pre1: [], grade1: [], grade2: [] });
  const [editingDetailedCategory, setEditingDetailedCategory] = useState<{ grade: GradeKey, index: number } | null>(null);
  const [detailedCategoryEditValue, setDetailedCategoryEditValue] = useState("");

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

  return {
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
  };
}
