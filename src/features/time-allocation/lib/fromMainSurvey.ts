// 본조사(수강신청) 탭 스냅샷 → RosterModel.
// 같은 페이지에서 모든 탭이 마운트되므로 TimeAllocationTab 이 window.getMainBackup() 스냅샷을
// 넘겨주면 여기서 타임 배정용 로스터로 변환합니다(이 코드베이스의 기존 교차 탭 계약).

import type { GradeKey, ProcessedStudent, SubjectStat } from "../../../types";
import type { RosterGroup, RosterModel, RosterStudent, RosterSubject } from "../types";
import { getClassRecommendation } from "../../main-survey/hooks/useMainClassSummary";

export interface MainSurveySnapshot {
  processedData?: Partial<Record<GradeKey, ProcessedStudent[]>>;
  subjectStats?: Partial<Record<GradeKey, SubjectStat[]>>;
  manualStep5Classes?: Record<string, string>;
  /** 5단계(과목 개설 여부) 자동 추천이 기준으로 삼는 학급당 인원. 없으면 25명(ClassOpeningStep 기본값과 동일). */
  standardClassSize?: Partial<Record<GradeKey, number>>;
  /** 업로드했던 원본 수강신청 엑셀(data URL) — 리로스쿨용 내보내기가 이걸 그대로 다시 엽니다. */
  uploadedFiles?: Partial<Record<GradeKey, { name: string; size: number; data: string } | null>>;
}

export interface MainSurveyRosterResult {
  roster: RosterModel;
  /** 과목 idx 별 분반 수 힌트. -1 이면 힌트 없음(호출부에서 기본값 계산). */
  sectionHints: number[];
  error?: string;
}

const normalize = (s: string) => s.replace(/\s+/g, "").trim();

/** ProcessedStudent 의 학기별 배열 이름 → subjectStats 의 semester 라벨. */
function semesterOfArray(which: "s1" | "s12" | "s2"): string {
  return which === "s1" ? "1학기" : which === "s2" ? "2학기" : "1~2학기";
}

