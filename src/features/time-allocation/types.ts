// 선택과목 타임(구획) 배정 — 도메인 타입.
// prototypes/time-allocation/public/app.js 의 전역 `state` 를 직렬화 가능한 형태로 옮긴 것입니다.
// (배열/레코드만 사용 — Set 은 순수 함수 내부에서만 임시로 씁니다.)

import type { GradeKey } from "../../types";

export type { GradeKey };

/** 첫 헤더 행의 "택N" 그룹. 앱 데이터 경로에서는 pick 을 모르므로 0 입니다. */
export interface RosterGroup {
  name: string;
  pick: number;
  cols: number[]; // subjects 인덱스
}

export interface RosterSubject {
  idx: number;
  name: string;
  group: number; // groups 인덱스
  count: number; // 신청 인원
  col: number; // TSV 원본 열 위치(앱 데이터 경로는 순번). 1·2학기 동명 과목을 열로 구분합니다.
  semester?: string; // 앱 데이터 경로에서만 채움("1학기"/"2학기")
}

export interface RosterStudent {
  no: string;
  id: string; // 학번
  name: string;
  classNum?: string; // 반 라벨(앱 데이터 경로는 명시, TSV 경로는 학번에서 유도)
  cnt: number; // "과목수" 열(없으면 0) — 붙여넣기 누락 검증용
  choices: number[]; // subjects 인덱스, 오름차순
}

export interface RosterModel {
  groups: RosterGroup[];
  subjects: RosterSubject[];
  students: RosterStudent[];
  /** 과목수 열과 실제 선택 수가 다른 학생이 있을 때의 경고 문구(붙여넣기 경로). */
  warning?: string;
}

/** 반 고정 공통과목 한 줄. band 가 같은 과목끼리 한 타임을 시수로 나눠 씁니다. */
export interface CommonSubject {
  name: string;
  credits: number;
  teachers: number;
  band: number;
}

export interface CommonConfig {
  on: boolean;
  hours: number; // 타임 1개의 시수
  subjects: CommonSubject[];
}

export type TimeAllocSource = "paste" | "main";

/** 학기 구분이 없는 과목(붙여넣기 경로 전체, 본조사 연동의 연간 과목)의 설정 키. */
export const NO_SEMESTER_KEY = "__all__";

/** 과목이 속한 "학기 설정" 키. semester 가 없으면(붙여넣기 경로) 전부 같은 키. */
export function semesterKeyOf(subj: RosterSubject): string {
  return subj.semester ?? NO_SEMESTER_KEY;
}

/**
 * 학기(1학기/2학기/구분없음) 별로 따로 두는 설정. 1학기·2학기 배정이 서로 완전히
 * 독립이므로(같은 타임을 겹쳐 써도 충돌 아님), 정원·인원초과 허용·선택과목 타임 수·
 * 반 고정 공통과목도 학기마다 다르게 잡을 수 있어야 합니다.
 */
export interface SemesterSettings {
  cap: number; // 학급당 인원
  allowOver: boolean;
  /** "선택과목 타임 수"(수동 입력). 이 학기의 전체 타임 수 = 이 값 + 이 학기 구획 수. */
  numElectiveTimes: number;
  common: CommonConfig;
  /**
   * 반 고정 공통과목을 최대한 여러 타임에 나눠("spread", 기본값) 배치할지, 교사 수까지
   * 꽉 채워 적은 타임에 뭉쳐("pack") 배치할지. 나눠 배치하면 선택과목 쪽 배정 최적화가
   * 미배정을 낼 수 있어서(모든 타임이 조금씩 막히므로), ① 배정 최적화가 spread로 먼저
   * 시도해보고 미배정이 남으면 자동으로 이 값을 pack으로 바꿔 다시 시도합니다
   * (lib/bands.ts computeFixedBands, hooks/useTimeAllocation.ts runOptimize 참고).
   */
  bandMode?: "spread" | "pack";
}

export function defaultCommonConfig(): CommonConfig {
  return {
    on: true,
    hours: 3,
    subjects: [
      { name: "3학점 과목", credits: 3, teachers: 2, band: 0 },
      { name: "2학점 과목", credits: 2, teachers: 2, band: 1 },
      { name: "1학점 과목", credits: 1, teachers: 8, band: 1 },
    ],
  };
}

export function defaultSemesterSettings(): SemesterSettings {
  return { cap: 29, allowOver: false, numElectiveTimes: 8, common: defaultCommonConfig() };
}

/** 학기 하나의 반 고정 공통과목 설정 + 그 결과(구획별 타임 고정). lib/gridModel, lib/studentRows 에서 씁니다. */
export interface SemesterBandInfo {
  common: CommonConfig;
  bandTimes: Array<Record<string, number>>;
}

/** 학년 한 개분의 전체 상태(프로젝트 JSON 에 학년별로 저장됩니다). */
export interface TimeAllocGradeState {
  rawText: string;
  roster: RosterModel | null;
  source: TimeAllocSource | null;
  startLetter: number; // 0=A. 타임 축은 학기 공통이라(같은 문자를 재사용) 이건 공유값.
  /** semesterKeyOf() 결과 → 그 학기의 설정. */
  settingsBySemester: Record<string, SemesterSettings>;
  selected: boolean[]; // 과목 idx 별 배정 대상 여부
  sections: number[]; // 과목 idx 별 분반 수
  /** 과목 idx → 강제 정원. "인원설정 고정" 체크 시 채워지며 자동 재조정 대상에서 빠집니다. */
  fixedCap: Record<number, number>;
  placement: number[][]; // 과목 idx → 타임 idx 목록
  confirmed: boolean;
}

/** runAssign 결과. 저장하지 않고 훅 상태로만 들고 있습니다. */
export interface Assignment {
  byStudent: Array<Map<number, number>>; // 학생 → (과목 idx → 타임 idx)
  unassigned: number[][]; // 학생 → 배정 못 한 과목 idx 목록
  load: number[][]; // 과목 idx → 타임별 인원
}

export function emptyGradeState(): TimeAllocGradeState {
  return {
    rawText: "",
    roster: null,
    source: null,
    startLetter: 0,
    settingsBySemester: { [NO_SEMESTER_KEY]: defaultSemesterSettings() },
    selected: [],
    sections: [],
    fixedCap: {},
    placement: [],
    confirmed: false,
  };
}

export const ALL_GRADE_KEYS: GradeKey[] = ["pre1", "grade1", "grade2"];
