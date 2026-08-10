'use client';

/**
 * 앱 전역 상태.
 *
 * 구 버전에서는 Python 프로세스의 `app_state` 전역 객체가 이 역할을 했고,
 * 프론트엔드는 `eel.xxx()` 호출로 매번 서버에 상태를 물어봤습니다.
 * 이제 상태는 브라우저 안에만 존재하며, 학생 개인정보가 네트워크를 타지 않습니다.
 *
 * 여기 있는 액션은 전부 순수한 상태 변경입니다.
 * 엑셀 파싱·시험실 계산·자습 배정 같은 무거운 로직은 `lib/excel`, `lib/scheduling`에
 * 순수 함수로 두고, 그 결과만 이 스토어에 반영합니다.
 */

import { create } from 'zustand';
import {
  DEFAULT_NUM_DAYS,
  DEFAULT_NUM_PERIODS,
} from '../domain/constants';
import { extractGradePrefix, makeStudentKey, makeTimeSlot } from '../domain/normalize';
import type {
  ExcludedStudent,
  GradeGroup,
  MergeInfo,
  SplitRoom,
  StudentRecord,
  StudyAssignment,
} from '../domain/types';

/** 저장/불러오기 파일 형식. version을 올리면 마이그레이션 지점을 잡을 수 있습니다. */
export interface PersistedState {
  version: 1;
  savedAt: string;
  groups: GradeGroup[];
  excludedStudents: ExcludedStudent[];
}

interface SchedulerState {
  groups: GradeGroup[];
  excludedStudents: ExcludedStudent[];

  // --- 학년 그룹 ---
  replaceGroups: (groups: GradeGroup[]) => void;
  appendGroups: (groups: GradeGroup[]) => void;
  deleteGroup: (groupId: string) => void;

  // --- 시간표 ---
  updateTimetableCell: (groupId: string, period: number, day: number, value: string) => void;
  pasteTimetableBlock: (
    groupId: string,
    startPeriod: number,
    startDay: number,
    grid: string[][],
  ) => void;
  updateDate: (groupId: string, day: number, value: string) => void;
  updatePeriodTime: (groupId: string, period: number, value: string) => void;
  resizeTimetable: (groupId: string, deltaPeriods: number, deltaDays: number) => void;
  autoFillDates: (groupId: string) => boolean;
  syncDatesFromFirstGroup: () => void;
  syncPeriodTimesFromFirstGroup: () => void;

  // --- 시험실 배정 ---
  updateRoomMapping: (groupId: string, key: string, value: string) => void;
  setSplitMapping: (groupId: string, subject: string, rooms: SplitRoom[]) => void;
  clearSplitMapping: (groupId: string, subject: string) => void;
  setMergeMapping: (groupId: string, subject: string, info: MergeInfo) => void;
  unmergeSubject: (groupId: string, subject: string) => void;

  // --- 자습 ---
  setStudyAssignments: (
    groupId: string,
    date: string,
    period: string,
    assignments: StudyAssignment[],
  ) => void;
  replaceAllStudyAssignments: (byGroupId: Record<string, StudyAssignment[]>) => void;

  // --- 제외 학생 ---
  excludeStudent: (student: ExcludedStudent) => void;
  unexcludeStudent: (groupId: string, className: string, number: string, name: string) => void;

  // --- 저장/불러오기 ---
  serialize: () => PersistedState;
  hydrate: (state: PersistedState) => void;
  reset: () => void;
}

/** 새 학년 그룹을 기본값으로 만듭니다. 엑셀을 읽은 직후 호출합니다. */
export function createGradeGroup(name: string, records: StudentRecord[]): GradeGroup {
  return {
    id: crypto.randomUUID(),
    name,
    gradePrefix: extractGradePrefix(name),
    records,
    numDays: DEFAULT_NUM_DAYS,
    numPeriods: DEFAULT_NUM_PERIODS,
    dates: Array.from({ length: DEFAULT_NUM_DAYS }, () => ''),
    periodTimes: Array.from({ length: DEFAULT_NUM_PERIODS }, () => ''),
    timetable: Array.from({ length: DEFAULT_NUM_PERIODS }, () =>
      Array.from({ length: DEFAULT_NUM_DAYS }, () => ''),
    ),
    roomMappings: {},
    splitMappings: {},
    mergeMappings: {},
    studyAssignments: [],
  };
}

const byName = (a: GradeGroup, b: GradeGroup) => a.name.localeCompare(b.name, 'ko');

/** 특정 그룹 하나만 갈아끼우는 헬퍼. 나머지 그룹은 참조를 유지합니다. */
function mapGroup(
  groups: GradeGroup[],
  groupId: string,
  fn: (group: GradeGroup) => GradeGroup,
): GradeGroup[] {
  return groups.map((g) => (g.id === groupId ? fn(g) : g));
}

