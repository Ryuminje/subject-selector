/**
 * 시험실 배정 화면의 시간표 과목 버튼에 쓰는 파스텔 배경색.
 * 과목명 글자 코드값 합을 색상 배열 길이로 나눈 나머지로 고릅니다 — 같은 과목은
 * 항상 같은 색이 나오고, 별도 상태 저장 없이 매번 같은 결과를 냅니다.
 *
 * 원본: `getPastelColor()` (frontend/script.js)
 */
const PASTEL_COLORS = ['#E8F0FE', '#E6F4EA', '#FCE8E6', '#FFF0E0', '#F3E8FD'];

export function pastelColorFor(subject: string): string {
  if (!subject) return PASTEL_COLORS[0];
  let hash = 0;
  for (let i = 0; i < subject.length; i++) hash += subject.charCodeAt(i);
  return PASTEL_COLORS[hash % PASTEL_COLORS.length];
}
