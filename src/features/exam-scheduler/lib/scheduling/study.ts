/**
 * 자습 배정 — 구 버전 `get_study_data()`(614-679)와 `auto_allocate_all_study()`(1269-1392)의 이식본.
 *
 * 시험이 없는 교시에 학생들이 갈 곳을 정하는 일입니다.
 * 그 교시에 시험에 쓰이지 않는 교실이 곧 자습 교실이 됩니다.
 */

import {
  CLASS_NUMBER_WARN_LIMIT,
  MAX_PER_ROOM,
} from '../domain/constants';
import {
  buildStudentNumber,
  cleanClassName,
  makeRosterKey,
  makeStudentKey,
  makeTimeSlot,
  normalizeRoom,
  periodLabel,
  splitTimetableCell,
  toSortNumber,
} from '../domain/normalize';
import type {
  ClassOverflowWarning,
  GradeGroup,
  StudentKey,
  StudyAssignment,
  StudySlotData,
} from '../domain/types';
import { buildResults } from './buildResults';

/** 시간표 칸에 이 과목이 적혀 있으면 전원을 자기 학반으로 보냅니다. */
const SELF_STUDY_KEYWORD = '자습';

type StudentBrief = StudySlotData['unassigned'][number];

/**
 * 명단에서 학생 목록을 뽑습니다. 같은 학생의 여러 수강 기록은 한 명으로 묶습니다.
 * 시험 대상에서 제외한 학생은 자습 대상에서도 뺍니다.
 */
export function distinctStudents(
  group: GradeGroup,
  excludedKeys: ReadonlySet<StudentKey> = new Set(),
): StudentBrief[] {
  const seen = new Set<StudentKey>();
  const students: StudentBrief[] = [];

  for (const record of group.records) {
    const key = makeStudentKey(record.className, record.number, record.name);
    if (seen.has(key)) continue;
    seen.add(key);
    if (excludedKeys.has(key)) continue;
    students.push({
      className: record.className,
      number: record.number,
      name: record.name,
    });
  }

  return students;
}

/** 반 → 번호 순. 자습 명단과 자동 배정의 순서가 모두 이 정렬을 따릅니다. */
function sortByClassAndNumber(students: StudentBrief[]): StudentBrief[] {
  return students
    .map((student, index) => ({ student, index }))
    .sort(
      (a, b) =>
        toSortNumber(a.student.className) - toSortNumber(b.student.className) ||
        toSortNumber(a.student.number) - toSortNumber(b.student.number) ||
        a.index - b.index,
    )
    .map(({ student }) => student);
}

/**
 * 한 교시의 자습 현황을 구합니다.
 *
 * @param totalClasses 그 학년의 학급 수. 자습에 쓸 수 있는 교실 후보를 만드는 데 씁니다.
 *
 * 제외한 학생은 자습 대상에서도 뺍니다. 구 버전은 시험 배정에서만 빼고 자습 명단에는
 * 남겨 두었는데, 전학처럼 학교를 떠난 학생이 자습실에 배정되는 문제가 있어 바꿨습니다.
 */
export function getStudySlotData(
  group: GradeGroup,
  date: string,
  period: string,
  totalClasses: number,
  excludedKeys: ReadonlySet<StudentKey> = new Set(),
): StudySlotData {
  const examRows = buildResults(group, excludedKeys).filter(
    (row) => row.examDate === date && row.examPeriod === period,
  );

  const examKeys = new Set(
    examRows.map((row) => makeStudentKey(row.className, row.number, row.name)),
  );

  let unassigned = distinctStudents(group, excludedKeys).filter(
    (student) =>
      !examKeys.has(makeStudentKey(student.className, student.number, student.name)),
  );

  const slot = makeTimeSlot(date, period);
  const assigned = group.studyAssignments.filter((a) => a.timeSlot === slot);

  if (assigned.length > 0) {
    const assignedKeys = new Set(
      assigned.map((a) => makeStudentKey(a.className, a.number, a.name)),
    );
    unassigned = unassigned.filter(
      (student) =>
        !assignedKeys.has(
          makeStudentKey(student.className, student.number, student.name),
        ),
    );
  }

  // 그 교시에 시험으로 쓰이고 있는 교실을 걷어냅니다.
  // 시험실이 아직 안 정해진 학생은 원래 강의실을 쓰는 것으로 봅니다.
  const usedRooms = new Set<string>();
  for (const row of examRows) {
    const room = row.examRoom.trim() ? row.examRoom : row.courseRoom;
    const normalized = normalizeRoom(room, group.gradePrefix);
    if (normalized) usedRooms.add(normalized);
  }

  const emptyRooms: string[] = [];
  for (let i = 1; i <= totalClasses; i += 1) {
    const room = `${group.gradePrefix}-${i}`;
    if (!usedRooms.has(room)) emptyRooms.push(room);
  }

  return {
    unassigned: sortByClassAndNumber(unassigned),
    assigned,
    emptyRooms,
  };
}

/**
 * 자습실별 좌석번호를 매깁니다. 같은 교실에 배정된 학생을 **학번순으로 1, 2, 3…**
 *
 * 통합 자습명단의 순번과 개인 시간표의 자습 좌석번호가 같은 값이어야 하므로
 * 두 출력 모두 이 함수를 씁니다.
 *
 * @returns `${교시슬롯}|${교실}|${makeRosterKey(학생)}` → 좌석번호
 */
