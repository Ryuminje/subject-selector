// 본조사(수강신청) 탭 스냅샷 → RosterModel.
// 같은 페이지에서 모든 탭이 마운트되므로 TimeAllocationTab 이 window.getMainBackup() 스냅샷을
// 넘겨주면 여기서 타임 배정용 로스터로 변환합니다(이 코드베이스의 기존 교차 탭 계약).

import type { GradeKey, ProcessedStudent, SubjectStat } from "../../../types";
import type { RosterGroup, RosterModel, RosterStudent, RosterSubject } from "../types";

export interface MainSurveySnapshot {
  processedData?: Partial<Record<GradeKey, ProcessedStudent[]>>;
  subjectStats?: Partial<Record<GradeKey, SubjectStat[]>>;
  manualStep5Classes?: Record<string, string>;
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

  // 그룹: subjectStats 의 group 문자열을 등장 순서대로
  const groups: RosterGroup[] = [];
  const groupIndex = new Map<string, number>();
  const subjects: RosterSubject[] = [];
  const subjectKey = new Map<string, number>(); // `${normSemester}|${normName}` → subj idx
  const sectionHints: number[] = [];

  stats.forEach((st, i) => {
    if (!groupIndex.has(st.group)) {
      groupIndex.set(st.group, groups.length);
      groups.push({ name: st.group, pick: 0, cols: [] });
    }
    const g = groupIndex.get(st.group)!;
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

    const manualKey = `${grade}_${st.semester}_${st.subject}`;
    const raw = snap.manualStep5Classes?.[manualKey];
    const n = raw !== undefined ? parseInt(raw, 10) : NaN;
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

  // count 는 subjectStats.applicants 를 신뢰(이미 본조사에서 집계된 값)
  return {
    roster: { groups, subjects, students: rosterStudents },
    sectionHints,
  };
}
