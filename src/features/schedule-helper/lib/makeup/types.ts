// 보강원("수업 교체 및 동과 보강 계획서") 작성에 쓰는 타입들.
//
// **모양의 기준은 학교에서 받은 실제 서식입니다.** 서식을 먼저 읽고 나서 이 파일을 보세요.
// 표 한 줄이 무엇을 뜻하는지가 서식에서 정해지고, 그게 이 타입들을 그대로 결정합니다.
//
//   ┌────────┬───────┬──────┬──────────────────────────┬──────────────┐
//   │ 교과명 │ 학 반 │ 교 시│  수업 교체의 경우만 기재  │ 교체 및 동과 │
//   │        │       │      ├─────────────┬────────────┤ 보강 교사명  │
//   │        │       │      │교체대상 교시│교체대상 교과│              │
//   └────────┴───────┴──────┴─────────────┴────────────┴──────────────┘
//
// 왼쪽 세 칸이 **내가 못 하는 수업**, 가운데 두 칸이 **교체라면 내가 대신 갈 상대 수업**,
// 오른쪽이 **대신 들어와 주는 선생님**입니다.
//
// ⚠️ 그래서 **교체도 한 줄입니다.** 예전에는 교체를 두 줄(① 내 수업을 상대가 ② 상대 수업을
// 내가)로 펼쳤는데, 이 서식에는 "교체대상" 칸이 따로 있어 맞바꿈이 같은 줄에서 표현됩니다.
// 두 줄로 적으면 교체대상 칸이 비고 같은 건이 중복돼 보입니다. 되돌리지 마세요.

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

/** 서식 표의 한 줄 = 결강 수업 하나 */
export interface MakeupRow {
  kind: MakeupKind;
  /** 교과명 — 결강하는 수업의 과목 */
  subject: string;
  /** 학 반 */
  className: string;
  /** 교 시 */
  period: number;
  /** 교체대상 교시 — 교체일 때만. 서식이 "( )월( )일 ( )교시"라 날짜까지 필요합니다. */
  exchangeDate?: string;
  exchangePeriod?: number;
  /** 교체대상 교과 — 교체일 때만 */
  exchangeSubject?: string;
  /** 교체 및 동과보강 교사명 */
  partnerTeacher: string;
}

/**
 * 문서 한 장 = 하루치.
 *
 * 서식 하단에 "하루에 한 장씩 기재해 주십시오"라고 적혀 있고 머리말의 `일 시`도 날짜
 * 하나뿐이라, 트레이에 여러 날이 섞이면 날짜별로 장을 나눕니다.
 */
export interface MakeupSheet {
  /** 일 시 = 결강일 (YYYY-MM-DD) */
  date: string;
  rows: MakeupRow[];
}

/** 인쇄 페이지로 넘기는 문서 (여러 장일 수 있음) */
export interface MakeupDoc {
  schoolName: string;
  /** 교 사 = 결강 교사 */
  writerTeacher: string;
  /** 사 유 — 서식에 인쇄된 보기 중 하나 (출장·연가·병가·조퇴·특별휴가·기타) */
  reason: string;
  /** 사유가 "기타"일 때 괄호 안에 들어갈 내용 */
  reasonDetail?: string;
  /** 하루에 한 장 */
  sheets: MakeupSheet[];
  /** 문서를 만든 시각 (ISO) */
  createdAt: string;
}

/** 서식 `사 유` 줄에 인쇄돼 있는 보기. 순서까지 서식 그대로입니다. */
export const MAKEUP_REASONS = ["출장", "연가", "병가", "조퇴", "특별휴가", "기타"] as const;

/** 인쇄 페이지에 문서를 넘길 때 쓰는 sessionStorage 키 */
export const MAKEUP_DOC_KEY = "schedule-helper:makeup-doc";
