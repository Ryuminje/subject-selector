"use client";

// 타임(구획) 배정 탭의 상태 컨테이너. 학년별(pre1/grade1/grade2) TimeAllocGradeState 를
// 들고 있고, 파생값(numTimes/bandTimes/assign/grid)은 활성 학년에 대해 useMemo 로 계산합니다.
// 프로젝트 JSON 저장은 getBackup()/loadBackup() 로 노출합니다.

import { useCallback, useMemo, useState } from "react";
import type { GradeKey } from "../../../types";
import {
  ALL_GRADE_KEYS,
  emptyGradeState,
  type Assignment,
  type CommonConfig,
  type CommonSubject,
  type RosterModel,
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
} from "../lib/assign";
import { perTimeRows } from "../lib/gridModel";
import { rosterFromMainSurvey, type MainSurveySnapshot } from "../lib/fromMainSurvey";

type GradeMap = Record<GradeKey, TimeAllocGradeState>;
type Msg = { text: string; kind: "info" | "error" } | null;

function freshGradeMap(): GradeMap {
  return { pre1: emptyGradeState(), grade1: emptyGradeState(), grade2: emptyGradeState() };
}

/** 로스터를 새로 불러왔을 때의 기본 상태(cap/common/startLetter 등 이전 설정은 유지). */
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
  const maxChoices = roster.students.reduce(
    (m, st) => Math.max(m, st.choices.filter((c) => selected[c]).length),
    0,
  );
  const sections = roster.subjects.map((s, i) => {
    if (!selected[i]) return 0;
    const hint = sectionHints?.[i];
    return hint !== undefined && hint > 0 ? hint : defaultSections(s.count, prev.cap);
  });
  return {
    ...prev,
    rawText,
    roster,
    source,
    numElectiveTimes: Math.max(1, maxChoices || (anyPick ? roster.groups[lastGroup]?.pick : 8) || 8),
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

  // 그리드 설정
  setCap: (n: number) => void;
  setAllowOver: (v: boolean) => void;
  setStartLetter: (n: number) => void;
  setNumElectiveTimes: (n: number) => void;
  toggleSelected: (idx: number) => void;
  toggleGroup: (groupIdx: number, on: boolean) => void;
  setSection: (idx: number, n: number) => void;
  toggleFixedCap: (idx: number) => void;
  setFixedCap: (idx: number, n: number) => void;
  toggleCell: (idx: number, t: number) => void;
  runOptimize: () => void;
  runAssignNow: () => void;
  resetPlacement: () => void;
  setConfirmed: (v: boolean) => void;

  // 공통과목
  setCommonOn: (v: boolean) => void;
  setCommonHours: (n: number) => void;
  updateCommonSubject: (i: number, patch: Partial<CommonSubject>) => void;
  addCommonSubject: () => void;
  removeCommonSubject: (i: number) => void;
  packCommon: () => void;

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

  const numTimes = state.roster ? totalTimes(state.numElectiveTimes, state.common) : 0;

  const fixedBands = useMemo(() => {
    if (!state.roster) return { bandTimes: [] as Array<Record<string, number>>, error: "" };
    return computeFixedBands({ common: state.common, students: state.roster.students, numTimes });
  }, [state.roster, state.common, numTimes]);

  const ctx: AllocContext | null = useMemo(() => {
    if (!state.roster) return null;
    return {
      numTimes,
      cap: state.cap,
      allowOver: state.allowOver,
      subjects: state.roster.subjects,
      students: state.roster.students,
      selected: state.selected,
      fixedCap: state.fixedCap,
      common: state.common,
      bandTimes: fixedBands.bandTimes,
    };
  }, [
    state.roster,
    numTimes,
    state.cap,
    state.allowOver,
    state.selected,
    state.fixedCap,
    state.common,
    fixedBands.bandTimes,
  ]);

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
        common: ctx.common,
        bandTimes: ctx.bandTimes,
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

  // ---------- 그리드 설정 ----------
  const setCap = useCallback((n: number) => patch((g) => ({ ...g, cap: Math.max(1, n || 1) })), [patch]);
  const setAllowOver = useCallback((v: boolean) => patch((g) => ({ ...g, allowOver: v })), [patch]);
  const setStartLetter = useCallback((n: number) => patch((g) => ({ ...g, startLetter: n })), [patch]);

  const setNumElectiveTimes = useCallback(
    (n: number) =>
      patch((g) => {
        const v = Math.max(1, n || 1);
        const nt = totalTimes(v, g.common);
        return { ...g, numElectiveTimes: v, placement: g.placement.map((p) => p.filter((t) => t < nt)) };
      }),
    [patch],
  );

  // 체크 해제해도 배치(placement)는 지우지 않습니다 — 1학기 배정 결과를 남겨둔 채 2학기만
  // 선택해서 따로 배정하고, 나중에 다시 체크하면 이전 배치가 복원되도록 하기 위함입니다.
  // (배정과목 선택에서 빠진 과목은 매칭·그리드 표시에서만 제외되고 데이터는 그대로 남습니다.)
  const toggleSelected = useCallback(
    (idx: number) =>
      patch((g) => {
        if (g.confirmed || !g.roster) return g;
        const selected = g.selected.slice();
        selected[idx] = !selected[idx];
        const sections = g.sections.slice();
        if (selected[idx] && !sections[idx]) sections[idx] = defaultSections(g.roster.subjects[idx].count, g.cap);
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
          if (on && !sections[s]) sections[s] = defaultSections(roster.subjects[s].count, g.cap);
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
        if (cur.length) {
          const tmpCtx: AllocContext = {
            numTimes,
            cap: g.cap,
            allowOver: g.allowOver,
            subjects: g.roster.subjects,
            students: g.roster.students,
            selected: g.selected,
            fixedCap: g.fixedCap,
            common: g.common,
            bandTimes: fixedBands.bandTimes,
          };
          const co = coMatrix(tmpCtx);
          const a = runAssign(tmpCtx, g.placement);
          let times = cur.slice();
          while (times.length > k) {
            times = times.sort((x, y) => a.load[idx][x] - a.load[idx][y]);
            times.shift();
          }
          if (times.length < k) {
            const add = pickTimes(tmpCtx, g.placement, idx, k - times.length, co, new Set(times));
            times = [...times, ...add];
          }
          placement = g.placement.slice();
          placement[idx] = times.sort((x, y) => x - y);
        }
        return { ...g, sections, placement };
      }),
    [patch, numTimes, fixedBands.bandTimes],
  );

  const toggleFixedCap = useCallback(
    (idx: number) =>
      patch((g) => {
        if (g.confirmed) return g;
        const fixedCap = { ...g.fixedCap };
        if (idx in fixedCap) delete fixedCap[idx];
        else fixedCap[idx] = g.cap;
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
    if (!ctx) {
      err("데이터가 없습니다.");
      return;
    }
    const res = optimize(ctx, state.sections, 2000, Math.random, state.placement);
    patch((g) => ({ ...g, placement: res.placement }));
    const un = res.assign.unassigned.reduce((a, u) => a + u.length, 0);
    info(`최적화 완료 (${res.iter}회 탐색, 미배정 ${un}명)`);
  }, [ctx, state.sections, state.placement, state.confirmed, patch, info, err]);

  const runAssignNow = useCallback(() => {
    if (state.confirmed) {
      err("확정 상태입니다.");
      return;
    }
    if (!ctx) {
      err("데이터가 없습니다.");
      return;
    }
    if (!state.placement.some((p) => p.length)) {
      err("분반 배치가 없습니다. 먼저 최적화를 실행하거나 셀을 클릭해 분반을 배치하세요.");
      return;
    }
    const a = runAssign(ctx, state.placement);
    const un = a.unassigned.reduce((acc, u) => acc + u.length, 0);
    info(`배정 완료 (미배정 ${un}명)`);
  }, [ctx, state.placement, state.confirmed, info, err]);

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

  // ---------- 공통과목 ----------
  const applyCommon = useCallback(
    (next: CommonConfig) =>
      patch((g) => {
        const nt = totalTimes(g.numElectiveTimes, next);
        return { ...g, common: next, placement: g.placement.map((p) => p.filter((t) => t < nt)) };
      }),
    [patch],
  );

  const setCommonOn = useCallback(
    (v: boolean) => {
      if (state.confirmed) return err("확정 상태입니다.");
      applyCommon({ ...state.common, on: v });
    },
    [state.common, state.confirmed, applyCommon, err],
  );
  const setCommonHours = useCallback(
    (n: number) => {
      if (state.confirmed) return err("확정 상태입니다.");
      applyCommon(autoPackBands({ ...state.common, hours: Math.max(1, n || 1) }));
    },
    [state.common, state.confirmed, applyCommon, err],
  );
  const updateCommonSubject = useCallback(
    (i: number, p: Partial<CommonSubject>) => {
      if (state.confirmed) return err("확정 상태입니다.");
      const subjects = state.common.subjects.map((s, j) => (j === i ? { ...s, ...p } : s));
      applyCommon({ ...state.common, subjects });
    },
    [state.common, state.confirmed, applyCommon, err],
  );
  const addCommonSubject = useCallback(() => {
    if (state.confirmed) return err("확정 상태입니다.");
    const classCount = state.roster
      ? new Set(state.roster.students.map((s) => s.classNum || s.id.slice(0, -2))).size
      : 1;
    const subjects = [
      ...state.common.subjects,
      { name: "새 공통과목", credits: 1, teachers: Math.max(1, classCount), band: 0 },
    ];
    applyCommon(autoPackBands({ ...state.common, subjects }));
  }, [state.common, state.roster, state.confirmed, applyCommon, err]);
  const removeCommonSubject = useCallback(
    (i: number) => {
      if (state.confirmed) return err("확정 상태입니다.");
      const subjects = state.common.subjects.filter((_, j) => j !== i);
      applyCommon(autoPackBands({ ...state.common, subjects }));
    },
    [state.common, state.confirmed, applyCommon, err],
  );
  const packCommon = useCallback(() => {
    if (state.confirmed) return err("확정 상태입니다.");
    applyCommon(autoPackBands(state.common));
  }, [state.common, state.confirmed, applyCommon, err]);

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
    numTimes,
    bandError: fixedBands.error,
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
    runAssignNow,
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
