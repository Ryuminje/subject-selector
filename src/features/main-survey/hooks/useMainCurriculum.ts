import { useState } from "react";
import type { GradeKey } from "../../../types";
import { useYearData } from "../../year-data/YearDataContext";

// 편성표·위계·지정/선택 시수는 수요조사·본조사·선택과목 변경 탭이 같이 쓰는 공유 저장소(YearDataContext)에 있습니다.
// 학년마다 편성표가 다르므로 업로드는 지금 보는 학년에만 적용되고, 그 학년은 어느 탭에서 올려도 모든 탭이 같이 씁니다
// (예전에는 같은 학년 편성표를 탭마다 따로 올렸음).
export function useMainCurriculum(activeGrade: GradeKey) {
  const {
    parsedCurriculumList, setParsedCurriculumList,
    subjectMap, setSubjectMap,
    isCurriculumParsed, setIsCurriculumParsed,
    hierarchyRules, setHierarchyRules,
    designatedSubjects, setDesignatedSubjects,
    selectedSubjectHours, setSelectedSubjectHours,
    applyCurriculumFile,
    setCategoryOverride,
  } = useYearData();
  const [editingDetailedCategory, setEditingDetailedCategory] = useState<{ grade: GradeKey, index: number } | null>(null);
  const [detailedCategoryEditValue, setDetailedCategoryEditValue] = useState("");

  const handleCurriculumUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      if (typeof data !== "string" || !data) return;
      applyCurriculumFile(data, activeGrade);
      alert("교육과정 엑셀 파일이 성공적으로 업로드되었습니다! (이 학년의 편성표는 다른 탭에도 같이 반영됩니다)");
    };
    reader.readAsBinaryString(file);
  };

  const handleDetailedCategoryUpdate = (grade: GradeKey, index: number, subjectName: string, newDetailedCategory: string) => {
    if (!newDetailedCategory.trim()) {
      setEditingDetailedCategory(null);
      return;
    }

    // 편성표·시수표의 같은 과목 교과군을 한 번에 고친다(입학년도 저장소의 덮어쓰기 값으로 보관)
    void index;
    setCategoryOverride(grade, subjectName, newDetailedCategory);

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