export function rosterFromMainSurvey(
  snap: MainSurveySnapshot,
  grade: GradeKey,
): MainSurveyRosterResult {
  const stats: SubjectStat[] = snap.subjectStats?.[grade] ?? [];
  const students: ProcessedStudent[] = snap.processedData?.[grade] ?? [];
  const empty: RosterModel = { groups: [], subjects: [], students: [] };
  if (!stats.length || !students.length) {
    return {
      roster: empty,
      sectionHints: [],
      error:
        "본조사 탭에 이 학년의 처리된 학생 데이터/과목 통계가 없습니다. 본조사 탭에서 파일을 먼저 올리세요.",
    };
  }

  // 그룹: subjectStats 의 group 문자열을 등장 순서대로 (나중에 학기 우선으로 재정렬)
  const groups: RosterGroup[] = [];
  const groupMeta: { label: string; semester: string }[] = []; // 재정렬용
  const groupIndex = new Map<string, number>();
  const subjects: RosterSubject[] = [];
  const subjectKey = new Map<string, number>(); // `${normSemester}|${normName}` → subj idx
  const sectionHints: number[] = [];

  stats.forEach((st, i) => {
    // 같은 교과군이라도 1학기/2학기는 서로 다른 택N 제약이라 그룹을 분리합니다.
    const groupKey = `${st.group}|${st.semester}`;
    if (!groupIndex.has(groupKey)) {
      groupIndex.set(groupKey, groups.length);
      groups.push({ name: `${st.group} · ${st.semester}`, pick: 0, cols: [] });
      groupMeta.push({ label: st.group, semester: st.semester });
    }
    const g = groupIndex.get(groupKey)!;
    const idx = subjects.length;
    subjects.push({
      idx,
      name: st.subject,
      group: g,
      count: st.applicants,
      col: i,
      semester: st.semester,
    });
    groups[g].cols.push(idx);
    const semNorm = normalize(st.semester).replace("~", "").replace("-", "");
    subjectKey.set(`${semNorm}|${normalize(st.subject)}`, idx);

    // 5단계(과목 개설 여부)에 실제로 표시되는 값과 같은 규칙으로 뽑습니다 — 수동으로
    // 고친 값이 있으면 그 값, 없으면 자동 추천값(ClassOpeningStep의 baseRemark)을 그대로.
    // "폐강"/"논의"/"2~3" 같은 범위 표기는 확정된 반 수가 아니라 Number()가 NaN이 돼
    // 자동으로 힌트 없음(-1) 처리됩니다(ClassOpeningStep의 "확정" 판정과 동일 규칙).
    const manualKey = `${grade}_${st.semester}_${st.subject}`;
    const baseRemark = getClassRecommendation(st.applicants, snap.standardClassSize?.[grade] ?? 25);
    const raw = snap.manualStep5Classes?.[manualKey] ?? baseRemark;
    const n = Number(raw);
    sectionHints[idx] = Number.isFinite(n) && n > 0 ? n : -1;
  });

  // 학생: 학기별 선택 이름 → 과목 idx
  const findIdx = (name: string, which: "s1" | "s12" | "s2"): number | undefined => {
    const semNorm = normalize(semesterOfArray(which)).replace("~", "");
    const direct = subjectKey.get(`${semNorm}|${normalize(name)}`);
    if (direct !== undefined) return direct;
    // 학기 라벨이 정확히 안 맞을 수 있어 이름만으로도 한 번 더
    for (const s of subjects) if (normalize(s.name) === normalize(name)) return s.idx;
    return undefined;
  };

  const rosterStudents: RosterStudent[] = students.map((p, i) => {
    const chosen = new Set<number>();
    (p.semester1 ?? []).forEach((n) => {
      const x = findIdx(n, "s1");
      if (x !== undefined) chosen.add(x);
    });
    (p.semester1_2 ?? []).forEach((n) => {
      const x = findIdx(n, "s12");
      if (x !== undefined) chosen.add(x);
    });
    (p.semester2 ?? []).forEach((n) => {
      const x = findIdx(n, "s2");
      if (x !== undefined) chosen.add(x);
    });
    const choices = [...chosen].sort((a, b) => a - b);
    return {
      no: String(p.num || i + 1),
      id: p.studentId,
      name: p.name,
      classNum: p.classNum,
      cnt: 0, // 본조사 경로엔 "과목수" 열이 없음 — 누락 검증은 붙여넣기 전용
      choices,
    };
  });

  // 헤더 정렬: 학기가 1순위, 교과군 문자(A/B/C...)는 2순위가 되도록 그룹·과목 순서를 재배열.
  const semesterRank = (s: string) => (s.startsWith("1학기") ? 0 : s.startsWith("2학기") ? 1 : 2);
  const order = groups
    .map((_, i) => i)
    .sort((a, b) => {
      const r = semesterRank(groupMeta[a].semester) - semesterRank(groupMeta[b].semester);
      return r !== 0 ? r : groupMeta[a].label < groupMeta[b].label ? -1 : 1;
    });

  const oldToNewIdx = new Map<number, number>();
  const newGroups: RosterGroup[] = [];
  const newSubjects: RosterSubject[] = [];
  order.forEach((oldGroupIdx) => {
    const newGroupIdx = newGroups.length;
    const newCols: number[] = [];
    groups[oldGroupIdx].cols.forEach((oldSubjIdx) => {
      const newIdx = newSubjects.length;
      oldToNewIdx.set(oldSubjIdx, newIdx);
      newSubjects.push({ ...subjects[oldSubjIdx], idx: newIdx, group: newGroupIdx, col: newIdx });
      newCols.push(newIdx);
    });
    newGroups.push({ ...groups[oldGroupIdx], cols: newCols });
  });
  const newSectionHints: number[] = [];
  oldToNewIdx.forEach((newIdx, oldIdx) => (newSectionHints[newIdx] = sectionHints[oldIdx]));
  const remappedStudents = rosterStudents.map((st) => ({
    ...st,
    choices: st.choices.map((oldIdx) => oldToNewIdx.get(oldIdx)!).sort((a, b) => a - b),
  }));

  // count 는 subjectStats.applicants 를 신뢰(이미 본조사에서 집계된 값)
  return {
    roster: { groups: newGroups, subjects: newSubjects, students: remappedStudents },
    sectionHints: newSectionHints,
  };
}
