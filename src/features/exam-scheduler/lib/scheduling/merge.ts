/**
 * 합반 — 구 버전 `merge_subject_rooms()`(excel_logic.py:707-730)의 이식본.
 *
 * 한 과목이 소규모 강의실 여러 개로 흩어져 있을 때, 이를 한 시험실로 합칩니다.
 * 감독 인원을 줄이려는 것이므로 합쳐도 정원을 넘지 않을 때만 의미가 있습니다.
 */

import type { GradeGroup, MergeInfo } from '../domain/types';

/**
 * 과목의 합반 정보를 만듭니다. 강의실이 하나뿐이면 합칠 것이 없으므로 `null`입니다.
 *
 * 합쳐진 시험실 이름은 원래 강의실을 ` + `로 이은 것입니다
 * (예: `사회실A + 사회실B`). 이 이름이 `roomMappings`의 키에 쓰이므로
 * 형식을 바꾸면 기존 작업 내역의 수동 배정이 끊어집니다.
 */
export function buildMergeInfo(group: GradeGroup, subject: string): MergeInfo | null {
  const rooms = [
    ...new Set(
      group.records
        .filter((record) => record.subject === subject)
        .map((record) => record.courseRoom),
    ),
  ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  if (rooms.length < 2) return null;

  return { mergedRoom: rooms.join(' + '), originalRooms: rooms };
}
