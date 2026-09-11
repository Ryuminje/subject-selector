"use client";

// 타임(구획) 배정 탭의 상태 컨테이너. 학년별(pre1/grade1/grade2) TimeAllocGradeState 를
// 들고 있고, 파생값(numTimes/ctx/assign/grid)은 활성 학년에 대해 useMemo 로 계산합니다.
//
// 1학기와 2학기는 서로 완전히 독립입니다(같은 타임을 겹쳐 써도 충돌 아님) — 그래서 정원·
// 인원초과 허용·선택과목 타임 수·반 고정 공통과목도 학기마다 따로 설정합니다
// (state.settingsBySemester, 키는 semesterKeyOf() 결과). 붙여넣기 경로처럼 학기 구분이
// 없는 데이터는 전부 같은 키(NO_SEMESTER_KEY) 하나만 쓰므로 기존과 동일하게 동작합니다.
//
// 프로젝트 JSON 저장은 getBackup()/loadBackup() 로 노출합니다.

import { useCallback, useMemo, useState } from "react";
import type { GradeKey } from "../../../types";
import {
  ALL_GRADE_KEYS,
  defaultSemesterSettings,
  emptyGradeState,
  semesterKeyOf,
  type Assignment,
  type CommonSubject,
  type RosterModel,
  type SemesterSettings,
  type TimeAllocGradeState,
} from "../types";
import { parseRoster } from "../lib/parseRoster";
import { autoPackBands, computeFixedBands, totalTimes } from "../lib/bands";
import {
  coMatrix,
  defaultSections,
  mergeAssignments,
  optimize,
  pickTimes,
  runAssign,
  type AllocContext,
  type SemesterAllocInfo,
} from "../lib/assign";
import { perTimeRows } from "../lib/gridModel";
import { rosterFromMainSurvey, type MainSurveySnapshot } from "../lib/fromMainSurvey";

type GradeMap = Record<GradeKey, TimeAllocGradeState>;
type Msg = { text: string; kind: "info" | "error" } | null;

function freshGradeMap(): GradeMap {
  return { pre1: emptyGradeState(), grade1: emptyGradeState(), grade2: emptyGradeState() };
}

function settingsOf(g: TimeAllocGradeState, key: string): SemesterSettings {
  return g.settingsBySemester[key] ?? defaultSemesterSettings();
}

function capForSubjectIdx(g: TimeAllocGradeState, idx: number): number {
  if (!g.roster) return 29;
  return settingsOf(g, semesterKeyOf(g.roster.subjects[idx])).cap;
}

/** 로스터를 새로 불러왔을 때의 기본 상태. 이미 있던 학기 설정은 그대로 이어받습니다. */
function stateForRoster(
  prev: TimeAllocGradeState,
  roster: RosterModel,
  source: "paste" | "main",
  rawText: string,
  sectionHints?: number[],
): TimeAllocGradeState {
  const anyPick = roster.groups.some((g) => g.pick > 0);
  const lastGroup = roster.groups.length - 1;
  const selected = roster.subjects.map((s) => (anyPick ? s.group === lastGroup : true));

  const keys = [...new Set(roster.subjects.map(semesterKeyOf))];
  const settingsBySemester: Record<string, SemesterSettings> = {};
  keys.forEach((key) => {
    if (prev.settingsBySemester[key]) {
      settingsBySemester[key] = prev.settingsBySemester[key];
      return;
    }
    const maxChoices = roster.students.reduce((m, st) => {
      const n = st.choices.filter((c) => selected[c] && semesterKeyOf(roster.subjects[c]) === key).length;
      return Math.max(m, n);
    }, 0);
    settingsBySemester[key] = { ...defaultSemesterSettings(), numElectiveTimes: Math.max(1, maxChoices || 8) };
  });

  const sections = roster.subjects.map((s, i) => {
    if (!selected[i]) return 0;
    const hint = sectionHints?.[i];
    if (hint !== undefined && hint > 0) return hint;
    return defaultSections(s.count, settingsBySemester[semesterKeyOf(s)].cap);
  });

  return {
    ...prev,
    rawText,
    roster,
    source,
    settingsBySemester,
    selected,
    sections,
    fixedCap: {},
    placement: roster.subjects.map(() => []),
    confirmed: false,
  };
}

