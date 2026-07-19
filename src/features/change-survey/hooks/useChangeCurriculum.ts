import { useCallback, useState } from "react";
import * as XLSX from "xlsx-js-style";
import type { GradeKey, HierarchyRule, ParsedCurriculumSubject, SubjectCategory, SubjectMap } from "../../../types";
import type { ChangeGradeKey } from "../types";

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

export function useChangeCurriculum(changeActiveGrade: ChangeGradeKey) {
  const [changeParsedCurriculumList, setChangeParsedCurriculumList] = useState<Record<string, ParsedCurriculumSubject[]>>({});
  const [changeSubjectMap, setChangeSubjectMap] = useState<Record<string, SubjectMap>>({});
  const [changeIsCurriculumParsed, setChangeIsCurriculumParsed] = useState<Record<string, boolean>>({});
  const [changeHierarchyRules, setChangeHierarchyRules] = useState<Record<string, HierarchyRule[]>>({});

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

  return {
    changeParsedCurriculumList,
    setChangeParsedCurriculumList,
    changeSubjectMap,
    setChangeSubjectMap,
    changeIsCurriculumParsed,
    setChangeIsCurriculumParsed,
    changeHierarchyRules,
    setChangeHierarchyRules,
    handleChangeCurriculumUpload,
    getChangeSubjectCategory,
  };
}
