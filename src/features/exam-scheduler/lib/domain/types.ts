/**
 * 도메인 모델.
 *
 * 구 버전(Python)의 `app_state.groups[]` 딕셔너리를 타입으로 옮긴 것입니다.
 * 엑셀 원본은 한글 열 이름을 쓰지만, 도메인 안에서는 영문 필드로 다루고
 * 한글 ↔ 영문 변환은 `lib/excel` 경계에서만 수행합니다.
 * (구 버전은 한글 키를 코드 전역에서 문자열로 다뤄 오타 추적이 어려웠습니다.)
 */

/** 학생 1명의 수강 1건. 엑셀 한 행에 해당합니다. */
export interface StudentRecord {
  /** 반 — 원본 표기 그대로 ("3", "3반" 등이 섞여 들어옵니다) */
  className: string;
  /** 번호 */
  number: string;
  /** 성명 */
  name: string;
  /** 개설과목(학점) — 원본 값 */
  courseTitle: string;
  /** 과목명 — courseTitle에서 괄호를 제거한 값 */
  subject: string;
  /** 과목명_비교용 — 시간표 매칭에 쓰는 정규화 키 */
  subjectKey: string;
  /** 개설강의실 */
  courseRoom: string;
  /** 위에 매핑되지 않은 나머지 원본 열 (학년도, 학기, 편제명 등) */
  extra: Record<string, string>;
}

/** 학생 식별 키. `${className}|${number}|${name}` 형식입니다. */
export type StudentKey = string;

/** 분반(split) 1칸. 정원(28명)을 넘는 과목을 나눌 때 사용합니다. */
export interface SplitRoom {
  /** 분반 이름 (예: "물리학I (새 분반)") */
  name: string;
  /**
   * 이 분반에 속한 학생 키 목록. 배열 순서가 곧 좌석 순서입니다.
   *
   * 구 버전은 "3반 12번 홍길동 [강의실]" 형태의 표시용 문자열을 저장하고
   * `startswith`로 학생을 되찾았습니다. 동명이인이나 표기 변화에 취약해
   * 여기서는 StudentKey를 저장하도록 바꿉니다.
   */
  studentKeys: StudentKey[];
}

/** 합반(merge) 정보. 소규모 강의실 여러 개를 한 시험실로 합칠 때 사용합니다. */
export interface MergeInfo {
  /** 합쳐진 뒤의 시험실 이름 */
  mergedRoom: string;
  /** 합치기 전 원래 개설강의실 목록 */
  originalRooms: string[];
}

/** 자습 배정 1건. */
export interface StudyAssignment {
  className: string;
  number: string;
  name: string;
  /** 자습 교실 (예: "1-7") */
  room: string;
  /** `${date} ${period}` — 예: "2026-06-22 3교시" */
  timeSlot: string;
}

/** 시험 대상에서 제외할 학생 (전학, 장기결석 등). */
export interface ExcludedStudent {
  groupId: string;
  className: string;
  number: string;
  name: string;
  reason: string;
}

/** 학년 단위 작업 묶음. 구 버전의 `group` 딕셔너리에 대응합니다. */
export interface GradeGroup {
  id: string;
  /** 표시 이름 (예: "1학년") */
  name: string;
  /** 교실 번호 접두사 — name에서 추출한 학년 숫자 (예: "1") */
  gradePrefix: string;
  records: StudentRecord[];

  /** 시험 일수 = timetable의 열 개수 */
  numDays: number;
  /** 하루 교시 수 = timetable의 행 개수 */
  numPeriods: number;
  /** 길이 numDays. "YYYY-MM-DD" 형식 */
  dates: string[];
  /** 길이 numPeriods. 표시용 시각 문자열 (예: "09:00~09:50") */
  periodTimes: string[];
  /** timetable[period][day] = 과목명. 한 칸에 여러 과목은 "/"로 구분합니다. */
  timetable: string[][];

  /** `${subject}_${room}` → 배정된 시험실 이름 */
  roomMappings: Record<string, string>;
  /** 과목명 → 분반 목록 */
  splitMappings: Record<string, SplitRoom[]>;
  /** 과목명 → 합반 정보 */
  mergeMappings: Record<string, MergeInfo>;

  studyAssignments: StudyAssignment[];
}

/**
 * 시험실 배정까지 끝난 결과 행.
 * 구 버전 `build_result_df()`의 출력 1행에 대응합니다.
 */
export interface ResultRow {
  className: string;
  number: string;
  name: string;
  courseTitle: string;
  subject: string;
  courseRoom: string;
  /** 시험일자 "YYYY-MM-DD" */
  examDate: string;
  /** 시험교시 "N교시" */
  examPeriod: string;
  /** 시험교실 — 최종 배정된 시험실 */
  examRoom: string;
  /** 좌석번호 — (일자, 교시, 시험실) 안에서의 1부터 시작하는 순번 */
  seatNo: number;
  /** 과목별 순번 */
  subjectSeq: number;
  /** 표시용 시험시간 (예: "6/22(월) 3교시") */
  examTime: string;
}

/** 시험실 설정 화면의 한 줄. 과목/강의실별 인원과 배정 상태를 보여줍니다. */
export type RoomSettingRowType =
  | 'normal'
  | 'split_parent'
  | 'split_child'
  | 'merged'
  | 'merge_recommend'
  | 'merge_child';

export interface RoomSettingRow {
  type: RoomSettingRowType;
  subject: string;
  /** 강의실 이름, 또는 "(분반 대상)" / "(합반 추천)" 같은 안내 문구 */
  room: string;
  count: number;
  /** 배정된 시험실. 안내용 행(split_parent, merge_recommend)에는 없습니다. */
  assignedRoom?: string;
  /** merged 행에서만 채워지는, 합치기 전 강의실 목록 */
  originalRooms?: string[];
}

/** 자습 배정 화면에 필요한 데이터 묶음. */
export interface StudySlotData {
  /** 해당 교시에 시험도 자습도 배정되지 않은 학생 */
  unassigned: Array<Pick<StudentRecord, 'className' | 'number' | 'name'>>;
  /** 이미 자습 배정된 학생 */
  assigned: StudyAssignment[];
  /** 시험에 쓰이지 않아 자습에 쓸 수 있는 교실 (예: ["1-5", "1-6"]) */
  emptyRooms: string[];
}

/** 자동 자습 배정 시 학급 수를 초과해 만들어진 교실에 대한 경고. */
export interface ClassOverflowWarning {
  groupName: string;
  date: string;
  period: string;
  /** 예: "10반 (1-10)" */
  exceededClass: string;
}