export interface TimeAllocationApi {
  activeGrade: GradeKey;
  setActiveGrade: (g: GradeKey) => void;
  state: TimeAllocGradeState;
  message: Msg;
  clearMessage: () => void;

  /** 지금 로스터에 실제로 있는 학기 키 목록(정렬됨). 붙여넣기 데이터는 보통 1개("__all__"). */
  semesterKeys: string[];
  settingsOf: (key: string) => SemesterSettings;

  numTimes: number;
  bandError: string;
  assign: Assignment | null;
  /** 학생별 결과(③단계) 전용 — 체크 해제됐지만 배치가 남은 과목까지 합친 값. */
  studentAssign: Assignment | null;
  ctx: AllocContext | null;
  perTime: ReturnType<typeof perTimeRows>;
  totals: { assigned: number; unassigned: number; students: number };

  // 데이터 입력
  setRawText: (t: string) => void;
  loadFromPaste: () => void;
  loadFromMain: (snap: MainSurveySnapshot) => void;
  loadSampleText: (t: string) => void;

  // 그리드 설정 (학기별)
  setCap: (key: string, n: number) => void;
  setAllowOver: (key: string, v: boolean) => void;
  setStartLetter: (n: number) => void;
  setNumElectiveTimes: (key: string, n: number) => void;
  toggleSelected: (idx: number) => void;
  toggleGroup: (groupIdx: number, on: boolean) => void;
  setSection: (idx: number, n: number) => void;
  toggleFixedCap: (idx: number) => void;
  setFixedCap: (idx: number, n: number) => void;
  toggleCell: (idx: number, t: number) => void;
  runOptimize: () => void;
  resetPlacement: () => void;
  setConfirmed: (v: boolean) => void;

  // 공통과목 (학기별)
  setCommonOn: (key: string, v: boolean) => void;
  setCommonHours: (key: string, n: number) => void;
  updateCommonSubject: (key: string, i: number, patch: Partial<CommonSubject>) => void;
  addCommonSubject: (key: string) => void;
  removeCommonSubject: (key: string, i: number) => void;
  packCommon: (key: string) => void;

  // 저장
  getBackup: () => GradeMap;
  loadBackup: (obj: unknown) => void;
}

