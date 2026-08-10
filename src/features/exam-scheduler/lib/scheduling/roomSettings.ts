/**
 * 시험실 설정 화면에 뿌릴 목록 — 구 버전 `calculate_room_settings()`(excel_logic.py:86-174)의 이식본.
 *
 * 과목마다 다음 넷 중 하나로 갈립니다.
 *
 * - `split_*`   한 강의실에 28명을 넘는 과목. 나눠야 합니다.
 * - `merged`    이미 합반 처리된 과목.
 * - `merge_*`   강의실이 둘 이상인데 합쳐도 28명 이하 — 합치자고 권합니다.
 * - `normal`    그 밖의 경우. 강의실 하나가 곧 시험실 하나입니다.
 */

import { MAX_PER_ROOM, MERGE_THRESHOLD } from '../domain/constants';
import {
  makeStudentKey,
  normalizeRoom,
  normalizeSubjectKey,
  splitTimetableCell,
} from '../domain/normalize';
import type {
  GradeGroup,
  RoomSettingRow,
  StudentKey,
  StudentRecord,
} from '../domain/types';

/**
 * 파이썬 문자열 비교와 같은 순서.
 *
 * pandas의 `groupby`가 키를 코드포인트 순으로 정렬하므로 화면 순서도 거기에 맞춰야 합니다.
 * 순수 한글은 코드포인트 순서가 곧 가나다 순이라 사람이 보기에도 자연스럽습니다.
 */
function compareCodePoints(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** 시간표에 올라와 있는 과목만 남깁니다. 시험을 보지 않는 과목은 배정 대상이 아닙니다. */
function scheduledSubjectKeys(group: GradeGroup): Set<string> {
  return new Set(group.timetable.flatMap((row) => row.flatMap(splitTimetableCell)));
}

/** 과목 → 강의실 → 학생 목록. 과목과 강의실 모두 코드포인트 순으로 정렬됩니다. */
function groupBySubjectAndRoom(
  records: StudentRecord[],
): Map<string, Map<string, StudentRecord[]>> {
  const bySubject = new Map<string, Map<string, StudentRecord[]>>();

  for (const record of records) {
    let byRoom = bySubject.get(record.subject);
    if (!byRoom) {
      byRoom = new Map();
      bySubject.set(record.subject, byRoom);
    }
    const bucket = byRoom.get(record.courseRoom);
    if (bucket) bucket.push(record);
    else byRoom.set(record.courseRoom, [record]);
  }

  return new Map(
    [...bySubject.entries()]
      .sort(([a], [b]) => compareCodePoints(a, b))
      .map(([subject, byRoom]) => [
        subject,
        new Map([...byRoom.entries()].sort(([a], [b]) => compareCodePoints(a, b))),
      ]),
  );
}

/**
 * 수동으로 정해 둔 시험실이 있으면 그것을, 없으면 강의실 이름에서 유추한 값을 씁니다.
 * 빈 문자열로 지정해 둔 경우에는 그 빈 값이 그대로 이깁니다.
 */
function resolveAssignedRoom(
  group: GradeGroup,
  subject: string,
  room: string,
): string {
  return (
    group.roomMappings[`${subject}_${room}`] ??
    normalizeRoom(room, group.gradePrefix) ??
    ''
  );
}

export function calculateRoomSettings(
  group: GradeGroup,
  excludedKeys: ReadonlySet<StudentKey> = new Set(),
): RoomSettingRow[] {
  if (group.records.length === 0) return [];

  const scheduled = scheduledSubjectKeys(group);
  const relevant = group.records.filter((record) => {
    if (
      excludedKeys.size > 0 &&
      excludedKeys.has(makeStudentKey(record.className, record.number, record.name))
    ) {
      return false;
    }
    return scheduled.has(normalizeSubjectKey(record.subject));
  });

  const bySubject = groupBySubjectAndRoom(relevant);
  const rows: RoomSettingRow[] = [];

  for (const [subject, byRoom] of bySubject) {
    const roomEntries = [...byRoom.entries()];
    const total = roomEntries.reduce((sum, [, students]) => sum + students.length, 0);

    const isSplit = roomEntries.some(([, students]) => students.length > MAX_PER_ROOM);
    const merged = group.mergeMappings[subject];
    // 이미 합반한 과목은 다시 권하지 않습니다.
    const isMergeCandidate =
      !isSplit && !merged && roomEntries.length >= 2 && total <= MERGE_THRESHOLD;

    if (merged) {
      rows.push({
        type: 'merged',
        subject,
        room: merged.mergedRoom,
        count: total,
        assignedRoom: group.roomMappings[`${subject}_${merged.mergedRoom}`] ?? '',
        originalRooms: merged.originalRooms,
      });
      continue;
    }

    if (isSplit) {
      rows.push({ type: 'split_parent', subject, room: '(분반 대상)', count: total });
      for (const splitRoom of group.splitMappings[subject] ?? []) {
        rows.push({
          type: 'split_child',
          subject,
          room: splitRoom.name,
          count: splitRoom.studentKeys.length,
          assignedRoom: resolveAssignedRoom(group, subject, splitRoom.name),
        });
      }
      continue;
    }

    if (isMergeCandidate) {
      rows.push({ type: 'merge_recommend', subject, room: '(합반 추천)', count: total });
      for (const [room, students] of roomEntries) {
        rows.push({
          type: 'merge_child',
          subject,
          room,
          count: students.length,
          assignedRoom: resolveAssignedRoom(group, subject, room),
        });
      }
      continue;
    }

    for (const [room, students] of roomEntries) {
      rows.push({
        type: 'normal',
        subject,
        room,
        count: students.length,
        assignedRoom: resolveAssignedRoom(group, subject, room),
      });
    }
  }

  return rows;
}
