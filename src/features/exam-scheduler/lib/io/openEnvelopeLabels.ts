/**
 * 시험지 봉투 딱지(A5) 인쇄용 데이터 넘기기.
 *
 * 딱지 내용은 `.xls` 메일머지와 **같은 데이터**입니다(`buildEnvelopeRows`) — 한쪽만 고쳐
 * 둘이 어긋나는 일이 없도록 원본을 공유합니다. 여기서는 인쇄 탭으로 넘기는 일만 합니다.
 *
 * 시험 시간표 저장소(schedulerStore)는 브라우저에 저장되지 않아 새 탭에서는 비어 있습니다.
 * 그래서 보강원 인쇄와 같은 방식으로 localStorage에 잠깐 실어 보내고, 받는 쪽에서 곧바로
 * 지운 뒤 그 탭의 sessionStorage로 옮깁니다(새 탭에 확실히 전달되면서도 브라우저에
 * 오래 남지 않는 유일한 조합입니다).
 */

import type { GradeGroup, StudentKey } from '../domain/types';
import { buildEnvelopeRows, type EnvelopeRow } from '../scheduling/envelope';

export const ENVELOPE_LABEL_KEY = 'exam-scheduler:envelope-labels';
export const ENVELOPE_LABEL_PATH = '/apps/exam-scheduler/envelope/print';

export type EnvelopeLabel = EnvelopeRow;

/**
 * 용지 배치.
 *  - `a5`: A5 가로 한 장에 딱지 하나.
 *  - `a4-2up`: A4 세로 한 장에 딱지 둘(위·아래). A5 가로의 세로 길이가 148mm라
 *    두 장이 297mm에 정확히 들어갑니다.
 */
export type EnvelopeLayout = 'a5' | 'a4-2up';

/**
 * 딱지를 새 탭에서 엽니다. 만들 줄이 없으면 아무것도 하지 않고 `false`입니다.
 * 브라우저에서, 그리고 사용자의 클릭 안에서 호출하세요(팝업 차단 때문입니다).
 */
export function openEnvelopeLabels(
  groups: GradeGroup[],
  excludedKeysByGroup: Record<string, ReadonlySet<StudentKey>> = {},
  layout: EnvelopeLayout = 'a5',
): boolean {
  const rows = buildEnvelopeRows(groups, excludedKeysByGroup);
  if (rows.length === 0) return false;

  localStorage.setItem(ENVELOPE_LABEL_KEY, JSON.stringify(rows));
  window.open(`${ENVELOPE_LABEL_PATH}?layout=${layout}`, '_blank', 'noopener');
  return true;
}