export function buildStudySeatNumbers(group: GradeGroup): Map<string, number> {
  const byRoom = new Map<string, StudyAssignment[]>();

  for (const assignment of group.studyAssignments) {
    const room = String(assignment.room ?? '').trim();
    if (!room) continue;
    const key = `${assignment.timeSlot}|${room}`;
    const bucket = byRoom.get(key);
    if (bucket) bucket.push(assignment);
    else byRoom.set(key, [assignment]);
  }

  const seats = new Map<string, number>();

  for (const [key, assignments] of byRoom) {
    const ordered = [...assignments].sort((a, b) => {
      const left = buildStudentNumber(group.gradePrefix, a.className, a.number);
      const right = buildStudentNumber(group.gradePrefix, b.className, b.number);
      return left < right ? -1 : left > right ? 1 : 0;
    });

    ordered.forEach((assignment, index) => {
      seats.set(
        `${key}|${makeRosterKey(assignment.className, assignment.number, assignment.name)}`,
        index + 1,
      );
    });
  }

  return seats;
}

export interface AutoStudyResult {
  /** 학년 id → 그 학년의 자습 배정 전체 (기존 것 포함) */
  assignmentsByGroupId: Record<string, StudyAssignment[]>;
  /** 학급 수를 넘는 교실이 만들어진 경우의 경고 */
  warnings: ClassOverflowWarning[];
}

/**
 * 모든 학년 · 모든 시험일 · 모든 교시를 훑어 자습을 자동 배정합니다.
 * 이미 배정된 교시는 지우고 다시 계산합니다(덮어쓰기).
 *
 * 교시마다 셋 중 하나로 갈립니다.
 *
 * 1. 시간표에 `자습`이라 적힌 교시 → 전원을 **자기 학반**으로 보냅니다.
 * 2. 빈 교실이 모자란 경우 → 학급 번호를 이어 붙여 교실을 만들고 경고를 남깁니다.
 *    실재하지 않는 "10반" 같은 교실이므로 사람이 확인해 고쳐야 합니다.
 * 3. 그 밖 → 필요한 교실 수만큼 나누고, 앞쪽 교실부터 한 명씩 더 넣습니다.
 */
export function autoAllocateStudy(
  groups: GradeGroup[],
  totalClasses: number,
  excludedKeysByGroup: Record<string, ReadonlySet<StudentKey>> = {},
): AutoStudyResult {
  const assignmentsByGroupId: Record<string, StudyAssignment[]> = {};
  const warnings: ClassOverflowWarning[] = [];

  for (const group of groups) {
    if (group.records.length === 0) continue;

    const excluded = excludedKeysByGroup[group.id] ?? new Set<StudentKey>();
    let assignments = [...group.studyAssignments];

    const validDates = group.dates.map((d) => d.trim()).filter(Boolean);

    for (const date of validDates) {
      const dayIndex = group.dates.indexOf(date);
      if (dayIndex === -1) continue;

      for (let p = 0; p < group.numPeriods; p += 1) {
        const period = periodLabel(p);
        const slot = makeTimeSlot(date, period);
        const cell = (group.timetable[p]?.[dayIndex] ?? '').trim();

        // 다시 계산하므로 이 교시의 기존 배정은 먼저 지웁니다.
        assignments = assignments.filter((a) => a.timeSlot !== slot);

        const { unassigned, emptyRooms } = getStudySlotData(
          { ...group, studyAssignments: assignments },
          date,
          period,
          totalClasses,
          excluded,
        );

        if (unassigned.length === 0) continue;

        if (splitTimetableCell(cell).includes(SELF_STUDY_KEYWORD)) {
          assignments.push(
            ...unassigned.map((student) => ({
              ...student,
              room: `${group.gradePrefix}-${cleanClassName(student.className)}`,
              timeSlot: slot,
            })),
          );
          continue;
        }

        const rooms = [...emptyRooms];
        const required = Math.ceil(unassigned.length / MAX_PER_ROOM);
        const shortage = required - rooms.length;

        if (shortage > 0) {
          // 이미 있는 교실 번호보다 큰 번호를 이어 붙입니다.
          let maxClassNumber = totalClasses;
          for (const room of rooms) {
            const suffix = room.split('-')[1];
            if (suffix && /^\d+$/.test(suffix)) {
              maxClassNumber = Math.max(maxClassNumber, Number(suffix));
            }
          }

          for (let i = 0; i < shortage; i += 1) {
            const classNumber = maxClassNumber + 1 + i;
            rooms.push(`${group.gradePrefix}-${classNumber}`);

            if (classNumber > CLASS_NUMBER_WARN_LIMIT) {
              warnings.push({
                groupName: group.name,
                date,
                period,
                exceededClass: `${classNumber}반 (${group.gradePrefix}-${classNumber})`,
              });
            }
          }
        }

        const roomsToUse = rooms.slice(0, required);
        if (roomsToUse.length === 0) continue;

        // 인원을 교실 수로 나누고, 나머지는 앞쪽 교실부터 한 명씩 더 받습니다.
        const base = Math.floor(unassigned.length / required);
        const remainder = unassigned.length % required;

        let studentIndex = 0;
        for (const [roomIndex, room] of roomsToUse.entries()) {
          const count = Math.min(
            base + (roomIndex < remainder ? 1 : 0),
            MAX_PER_ROOM,
          );
          for (let k = 0; k < count && studentIndex < unassigned.length; k += 1) {
            assignments.push({
              ...unassigned[studentIndex],
              room,
              timeSlot: slot,
            });
            studentIndex += 1;
          }
        }
      }
    }

    assignmentsByGroupId[group.id] = assignments;
  }

  return { assignmentsByGroupId, warnings };
}