export function useTimeAllocation(): TimeAllocationApi {
  const [grades, setGrades] = useState<GradeMap>(freshGradeMap);
  const [activeGrade, setActiveGrade] = useState<GradeKey>("grade1");
  const [message, setMessage] = useState<Msg>(null);

  const state = grades[activeGrade];

  const patch = useCallback(
    (mut: (g: TimeAllocGradeState) => TimeAllocGradeState) => {
      setGrades((prev) => ({ ...prev, [activeGrade]: mut(prev[activeGrade]) }));
    },
    [activeGrade],
  );
  const info = useCallback((text: string) => setMessage({ text, kind: "info" }), []);
  const err = useCallback((text: string) => setMessage({ text, kind: "error" }), []);

  const semesterKeys = useMemo(
    () => (state.roster ? [...new Set(state.roster.subjects.map(semesterKeyOf))].sort() : []),
    [state.roster],
  );

  const numTimes = useMemo(() => {
    if (!state.roster || !semesterKeys.length) return 0;
    return Math.max(
      1,
      ...semesterKeys.map((key) => totalTimes(settingsOf(state, key).numElectiveTimes, settingsOf(state, key).common)),
    );
  }, [state, semesterKeys]);

  const bandInfoByKey = useMemo(() => {
    if (!state.roster) return {};
    const out: Record<string, { bandTimes: Array<Record<string, number>>; error: string }> = {};
    semesterKeys.forEach((key) => {
      out[key] = computeFixedBands({
        common: settingsOf(state, key).common,
        students: state.roster!.students,
        numTimes,
        mode: settingsOf(state, key).bandMode ?? "spread",
      });
    });
    return out;
  }, [state, semesterKeys, numTimes]);

  const bandError = semesterKeys
    .map((key) => bandInfoByKey[key]?.error)
    .filter(Boolean)
    .join(" / ");

  const ctx: AllocContext | null = useMemo(() => {
    if (!state.roster || !semesterKeys.length) return null;
    const bySemester: Record<string, SemesterAllocInfo> = {};
    semesterKeys.forEach((key) => {
      const s = settingsOf(state, key);
      bySemester[key] = {
        cap: s.cap,
        allowOver: s.allowOver,
        common: s.common,
        bandTimes: bandInfoByKey[key]?.bandTimes ?? [],
        ownTimes: totalTimes(s.numElectiveTimes, s.common),
      };
    });
    return {
      numTimes,
      subjects: state.roster.subjects,
      students: state.roster.students,
      selected: state.selected,
      fixedCap: state.fixedCap,
      bySemester,
    };
  }, [state, semesterKeys, bandInfoByKey, numTimes]);

  const assign: Assignment | null = useMemo(() => {
    if (!ctx || !state.placement.some((p) => p.length)) return null;
    return runAssign(ctx, state.placement);
  }, [ctx, state.placement]);

  // 학생별 결과(③단계)용 — 체크 해제해서 매칭 대상에서 빠졌지만 배치가 남아 있는 과목(예:
  // 1학기 결과)을 활성 과목(assign) 위에 합쳐서 보여줍니다. 그리드(②단계)·totals·perTime 은
  // 여전히 active(선택된 과목)만 쓰는 assign 을 그대로 씁니다 — 이 값은 학생별 결과 전용.
  const studentAssign: Assignment | null = useMemo(() => {
    if (!ctx || !assign) return assign;
    const frozenSelected = ctx.selected.map((sel, i) => !sel && (state.placement[i]?.length ?? 0) > 0);
    if (!frozenSelected.some(Boolean)) return assign;
    const frozen = runAssign({ ...ctx, selected: frozenSelected }, state.placement);
    return mergeAssignments(assign, frozen);
  }, [ctx, assign, state.placement]);

  const perTime = useMemo(() => {
    if (!ctx) return [];
    return perTimeRows(
      {
        numTimes,
        subjects: ctx.subjects,
        students: ctx.students,
        selected: ctx.selected,
        bySemester: ctx.bySemester,
      },
      assign,
      state.placement,
    );
  }, [ctx, numTimes, assign, state.placement]);

  const totals = useMemo(() => {
    const students = state.roster?.students.length ?? 0;
    if (!assign) return { assigned: 0, unassigned: 0, students };
    let assigned = 0;
    let unassigned = 0;
    assign.byStudent.forEach((m) => (assigned += m.size));
    assign.unassigned.forEach((u) => (unassigned += u.length));
    return { assigned, unassigned, students };
  }, [assign, state.roster]);

  // ---------- 데이터 입력 ----------
  const setRawText = useCallback((t: string) => patch((g) => ({ ...g, rawText: t })), [patch]);

  const loadFromPaste = useCallback(() => {
    setGrades((prev) => {
      const g = prev[activeGrade];
      try {
        const roster = parseRoster(g.rawText);
        const next = stateForRoster(g, roster, "paste", g.rawText);
        setMessage(
          roster.warning
            ? { text: `불러오기 완료 — ${roster.warning}`, kind: "error" }
            : {
                text: `불러오기 완료: 학생 ${roster.students.length}명, 과목 ${roster.subjects.length}개`,
                kind: "info",
              },
        );
        return { ...prev, [activeGrade]: next };
      } catch (e) {
        setMessage({ text: (e as Error).message, kind: "error" });
        return prev;
      }
    });
  }, [activeGrade]);

  const loadFromMain = useCallback(
    (snap: MainSurveySnapshot) => {
      setGrades((prev) => {
        const g = prev[activeGrade];
        const { roster, sectionHints, error } = rosterFromMainSurvey(snap, activeGrade);
        if (error) {
          setMessage({ text: error, kind: "error" });
          return prev;
        }
        const next = stateForRoster(g, roster, "main", "", sectionHints);
        setMessage({
          text: `본조사에서 불러오기 완료: 학생 ${roster.students.length}명, 과목 ${roster.subjects.length}개`,
          kind: "info",
        });
        return { ...prev, [activeGrade]: next };
      });
    },
    [activeGrade],
  );

  const loadSampleText = useCallback(
    (t: string) => {
      setGrades((prev) => {
        const g = prev[activeGrade];
        try {
          const roster = parseRoster(t);
          setMessage({ text: `샘플 불러오기 완료: 학생 ${roster.students.length}명`, kind: "info" });
          return { ...prev, [activeGrade]: stateForRoster(g, roster, "paste", t) };
        } catch (e) {
          setMessage({ text: (e as Error).message, kind: "error" });
          return prev;
        }
      });
    },
    [activeGrade],
  );

  // ---------- 그리드 설정 (학기별) ----------
  const patchSemester = useCallback(
    (key: string, mut: (s: SemesterSettings) => SemesterSettings) =>
      patch((g) => ({
        ...g,
        settingsBySemester: {
          ...g.settingsBySemester,
          [key]: mut(g.settingsBySemester[key] ?? defaultSemesterSettings()),
        },
      })),
    [patch],
  );

  const setCap = useCallback(
    (key: string, n: number) => patchSemester(key, (s) => ({ ...s, cap: Math.max(1, n || 1) })),
    [patchSemester],
  );
  const setAllowOver = useCallback(
    (key: string, v: boolean) => patchSemester(key, (s) => ({ ...s, allowOver: v })),
    [patchSemester],
  );
  const setStartLetter = useCallback((n: number) => patch((g) => ({ ...g, startLetter: n })), [patch]);

  const setNumElectiveTimes = useCallback(
    (key: string, n: number) =>
      patch((g) => {
        if (!g.roster) return g;
        const v = Math.max(1, n || 1);
        const settings = {
          ...g.settingsBySemester,
          [key]: { ...(g.settingsBySemester[key] ?? defaultSemesterSettings()), numElectiveTimes: v },
        };
        const nt = totalTimes(v, settings[key].common);
        // 이 학기 과목들만 새 범위로 잘라냅니다 — 다른 학기 배치는 그대로 둡니다.
        const placement = g.placement.map((p, idx) =>
          semesterKeyOf(g.roster!.subjects[idx]) === key ? p.filter((t) => t < nt) : p,
        );
        return { ...g, settingsBySemester: settings, placement };
      }),
    [patch],
  );

  const toggleSelected = useCallback(
    (idx: number) =>
      patch((g) => {
        if (g.confirmed || !g.roster) return g;
        const selected = g.selected.slice();
        selected[idx] = !selected[idx];
        const sections = g.sections.slice();
        if (selected[idx] && !sections[idx]) {
          sections[idx] = defaultSections(g.roster.subjects[idx].count, capForSubjectIdx(g, idx));
        }
        return { ...g, selected, sections };
      }),
    [patch],
  );

  const toggleGroup = useCallback(
    (groupIdx: number, on: boolean) =>
      patch((g) => {
        if (g.confirmed || !g.roster) return g;
        const roster = g.roster;
        const selected = g.selected.slice();
        const sections = g.sections.slice();
        roster.groups[groupIdx].cols.forEach((s) => {
          selected[s] = on;
          if (on && !sections[s]) sections[s] = defaultSections(roster.subjects[s].count, capForSubjectIdx(g, s));
        });
        return { ...g, selected, sections };
      }),
    [patch],
  );

  const setSection = useCallback(
    (idx: number, n: number) =>
      patch((g) => {
        if (g.confirmed || !g.roster) return g;
        const k = Math.max(0, Math.min(numTimes, n || 0));
        const sections = g.sections.slice();
        sections[idx] = k;
        let placement = g.placement;
        const cur = g.placement[idx] ?? [];
        if (cur.length && ctx) {
          const co = coMatrix(ctx);
          const a = runAssign(ctx, g.placement);
          let times = cur.slice();
          while (times.length > k) {
            times = times.sort((x, y) => a.load[idx][x] - a.load[idx][y]);
            times.shift();
          }
          if (times.length < k) {
            const add = pickTimes(ctx, g.placement, idx, k - times.length, co, new Set(times));
            times = [...times, ...add];
          }
          placement = g.placement.slice();
          placement[idx] = times.sort((x, y) => x - y);
        }
        return { ...g, sections, placement };
      }),
    [patch, numTimes, ctx],
  );

  const toggleFixedCap = useCallback(
    (idx: number) =>
      patch((g) => {
        if (g.confirmed) return g;
        const fixedCap = { ...g.fixedCap };
        if (idx in fixedCap) delete fixedCap[idx];
        else fixedCap[idx] = capForSubjectIdx(g, idx);
        return { ...g, fixedCap };
      }),
    [patch],
  );

  const setFixedCap = useCallback(
    (idx: number, n: number) =>
      patch((g) => {
        if (g.confirmed) return g;
        return { ...g, fixedCap: { ...g.fixedCap, [idx]: Math.max(1, n || 1) } };
      }),
    [patch],
  );

  const toggleCell = useCallback(
    (idx: number, t: number) =>
      patch((g) => {
        if (g.confirmed) return g;
        const placement = g.placement.slice();
        const cur = placement[idx] ?? [];
        placement[idx] = cur.includes(t)
          ? cur.filter((x) => x !== t)
          : [...cur, t].sort((a, b) => a - b);
        const sections = g.sections.slice();
        sections[idx] = placement[idx].length;
        return { ...g, placement, sections };
      }),
    [patch],
  );

  const runOptimize = useCallback(() => {
    if (state.confirmed) {
      err("확정 상태입니다. 확정취소 후 진행하세요.");
      return;
    }
    if (!ctx || !state.roster) {
      err("데이터가 없습니다.");
      return;
    }
    const roster = state.roster;
    const res = optimize(ctx, state.sections, 2000, Math.random, state.placement);
    const un = res.assign.unassigned.reduce((a, u) => a + u.length, 0);

    // 반 고정 공통과목을 최대한 나눠(spread) 배치했더니 선택과목 쪽에 미배정이 남으면
    // — 모든 타임이 조금씩 막혀 선택과목 배정이 빡빡해지는 게 원인 — "교사 수까지 꽉
    // 채워 뭉치기"(pack)로 자동 재시도합니다. 사용자 요청: 최대한 펼치되, 미배정이 없는
    // 선에서만 펼치고 안 되면 반을 뭉쳐도 됨.
    const spreadKeys = semesterKeys.filter((key) => (settingsOf(state, key).bandMode ?? "spread") === "spread");
    if (un > 0 && spreadKeys.length) {
      const packBySemester: Record<string, SemesterAllocInfo> = {};
      semesterKeys.forEach((key) => {
        const s = settingsOf(state, key);
        const mode = spreadKeys.includes(key) ? "pack" : (s.bandMode ?? "spread");
        packBySemester[key] = {
          cap: s.cap,
          allowOver: s.allowOver,
          common: s.common,
          bandTimes: computeFixedBands({ common: s.common, students: roster.students, numTimes, mode }).bandTimes,
          ownTimes: totalTimes(s.numElectiveTimes, s.common),
        };
      });
      const packCtx: AllocContext = { ...ctx, bySemester: packBySemester };
      const packRes = optimize(packCtx, state.sections, 2000, Math.random, state.placement);
      const packUn = packRes.assign.unassigned.reduce((a, u) => a + u.length, 0);
      if (packUn < un) {
        patch((g) => ({
          ...g,
          placement: packRes.placement,
          settingsBySemester: {
            ...g.settingsBySemester,
            ...Object.fromEntries(spreadKeys.map((key) => [key, { ...settingsOf(g, key), bandMode: "pack" as const }])),
          },
        }));
        info(`최적화 완료 (${packRes.iter}회 탐색, 미배정 ${packUn}명 — 반 고정 공통과목을 조금 더 뭉쳐 배치했습니다)`);
        return;
      }
    }

    patch((g) => ({ ...g, placement: res.placement }));
    info(`최적화 완료 (${res.iter}회 탐색, 미배정 ${un}명)`);
  }, [ctx, state, numTimes, semesterKeys, patch, info, err]);

  const resetPlacement = useCallback(() => {
    if (state.confirmed) {
      err("확정 상태입니다.");
      return;
    }
    patch((g) => ({ ...g, placement: g.roster ? g.roster.subjects.map(() => []) : [] }));
    info("초기화되었습니다.");
  }, [patch, state.confirmed, info, err]);

  const setConfirmed = useCallback(
    (v: boolean) => {
      if (v && !assign) {
        err("배정 결과가 없습니다.");
        return;
      }
      patch((g) => ({ ...g, confirmed: v }));
      info(v ? "확정되었습니다." : "확정이 취소되었습니다.");
    },
    [patch, assign, info, err],
  );

  // ---------- 공통과목 (학기별) ----------
  const applySemesterCommon = useCallback(
    (key: string, mut: (s: SemesterSettings) => SemesterSettings) =>
      patch((g) => {
        if (!g.roster) return g;
        const next = mut(g.settingsBySemester[key] ?? defaultSemesterSettings());
        const nt = totalTimes(next.numElectiveTimes, next.common);
        const placement = g.placement.map((p, idx) =>
          semesterKeyOf(g.roster!.subjects[idx]) === key ? p.filter((t) => t < nt) : p,
        );
        return { ...g, settingsBySemester: { ...g.settingsBySemester, [key]: next }, placement };
      }),
    [patch],
  );

  const setCommonOn = useCallback(
    (key: string, v: boolean) => {
      if (state.confirmed) return err("확정 상태입니다.");
      applySemesterCommon(key, (s) => ({ ...s, common: { ...s.common, on: v } }));
    },
    [state.confirmed, applySemesterCommon, err],
  );
  const setCommonHours = useCallback(
    (key: string, n: number) => {
      if (state.confirmed) return err("확정 상태입니다.");
      applySemesterCommon(key, (s) => ({ ...s, common: autoPackBands({ ...s.common, hours: Math.max(1, n || 1) }) }));
    },
    [state.confirmed, applySemesterCommon, err],
  );
  const updateCommonSubject = useCallback(
    (key: string, i: number, p: Partial<CommonSubject>) => {
      if (state.confirmed) return err("확정 상태입니다.");
      applySemesterCommon(key, (s) => ({
        ...s,
        common: { ...s.common, subjects: s.common.subjects.map((sub, j) => (j === i ? { ...sub, ...p } : sub)) },
      }));
    },
    [state.confirmed, applySemesterCommon, err],
  );
  const addCommonSubject = useCallback(
    (key: string) => {
      if (state.confirmed) return err("확정 상태입니다.");
      const classCount = state.roster
        ? new Set(state.roster.students.map((s) => s.classNum || s.id.slice(0, -2))).size
        : 1;
      applySemesterCommon(key, (s) => ({
        ...s,
        common: autoPackBands({
          ...s.common,
          subjects: [...s.common.subjects, { name: "새 공통과목", credits: 1, teachers: Math.max(1, classCount), band: 0 }],
        }),
      }));
    },
    [state.confirmed, state.roster, applySemesterCommon, err],
  );
  const removeCommonSubject = useCallback(
    (key: string, i: number) => {
      if (state.confirmed) return err("확정 상태입니다.");
      applySemesterCommon(key, (s) => ({
        ...s,
        common: autoPackBands({ ...s.common, subjects: s.common.subjects.filter((_, j) => j !== i) }),
      }));
    },
    [state.confirmed, applySemesterCommon, err],
  );
  const packCommon = useCallback(
    (key: string) => {
      if (state.confirmed) return err("확정 상태입니다.");
      applySemesterCommon(key, (s) => ({ ...s, common: autoPackBands(s.common) }));
    },
    [state.confirmed, applySemesterCommon, err],
  );

  // ---------- 저장 ----------
  const getBackup = useCallback((): GradeMap => grades, [grades]);
  const loadBackup = useCallback((obj: unknown) => {
    if (!obj || typeof obj !== "object") return;
    const incoming = obj as Partial<GradeMap>;
    setGrades(() => {
      const next = freshGradeMap();
      for (const gk of ALL_GRADE_KEYS) {
        const v = incoming[gk];
        if (v && typeof v === "object") next[gk] = { ...emptyGradeState(), ...v };
      }
      return next;
    });
  }, []);

  return {
    activeGrade,
    setActiveGrade,
    state,
    message,
    clearMessage: () => setMessage(null),
    semesterKeys,
    settingsOf: (key: string) => settingsOf(state, key),
    numTimes,
    bandError,
    assign,
    studentAssign,
    ctx,
    perTime,
    totals,
    setRawText,
    loadFromPaste,
    loadFromMain,
    loadSampleText,
    setCap,
    setAllowOver,
    setStartLetter,
    setNumElectiveTimes,
    toggleSelected,
    toggleGroup,
    setSection,
    toggleFixedCap,
    setFixedCap,
    toggleCell,
    runOptimize,
    resetPlacement,
    setConfirmed,
    setCommonOn,
    setCommonHours,
    updateCommonSubject,
    addCommonSubject,
    removeCommonSubject,
    packCommon,
    getBackup,
    loadBackup,
  };
}
