import { useCallback, useMemo } from "react";
import type { GradeKey, HierarchyRule, ParsedCurriculumSubject, SubjectCategory, SubjectMap } from "../../../types";
import type { ChangeGradeKey } from "../types";
import { useYearData, type PerGrade } from "../../year-data/YearDataContext";

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

/**
 * 공유 저장소(수요조사·본조사 기준 학년 키)를 선택과목 변경 탭의 학년 키로 보여 주는 어댑터.
 * 변경 탭의 grade2/grade3(= 내년 2·3학년)는 공유 저장소의 grade1/grade2 와 같은 학년이라 값이 그대로 같습니다.
 * set 쪽은 변경 탭이 주는 키(grade2/grade3)만 되써서, 없는 키는 건드리지 않습니다.
 */
function useChangeView<T>(shared: PerGrade<T>, setShared: React.Dispatch<React.SetStateAction<PerGrade<T>>>) {
  const view = useMemo<Record<string, T>>(() => ({ grade2: shared.grade1, grade3: shared.grade2 }), [shared]);
  const setView = useCallback(
    (u: React.SetStateAction<Record<string, T>>) =>
      setShared((prev) => {
        const cur: Record<string, T> = { grade2: prev.grade1, grade3: prev.grade2 };
        const next = typeof u === "function" ? (u as (p: Record<string, T>) => Record<string, T>)(cur) : u;
        return { ...prev, grade1: next.grade2 ?? prev.grade1, grade2: next.grade3 ?? prev.grade2 };
      }),
    [setShared],
  );
  return [view, setView] as const;
}

export function useChangeCurriculum(changeActiveGrade: ChangeGradeKey) {
  const yd = useYearData();
  const [changeParsedCurriculumList, setChangeParsedCurriculumList] = useChangeView<ParsedCurriculumSubject[]>(yd.parsedCurriculumList, yd.setParsedCurriculumList);
  const [changeSubjectMap, setChangeSubjectMap] = useChangeView<SubjectMap>(yd.subjectMap, yd.setSubjectMap);
  const [changeIsCurriculumParsed, setChangeIsCurriculumParsed] = useChangeView<boolean>(yd.isCurriculumParsed, yd.setIsCurriculumParsed);
  const [changeHierarchyRules, setChangeHierarchyRules] = useChangeView<HierarchyRule[]>(yd.hierarchyRules, yd.setHierarchyRules);

  const handleChangeCurriculumUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      if (typeof data !== "string" || !data) return;
      // 변경 탭의 grade2/grade3 는 공유 저장소의 grade1/grade2 와 같은 학년
      yd.applyCurriculumFile(data, changeActiveGrade === "grade2" ? "grade1" : "grade2");
      alert("교육과정 엑셀 파일이 성공적으로 업로드되었습니다! (이 학년의 편성표는 다른 탭에도 같이 반영됩니다)");
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
