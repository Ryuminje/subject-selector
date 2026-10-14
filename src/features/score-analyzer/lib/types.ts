// 성적 분석기에서 쓰는 자료 모양. 성적통지표 PDF 한 쪽 = Report 하나(학생 1명, 시험 1회).

export type AreaKey = "국어" | "수학" | "영어" | "한국사" | "탐구1" | "탐구2";

export const AREA_ORDER: AreaKey[] = ["국어", "수학", "영어", "한국사", "탐구1", "탐구2"];

export interface AreaScore {
  area: AreaKey;
  /** 화면에 보이는 과목 이름(예: 수학(미적분), 물리학I) */
  subject: string;
  maxScore: number | null;
  /** 원점수 */
  raw: number | null;
  range: string | null;
  /** 표준점수. 영어·한국사는 통지표에 없습니다. */
  standard: number | null;
  classRank: string | null;
  schoolRank: string | null;
  percentile: number | null;
  grade: number | null;
  takers: number | null;
}

export interface Report {
  /** 시험 구분: "2026-3-3" (연도-월-학년) */
  examKey: string;
  examTitle: string;
  year: number;
  month: number;
  level: number;
  takenOn: string;
  school: string;
  classNo: number;
  num: number;
  name: string;
  areas: AreaScore[];
}

export const studentKey = (r: Pick<Report, "level" | "classNo" | "num" | "name">) =>
  `${r.level}-${r.classNo}-${r.num}-${r.name}`;

export const examLabel = (r: Pick<Report, "year" | "month">) => `${r.year}년 ${r.month}월`;
