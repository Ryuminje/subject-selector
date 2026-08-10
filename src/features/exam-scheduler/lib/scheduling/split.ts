/**
 * 분반 나누기 — 구 버전 `get_split_modal_data()`(excel_logic.py:176-207)의 이식본.
 *
 * 한 강의실에 28명이 넘는 과목을 여러 시험실로 나눌 때 씁니다.
 * 처음 열면 개설강의실별로 묶인 초안과 빈 "새 분반" 한 칸을 돌려주고,
 * 이미 나눠 둔 과목이면 저장된 구성을 그대로 돌려줍니다.
 */

import {
  cleanClassName,
  cleanStudentNumber,
  makeRosterKey,
  toSortNumber,
} from '../domain/normalize';
import type { GradeGroup, SplitRoom, StudentKey, StudentRecord } from '../domain/types';

export interface SplitStudent {
  key: StudentKey;
  /** 화면에 보여줄 이름표 (예: `3반 12번 홍길동 [과학실]`) */
  label: string;
  /**
   * 정렬 키: [원래 개설강의실 순번, 반, 번호].
   *
   * 원래 강의실 안에서는 이 값이 강의실 축에서 전부 같으므로 자연히 학번 순이 되고,
   * 여러 강의실 학생이 섞인 새 분반에서는 강의실 → 학번 순이 됩니다. 학생을 새 분반으로
   * 옮겼다가 원래 강의실로 되돌려도 이 값이 그대로라 항상 자기 자리를 다시 찾습니다.
   */
  sortKey: readonly [number, number, number];
}

export interface SplitDraftRoom {
  name: string;
  students: SplitStudent[];
}

/** 강의실 이름에서 괄호 앞부분만 떼어 이름표 꼬리로 씁니다. `과학실(3층)` → `과학실` */
function roomTag(room: string): string {
  const prefix = String(room).split('(')[0].trim();
  return prefix ? ` [${prefix}]` : '';
}

function labelFor(
  className: string,
  number: string,
  name: string,
  room: string,
): string {
  const ban = cleanClassName(className);
  const num = cleanStudentNumber(number);
  return `${ban}반 ${num}번 ${name}${roomTag(room)}`;
}

/** 원래 개설강의실 이름 → 정렬 순번(A, B, C...). 코드포인트 순서로 매깁니다. */
function buildRoomRank(records: StudentRecord[]): Map<string, number> {
  const names = [...new Set(records.map((r) => r.courseRoom))].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  return new Map(names.map((name, i) => [name, i]));
}

function buildSortKey(
  roomRank: Map<string, number>,
  homeRoom: string,
  className: string,
  number: string,
): readonly [number, number, number] {
  return [roomRank.get(homeRoom) ?? roomRank.size, toSortNumber(className), toSortNumber(number)];
}

/**
 * 분반 목록을 정렬 키 순서로 정리합니다. 어느 분반을 편집하든, 저장하든 항상
 * 이 순서를 거쳐야 "원래 강의실 → 학번" 규칙이 어긋나지 않습니다.
 */
export function sortSplitStudents(students: SplitStudent[]): SplitStudent[] {
  return [...students].sort((a, b) => {
    for (let i = 0; i < a.sortKey.length; i += 1) {
      const diff = a.sortKey[i] - b.sortKey[i];
      if (diff !== 0) return diff;
    }
    return 0;
  });
}

/**
 * 분반 편집 화면에 띄울 초안을 만듭니다.
 *
 * 저장된 구성이 있으면 그것을 쓰되, 이름표는 지금 명단으로 다시 만듭니다
 * (명단을 새로 불러왔을 때 옛 이름이 남지 않도록). `ignoreSaved`를 주면 저장된
 * 구성을 무시하고 개설강의실 그대로의 초안으로 되돌립니다 ("초기화" 버튼용).
 */
export function getSplitDraft(
  group: GradeGroup,
  subject: string,
  options: { ignoreSaved?: boolean } = {},
): SplitDraftRoom[] {
  const records = group.records.filter((record) => record.subject === subject);
  if (records.length === 0) return [];

  const roomRank = buildRoomRank(records);
  const labelByKey = new Map<StudentKey, string>();
  const homeRoomByKey = new Map<StudentKey, string>();
  for (const record of records) {
    const key = makeRosterKey(record.className, record.number, record.name);
    labelByKey.set(
      key,
      labelFor(record.className, record.number, record.name, record.courseRoom),
    );
    homeRoomByKey.set(key, record.courseRoom);
  }

  function studentFor(key: StudentKey): SplitStudent {
    // 명단에서 사라진 학생은 키에서 반·번호를 다시 뽑아 정렬 순서를 잃지 않게 합니다.
    const [classPart = '', numberPart = ''] = key.split('|');
    const homeRoom = homeRoomByKey.get(key) ?? '';
    return {
      key,
      label: labelByKey.get(key) ?? key,
      sortKey: buildSortKey(roomRank, homeRoom, classPart, numberPart),
    };
  }

  const saved = options.ignoreSaved ? undefined : group.splitMappings[subject];
  if (saved) {
    return saved.map((room) => ({
      name: room.name,
      students: sortSplitStudents(room.studentKeys.map(studentFor)),
    }));
  }

  const byRoom = new Map<string, SplitStudent[]>();
  for (const record of records) {
    const key = makeRosterKey(record.className, record.number, record.name);
    const bucket = byRoom.get(record.courseRoom);
    const student = studentFor(key);
    if (bucket) bucket.push(student);
    else byRoom.set(record.courseRoom, [student]);
  }

  const draft: SplitDraftRoom[] = [...byRoom.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, students]) => ({ name, students: sortSplitStudents(students) }));

  // 학생을 옮겨 담을 빈 칸을 하나 붙여 둡니다.
  draft.push({ name: `${subject} (새 분반)`, students: [] });
  return draft;
}

/** 편집 화면의 초안을 저장용 구조로 되돌립니다. 빈 분반은 버립니다. */
export function toSplitRooms(draft: SplitDraftRoom[]): SplitRoom[] {
  return draft
    .filter((room) => room.students.length > 0)
    .map((room) => ({
      name: room.name,
      studentKeys: room.students.map((student) => student.key),
    }));
}