export const useSchedulerStore = create<SchedulerState>((set, get) => ({
  groups: [],
  excludedStudents: [],

  replaceGroups: (groups) => set({ groups: [...groups].sort(byName) }),

  appendGroups: (groups) =>
    set((s) => ({ groups: [...s.groups, ...groups].sort(byName) })),

  deleteGroup: (groupId) =>
    set((s) => ({
      groups: s.groups.filter((g) => g.id !== groupId),
      excludedStudents: s.excludedStudents.filter((e) => e.groupId !== groupId),
    })),

  updateTimetableCell: (groupId, period, day, value) =>
    set((s) => ({
      groups: mapGroup(s.groups, groupId, (g) => {
        if (period < 0 || period >= g.numPeriods || day < 0 || day >= g.numDays) return g;
        const timetable = g.timetable.map((row, r) =>
          r === period ? row.map((cell, c) => (c === day ? value : cell)) : row,
        );
        return { ...g, timetable };
      }),
    })),

  /**
   * 붙여넣은 격자를 (startPeriod, startDay)를 좌상단으로 채웁니다.
   * 격자가 지금 시간표보다 크면 시간표를 늘려서 전부 들어가게 합니다.
   *
   * 원본: 구 버전 `handleTimetablePaste()` (frontend/script.js). 구 버전은 격자를 벗어나는
   * 칸을 조용히 버렸지만, 여기서는 자동으로 넓혀 학생들이 붙여넣은 내용이 잘리지 않게 합니다.
   */
  pasteTimetableBlock: (groupId, startPeriod, startDay, grid) =>
    set((s) => ({
      groups: mapGroup(s.groups, groupId, (g) => {
        if (grid.length === 0 || startPeriod < 0 || startDay < 0) return g;

        const pasteWidth = Math.max(0, ...grid.map((row) => row.length));
        if (pasteWidth === 0) return g;

        const numPeriods = Math.max(g.numPeriods, startPeriod + grid.length);
        const numDays = Math.max(g.numDays, startDay + pasteWidth);

        const dates = Array.from({ length: numDays }, (_, i) => g.dates[i] ?? '');
        const periodTimes = Array.from(
          { length: numPeriods },
          (_, i) => g.periodTimes[i] ?? '',
        );
        const timetable = Array.from({ length: numPeriods }, (_, r) =>
          Array.from({ length: numDays }, (_, c) => g.timetable[r]?.[c] ?? ''),
        );

        grid.forEach((row, r) => {
          row.forEach((value, c) => {
            timetable[startPeriod + r][startDay + c] = value;
          });
        });

        return { ...g, numDays, numPeriods, dates, periodTimes, timetable };
      }),
    })),

  updateDate: (groupId, day, value) =>
    set((s) => ({
      groups: mapGroup(s.groups, groupId, (g) => {
        if (day < 0 || day >= g.numDays) return g;
        return { ...g, dates: g.dates.map((d, i) => (i === day ? value : d)) };
      }),
    })),

  updatePeriodTime: (groupId, period, value) =>
    set((s) => ({
      groups: mapGroup(s.groups, groupId, (g) => {
        if (period < 0 || period >= g.numPeriods) return g;
        return {
          ...g,
          periodTimes: g.periodTimes.map((t, i) => (i === period ? value : t)),
        };
      }),
    })),

  resizeTimetable: (groupId, deltaPeriods, deltaDays) =>
    set((s) => ({
      groups: mapGroup(s.groups, groupId, (g) => {
        const numDays = Math.max(1, g.numDays + deltaDays);
        const numPeriods = Math.max(1, g.numPeriods + deltaPeriods);

        const dates = Array.from({ length: numDays }, (_, i) => g.dates[i] ?? '');
        const periodTimes = Array.from(
          { length: numPeriods },
          (_, i) => g.periodTimes[i] ?? '',
        );
        const timetable = Array.from({ length: numPeriods }, (_, r) =>
          Array.from({ length: numDays }, (_, c) => g.timetable[r]?.[c] ?? ''),
        );

        return { ...g, numDays, numPeriods, dates, periodTimes, timetable };
      }),
    })),

  /**
   * 첫 날짜를 기준으로 나머지 시험일을 주말을 건너뛰며 하루씩 채웁니다.
   * 원본: `auto_fill_dates()`
   */
  autoFillDates: (groupId) => {
    const group = get().groups.find((g) => g.id === groupId);
    const base = group?.dates[0]?.trim();
    if (!group || !base) return false;

    const m = base.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return false;

    const cursor = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (Number.isNaN(cursor.getTime())) return false;

    const dates = [...group.dates];
    for (let i = 1; i < group.numDays; i += 1) {
      do {
        cursor.setDate(cursor.getDate() + 1);
      } while (cursor.getDay() === 0 || cursor.getDay() === 6); // 토·일 건너뛰기
      const yyyy = cursor.getFullYear();
      const mm = String(cursor.getMonth() + 1).padStart(2, '0');
      const dd = String(cursor.getDate()).padStart(2, '0');
      dates[i] = `${yyyy}-${mm}-${dd}`;
    }

    set((s) => ({ groups: mapGroup(s.groups, groupId, (g) => ({ ...g, dates })) }));
    return true;
  },

  syncDatesFromFirstGroup: () =>
    set((s) => {
      if (s.groups.length <= 1) return s;
      const base = s.groups[0].dates;
      return {
        groups: s.groups.map((g, i) =>
          i === 0 ? g : { ...g, dates: g.dates.map((d, j) => base[j] ?? d) },
        ),
      };
    }),

  syncPeriodTimesFromFirstGroup: () =>
    set((s) => {
      if (s.groups.length <= 1) return s;
      const base = s.groups[0].periodTimes;
      return {
        groups: s.groups.map((g, i) =>
          i === 0 ? g : { ...g, periodTimes: g.periodTimes.map((t, j) => base[j] ?? t) },
        ),
      };
    }),

  updateRoomMapping: (groupId, key, value) =>
    set((s) => ({
      groups: mapGroup(s.groups, groupId, (g) => ({
        ...g,
        roomMappings: { ...g.roomMappings, [key]: value },
      })),
    })),

  setSplitMapping: (groupId, subject, rooms) =>
    set((s) => ({
      groups: mapGroup(s.groups, groupId, (g) => ({
        ...g,
        splitMappings: { ...g.splitMappings, [subject]: rooms },
      })),
    })),

  /** 분반을 되돌립니다. 각 분반에 걸어 둔 수동 시험실 지정도 함께 지웁니다. */
  clearSplitMapping: (groupId, subject) =>
    set((s) => ({
      groups: mapGroup(s.groups, groupId, (g) => {
        const splitMappings = { ...g.splitMappings };
        const rooms = splitMappings[subject] ?? [];
        delete splitMappings[subject];

        const roomMappings = { ...g.roomMappings };
        for (const room of rooms) delete roomMappings[`${subject}_${room.name}`];

        return { ...g, splitMappings, roomMappings };
      }),
    })),

  setMergeMapping: (groupId, subject, info) =>
    set((s) => ({
      groups: mapGroup(s.groups, groupId, (g) => ({
        ...g,
        mergeMappings: { ...g.mergeMappings, [subject]: info },
      })),
    })),

  /**
   * 합반을 되돌립니다. 합쳐진 시험실에 걸어 둔 수동 지정도 함께 지웁니다.
   * (구 버전 `unmerge_subject_rooms()`와 같은 동작 — 남겨 두면 다시 합칠 때
   * 예전 값이 되살아나 혼란스럽습니다.)
   */
  unmergeSubject: (groupId, subject) =>
    set((s) => ({
      groups: mapGroup(s.groups, groupId, (g) => {
        const merged = g.mergeMappings[subject];
        if (!merged) return g;

        const mergeMappings = { ...g.mergeMappings };
        delete mergeMappings[subject];

        const roomMappings = { ...g.roomMappings };
        delete roomMappings[`${subject}_${merged.mergedRoom}`];

        return { ...g, mergeMappings, roomMappings };
      }),
    })),

  /** 해당 교시의 기존 자습 배정을 지우고 새 목록으로 교체합니다. */
  setStudyAssignments: (groupId, date, period, assignments) =>
    set((s) => ({
      groups: mapGroup(s.groups, groupId, (g) => {
        const slot = makeTimeSlot(date, period);
        const kept = g.studyAssignments.filter((a) => a.timeSlot !== slot);
        return {
          ...g,
          studyAssignments: [
            ...kept,
            ...assignments.map((a) => ({ ...a, timeSlot: a.timeSlot || slot })),
          ],
        };
      }),
    })),

  /** 자동 자습 배정 결과를 한 번에 반영합니다. */
  replaceAllStudyAssignments: (byGroupId) =>
    set((s) => ({
      groups: s.groups.map((g) =>
        g.id in byGroupId ? { ...g, studyAssignments: byGroupId[g.id] } : g,
      ),
    })),

  excludeStudent: (student) =>
    set((s) => {
      const key = makeStudentKey(student.className, student.number, student.name);
      const exists = s.excludedStudents.some(
        (e) =>
          e.groupId === student.groupId &&
          makeStudentKey(e.className, e.number, e.name) === key,
      );
      return exists ? s : { excludedStudents: [...s.excludedStudents, student] };
    }),

  unexcludeStudent: (groupId, className, number, name) =>
    set((s) => {
      const key = makeStudentKey(className, number, name);
      return {
        excludedStudents: s.excludedStudents.filter(
          (e) =>
            !(
              e.groupId === groupId &&
              makeStudentKey(e.className, e.number, e.name) === key
            ),
        ),
      };
    }),

  serialize: () => ({
    version: 1,
    savedAt: new Date().toISOString(),
    groups: get().groups,
    excludedStudents: get().excludedStudents,
  }),

  hydrate: (state) =>
    set({
      groups: [...state.groups].sort(byName),
      excludedStudents: state.excludedStudents ?? [],
    }),

  reset: () => set({ groups: [], excludedStudents: [] }),
}));

/** 제외된 학생 키 집합. 결과 계산에서 학생을 걸러낼 때 씁니다. */
export function excludedKeySet(
  excluded: ExcludedStudent[],
  groupId: string,
): Set<string> {
  return new Set(
    excluded
      .filter((e) => e.groupId === groupId)
      .map((e) => makeStudentKey(e.className, e.number, e.name)),
  );
}
