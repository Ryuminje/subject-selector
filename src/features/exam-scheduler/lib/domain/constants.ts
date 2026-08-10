/**
 * 구 버전 코드에 하드코딩되어 있던 숫자들을 한곳으로 모은 것입니다.
 * 학교마다 값이 달라질 수 있어, 나중에 설정 화면으로 노출하기 쉽도록 분리했습니다.
 */

/** 시험실 1칸의 최대 수용 인원. 이 값을 넘으면 분반 대상이 됩니다. */
export const MAX_PER_ROOM = 28;

/**
 * 합반 추천 기준. 한 과목이 강의실 2개 이상으로 나뉘어 있고
 * 합쳐도 이 인원 이하면 합반을 추천합니다.
 */
export const MERGE_THRESHOLD = MAX_PER_ROOM;

/**
 * 자동 자습 배정 시, 교실 번호가 이 값을 넘으면 경고합니다.
 * (실재하지 않는 "10반" 같은 교실이 만들어지는 것을 알리기 위함)
 */
export const CLASS_NUMBER_WARN_LIMIT = 9;

/** 학년당 기본 학급 수. 자습 배정의 빈 교실 후보를 만들 때 씁니다. */
export const DEFAULT_TOTAL_CLASSES = 8;

/** 시간표 기본 크기 */
export const DEFAULT_NUM_DAYS = 5;
export const DEFAULT_NUM_PERIODS = 5;

/** 엑셀 명단에 반드시 있어야 하는 열 이름. 헤더는 2행(0-based index 1)에 있습니다. */
export const REQUIRED_COLUMNS = [
  '반',
  '번호',
  '성명',
  '개설과목(학점)',
  '개설강의실',
] as const;

/** 명단 엑셀의 헤더 행 위치 (0-based). 구 버전 `pd.read_excel(path, header=1)`과 동일합니다. */
export const ROSTER_HEADER_ROW_INDEX = 1;

/** 결과 엑셀에서 내부 계산용이라 출력하지 않는 열 */
export const INTERNAL_COLUMNS = [
  '과목명_비교용',
  '반_num',
  '번호_num',
  '과목명',
  '학년도',
  '학기',
  '학년',
  '편제명',
  '시험일자',
  '시험교시',
] as const;

export const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;
