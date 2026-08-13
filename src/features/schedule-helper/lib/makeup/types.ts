// 보강원(수업 교체·보강 신청서) 작성에 쓰는 타입들.
//
// 용어를 먼저 맞춰둡니다 — 이 둘은 문서에 다르게 적힙니다.
//   교체(swap) : 서로 시간을 맞바꿉니다. 두 사람 시수가 그대로라 문서에 **두 줄**이 나갑니다.
//                ① 내 수업을 상대가  ② 상대 수업을 내가
//   보강(sub)  : 상대가 내 수업을 대신 들어갑니다. 맞바꿈이 없어 **한 줄**입니다.

export type MakeupKind = "swap" | "sub";

/** 시간표 칸 하나 = 수업 하나 */
export interface ClassSlot {
  day: string;
  period: number;
  grade: string;
  classNum: string;
  subject: string;
}

/**
 * 트레이에 담긴 한 건. "이 수업을 이 선생님에게 (교체/보강으로) 부탁한다".
 *
 * 날짜는 여기 담지 않고 문서를 만들 때 계산합니다 — 시간표에는 요일만 있고
 * 달력 날짜가 없어서, 사용자가 고른 기준일이 속한 주에서 요일에 맞춰 뽑아냅니다.
 * 자동 계산이 틀린 경우(다음 주로 미룬 교체 등)를 위해 항목별로 덮어쓸 수 있습니다.
 */
export interface MakeupEntry {
  id: string;
  kind: MakeupKind;
  /** 결강하는(수업을 못 하는) 교사 */
  absentTeacher: string;
  /** 결강하는 수업 */
  absent: ClassSlot;
  /** 대신 들어가는 교사 */
  partnerTeacher: string;
  /** 교체일 때만 — 결강 교사가 대신 가게 되는 상대의 수업 */
  exchange?: ClassSlot;
  /** 자동 계산 날짜를 사용자가 고친 값 (YYYY-MM-DD) */
  absentDateOverride?: string;
  exchangeDateOverride?: string;
}

/** 문서에 실제로 한 줄로 찍히는 내용 */
export interface MakeupRow {
  kindLabel: "교체" | "보강";
  date: string;
  weekday: string;
  period: number;
  className: string;
  subject: string;
  /** 원래 그 수업을 맡은 교사 */
  fromTeacher: string;
  /** 그 시간에 실제로 들어가는 교사 */
  toTeacher: string;
}

/** 인쇄 페이지로 넘기는 문서 한 장 */
export interface MakeupDoc {
  schoolName: string;
  /** 작성자 = 결강 교사 */
  writerTeacher: string;
  /** 결강 주간의 기준일 (YYYY-MM-DD) */
  baseDate: string;
  reason: string;
  rows: MakeupRow[];
  /** 문서를 만든 시각 (ISO) */
  createdAt: string;
}

/** 인쇄 페이지에 문서를 넘길 때 쓰는 sessionStorage 키 */
export const MAKEUP_DOC_KEY = "schedule-helper:makeup-doc";
