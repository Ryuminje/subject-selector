/**
 * 시험지 봉투 표지 데이터 — 구 버전 `get_envelope_data()`(excel_logic.py:419-544)의 이식본.
 *
 * 시험지를 담을 봉투 겉면에 붙일 표지입니다. 한 줄이 봉투 하나에 대응하며,
 * 한글(HWP) 메일머지의 데이터 원본으로 쓰입니다.
 *
 *   과목명 | 시험실 | 타임/반
 *   국어    | 1-1    | (학년1(3))
 *   사회    | 1-5    | (사회실A(2)+사회실B(2))
 *
 * "타임/반"은 그 시험실에 어느 강의실 학생이 몇 명 들어가는지를 나타냅니다.
 * 감독 선생님이 시험지 부수를 맞추는 데 씁니다.
 */

import { makeStudentKey, normalizeSubjectKey } from '../domain/normalize';
import type { GradeGroup, StudentKey, StudentRecord } from '../domain/types';
import { assignExamRoom } from './buildResults';

export interface EnvelopeRow {
  examDate: string;
  /** 교시 번호. 1부터 셉니다. */
  period: number;
  subject: string;
  examRoom: string;
  timeClass: string;
}

function compareCodePoints(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * 시험실 이름 비교. 숫자 덩어리는 숫자로 봅니다 — 글자만으로 비교하면 `1-10`이 `1-2`보다
 * 앞에 와서 봉투 순서가 실제 교실 순서와 어긋납니다.
 */
function compareRoomNames(a: string, b: string): number {
  const chunks = (value: string) => value.match(/\d+|\D+/g) ?? [];
  const left = chunks(a);
  const right = chunks(b);

  for (let i = 0; i < Math.min(left.length, right.length); i += 1) {
    const x = left[i];
    const y = right[i];
    const bothNumeric = /^\d/.test(x) && /^\d/.test(y);
    const diff = bothNumeric ? Number(x) - Number(y) : compareCodePoints(x, y);
    if (diff !== 0) return diff;
  }
  return left.length - right.length;
}

/**
 * 정렬에 쓸 학년 숫자. 비었거나 숫자가 아니면 맨 뒤로 보냅니다
 * (`Number("")`가 0이라 그냥 두면 빈 값이 1학년보다 앞에 섭니다).
 */
function gradeOrder(group: GradeGroup): number {
  const text = String(group.gradePrefix ?? '').trim();
  const grade = Number(text);
  return text && Number.isFinite(grade) ? grade : Number.MAX_SAFE_INTEGER;
}

/**
 * 강의실 이름을 표지에 쓸 짧은 형태로 줄입니다.
 * 글자와 숫자가 모두 있으면 `글자 + 마지막 숫자`, 아니면 원본 그대로입니다.
 *
 *   `과학실3`     → `과학실3`
 *   `1학년 1반`   → `학년1`   (글자는 첫 덩어리 "학년", 숫자는 마지막 "1")
 *   `사회실A`     → `사회실A` (숫자가 없어 원본 유지)
 *
 * 원본: `clean_room_name_for_envelope()`
 */
export function cleanRoomNameForEnvelope(room: unknown): string {
  const value = String(room ?? '').trim();
  if (!value) return '';

  const letters = value.match(/[A-Za-z가-힣]+/);
  const digits = value.match(/\d+/g);

  const result =
    letters && digits ? `${letters[0]}${digits[digits.length - 1]}` : value;

  return result.replaceAll('(', '').replaceAll(')', '').trim();
}

/**
 * 일반 배정(분반·합반이 아닌 과목)의 "타임/반"을 만듭니다.
 *
 * 숫자로 시작하는 강의실(`1학년 2반` 등)은 곧 학반이라 굳이 적지 않고 비웁니다.
 */
function normalTimeClass(courseRoom: string): string {
  if (courseRoom && /^\d/.test(courseRoom)) return '';

  const letters = courseRoom.match(/[A-Za-z가-힣]+/);
  const digits = courseRoom.match(/\d+/g);
  if (letters && digits) return `(${letters[0]}${digits[digits.length - 1]})`;

  return courseRoom;
}

/** 분반·합반의 "타임/반". 강의실별 인원을 `+`로 잇습니다. */
function splitOrMergedTimeClass(students: StudentRecord[]): string {
  const counts = new Map<string, number>();
  for (const student of students) {
    const room = student.courseRoom.trim();
    counts.set(room, (counts.get(room) ?? 0) + 1);
  }

  const parts = [...counts.keys()]
    .sort(compareCodePoints)
    .map((room) => `${cleanRoomNameForEnvelope(room)}(${counts.get(room)})`);

  return `(${parts.join('+')})`;
}

/**
 * 모든 학년의 봉투 표지 줄을 만듭니다.
 * 같은 내용의 줄은 하나로 합치고, 시험일 → 교시 → 시험실 순으로 정렬합니다.
 */
export function buildEnvelopeRows(
  groups: GradeGroup[],
  excludedKeysByGroup: Record<string, ReadonlySet<StudentKey>> = {},
): EnvelopeRow[] {
  const collected: Array<EnvelopeRow & { groupIndex: number; grade: number }> = [];

  groups.forEach((group, groupIndex) => {
    const grade = gradeOrder(group);
    const excluded = excludedKeysByGroup[group.id] ?? new Set<StudentKey>();
    const students = group.records.filter(
      (record) =>
        excluded.size === 0 ||
        !excluded.has(makeStudentKey(record.className, record.number, record.name)),
    );

    for (let period = 0; period < group.numPeriods; period += 1) {
      for (let day = 0; day < group.numDays; day += 1) {
        const cell = (group.timetable[period]?.[day] ?? '').trim();
        if (!cell) continue;

        const examDate = group.dates[day] ?? '';

        for (const rawSubject of cell.split('/')) {
          const subjectKey = normalizeSubjectKey(rawSubject);
          if (!subjectKey) continue;

          const taking = students.filter(
            (record) => normalizeSubjectKey(record.subject) === subjectKey,
          );
          if (taking.length === 0) continue;

          // 시험실이 아직 정해지지 않은 학생은 봉투를 만들 수 없으니 건너뜁니다.
          const byRoom = new Map<string, StudentRecord[]>();
          for (const record of taking) {
            const [room] = assignExamRoom(group, record);
            if (!room.trim()) continue;
            const bucket = byRoom.get(room);
            if (bucket) bucket.push(record);
            else byRoom.set(room, [record]);
          }

          const sortedRooms = [...byRoom.entries()].sort(([a], [b]) =>
            compareRoomNames(a, b),
          );

          for (const [room, roomStudents] of sortedRooms) {
            const examRoom = room.trim();
            if (!examRoom) continue;

            const subject = roomStudents[0].subject;
            const isMerged = subject in group.mergeMappings;
            const isSplit = subject in group.splitMappings;

            collected.push({
              groupIndex,
              grade,
              examDate,
              period: period + 1,
              subject,
              examRoom,
              timeClass:
                isMerged || isSplit
                  ? splitOrMergedTimeClass(roomStudents)
                  : normalTimeClass(roomStudents[0].courseRoom),
            });
          }
        }
      }
    }
  });

  // 같은 내용이 여러 번 나오면 봉투도 여러 장이 되므로 합칩니다.
  const seen = new Set<string>();
  const unique = collected.filter((row) => {
    const key = [
      row.groupIndex,
      row.examDate,
      row.period,
      row.subject,
      row.examRoom,
      row.timeClass,
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 봉투를 나눠 주는 순서 그대로입니다 — 학년 → 시험시간(날짜·교시) → 시험실.
  // 학년 숫자가 같으면(또는 둘 다 알 수 없으면) 명단을 불러온 순서를 따릅니다.
  return unique
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) =>
        a.row.grade - b.row.grade ||
        a.row.groupIndex - b.row.groupIndex ||
        compareCodePoints(a.row.examDate, b.row.examDate) ||
        a.row.period - b.row.period ||
        compareRoomNames(a.row.examRoom, b.row.examRoom) ||
        a.index - b.index,
    )
    .map(({ row }) => ({
      examDate: row.examDate,
      period: row.period,
      subject: row.subject,
      examRoom: row.examRoom,
      timeClass: row.timeClass,
    }));
}
