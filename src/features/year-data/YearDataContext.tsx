"use client";

// 수강신청 도우미 "1년 데이터" 공유 저장소.
// 수요조사·본조사·선택과목 변경 탭이 같이 쓰는 편성표·위계·학생 명단을 한 곳에 둡니다(한 번 입력하면 모든 탭에 반영).
//
// 편성표는 입학년도별로 보관합니다(lib/cohortCurriculum). 다른 탭이 보는 학년 키(pre1/grade1/grade2 = 내년 1/2/3학년)는
// 작업 학년도(workYear)에서 계산한 화면이라, 해가 바뀌어 작업 학년도만 올리면 화면이 한 학년씩 밀리고 편성표를 다시 올릴 필요가 없습니다.
// 선택과목 변경 탭은 grade2/grade3 로 부르는 같은 학년을 useChangeCurriculum 이 변환해 씁니다.
// 위계 규칙은 모든 입학년도가 같은 한 벌입니다.

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type {
  DesignatedSubject,
  GradeKey,
  HierarchyRule,
  ParsedCurriculumSubject,
  SelectedSubjectHours,
  SubjectMap,
} from "../../types";
import { readCurriculumRows } from "./lib/parseCurriculum";
import {
  cohortOfGradeKey,
  deriveCohort,
  deriveViews,
  emptyCohort,
  makeViewSetter,
  mergeHierarchyWrite,
  type Cohorts,
} from "./lib/cohortCurriculum";
import type { PromotionEntry } from "../main-survey/lib/promotion";
import { rosterToPromotionEntries, type RosterStudent } from "./lib/roster";
import type { DemandResult } from "./lib/demandOutcome";
import type { CohortStore } from "./lib/cohortStore";

export type PerGrade<T> = { [key in GradeKey]: T };
type Setter<T> = React.Dispatch<React.SetStateAction<PerGrade<T>>>;

export interface YearData {
  parsedCurriculumList: PerGrade<ParsedCurriculumSubject[]>;
  setParsedCurriculumList: Setter<ParsedCurriculumSubject[]>;
  subjectMap: PerGrade<SubjectMap>;
  setSubjectMap: Setter<SubjectMap>;
  isCurriculumParsed: PerGrade<boolean>;
  setIsCurriculumParsed: Setter<boolean>;
  /** 학년 화면 세 개가 모두 같은 한 벌(모든 입학년도 공통) */
  hierarchyRules: PerGrade<HierarchyRule[]>;
  setHierarchyRules: Setter<HierarchyRule[]>;
  designatedSubjects: PerGrade<DesignatedSubject[]>;
  setDesignatedSubjects: Setter<DesignatedSubject[]>;
  selectedSubjectHours: PerGrade<SelectedSubjectHours[]>;
  setSelectedSubjectHours: Setter<SelectedSubjectHours[]>;
  /** 편성표 엑셀을 그 학년 화면에 해당하는 입학년도의 편성표로 저장합니다. 다른 입학년도는 건드리지 않고,
   *  어느 탭에서 올려도 같은 학년이면 모든 탭이 같이 씁니다. */
  applyCurriculumFile: (binary: string, grade: GradeKey) => void;
  /** 그 학년 화면 과목의 교과(군)을 고친 값으로 덮어씁니다(편성표를 다시 올리면 초기화). */
  setCategoryOverride: (grade: GradeKey, subject: string, category: string) => void;
  /** 입학년도별 편성표(저장 파일용) */
  cohorts: Cohorts;
  setCohorts: React.Dispatch<React.SetStateAction<Cohorts>>;
  /** 모든 입학년도 공통 위계(저장 파일용) */
  hierarchy: HierarchyRule[];
  setHierarchy: React.Dispatch<React.SetStateAction<HierarchyRule[]>>;
  /** 작업 학년도 — 수강신청을 받는 해(예: 2027). 예비 1학년 = 이 해 입학생, 1학년 = 전년도 입학생 … */
  workYear: number;
  setWorkYear: React.Dispatch<React.SetStateAction<number>>;
  /** 학생 명단 — 입학년도별로 누적(학년별 학번 + 상태). 전교생 한 벌이며 모든 탭이 같이 씁니다. */
  roster: RosterStudent[];
  setRoster: React.Dispatch<React.SetStateAction<RosterStudent[]>>;
  /** 명단에서 계산한 진급 학번 쌍(올해 학번 → 진급학번, 전출·퇴학 제외). 본조사 진급 적용이 씁니다. */
  promotionEntries: PromotionEntry[];
  /** 본조사로 가져온 수요조사 결과(과목별 신청자·개설 반 수·폐강) — 입학년도별 */
  demandResults: Record<string, DemandResult>;
  setDemandResults: React.Dispatch<React.SetStateAction<Record<string, DemandResult>>>;
  /** 각 탭이 학년 자리별로 들고 있던 데이터(업로드·결과·학급 수·변경 탭 …)를 입학년도 기준으로 보관: 저장소[이름][입학년도] */
  cohortStore: CohortStore;
  setCohortStore: React.Dispatch<React.SetStateAction<CohortStore>>;
  /** 한 이름의 입학년도별 값을 (현재 값, 작업 학년도) → 새 값으로 갱신(useCohortState 가 쓴다) */
  updateCohortStore: (
    name: string,
    fn: (cur: Record<string, unknown> | undefined, workYear: number) => Record<string, unknown> | undefined,
  ) => void;
}

const YearDataContext = createContext<YearData | null>(null);

export function YearDataProvider({ children }: { children: React.ReactNode }) {
  // 작업 학년도와 입학년도별 편성표는 한 상태로 묶어, setter 가 항상 최신 작업 학년도를 보고 갱신하게 한다
  const [store, setStore] = useState<{ workYear: number; cohorts: Cohorts; cohortStore: CohortStore }>({ workYear: 2027, cohorts: {}, cohortStore: {} });
  const { workYear, cohorts, cohortStore } = store;
  const [hierarchy, setHierarchy] = useState<HierarchyRule[]>([]);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [demandResults, setDemandResults] = useState<Record<string, DemandResult>>({});
  const promotionEntries = useMemo(() => rosterToPromotionEntries(roster, workYear), [roster, workYear]);

  const updateCohorts = useCallback(
    (fn: (prev: Cohorts, workYear: number) => Cohorts) =>
      setStore((s) => {
        const next = fn(s.cohorts, s.workYear);
        return next === s.cohorts ? s : { ...s, cohorts: next };
      }),
    [],
  );
  const setCohorts = useCallback<React.Dispatch<React.SetStateAction<Cohorts>>>(
    (u) => updateCohorts((prev) => (typeof u === "function" ? u(prev) : u)),
    [updateCohorts],
  );
  const setCohortStore = useCallback<React.Dispatch<React.SetStateAction<CohortStore>>>(
    (u) => setStore((s) => ({ ...s, cohortStore: typeof u === "function" ? u(s.cohortStore) : u })),
    [],
  );
  const updateCohortStore = useCallback<YearData["updateCohortStore"]>((name, fn) => {
    setStore((s) => {
      const cur = s.cohortStore[name];
      const next = fn(cur, s.workYear);
      return next === cur ? s : { ...s, cohortStore: { ...s.cohortStore, [name]: next ?? {} } };
    });
  }, []);
  const setWorkYear = useCallback<React.Dispatch<React.SetStateAction<number>>>(
    (u) => setStore((s) => ({ ...s, workYear: typeof u === "function" ? u(s.workYear) : u })),
    [],
  );

  const views = useMemo(() => deriveViews(cohorts, workYear), [cohorts, workYear]);

  const setters = useMemo(
    () => ({
      parsed: makeViewSetter("parsed", updateCohorts),
      map: makeViewSetter("map", updateCohorts),
      designated: makeViewSetter("designated", updateCohorts),
      selected: makeViewSetter("selected", updateCohorts),
      isParsed: makeViewSetter("isParsed", updateCohorts),
    }),
    [updateCohorts],
  );

  const hierarchyRules = useMemo<PerGrade<HierarchyRule[]>>(
    () => ({ pre1: hierarchy, grade1: hierarchy, grade2: hierarchy }),
    [hierarchy],
  );
  const setHierarchyRules = useCallback<Setter<HierarchyRule[]>>((u) => {
    setHierarchy((prev) => {
      const view: PerGrade<HierarchyRule[]> = { pre1: prev, grade1: prev, grade2: prev };
      const next = typeof u === "function" ? u(view) : u;
      return mergeHierarchyWrite(prev, next);
    });
  }, []);

  const applyCurriculumFile = useCallback(
    (binary: string, grade: GradeKey) => {
      const rows = readCurriculumRows(binary);
      updateCohorts((prev, W) => ({ ...prev, [String(cohortOfGradeKey(W, grade))]: { ...emptyCohort(), rows } }));
    },
    [updateCohorts],
  );

  const setCategoryOverride = useCallback((grade: GradeKey, subject: string, category: string) => {
    updateCohorts((prev, W) => {
      const key = String(cohortOfGradeKey(W, grade));
      const cur = prev[key] ?? emptyCohort();
      if (cur.rows) {
        return { ...prev, [key]: { ...cur, categoryOverrides: { ...cur.categoryOverrides, [subject]: category } } };
      }
      // 옛 저장 파일의 값이면 그 값을 직접 고친다
      const l = deriveCohort(cur, grade);
      return {
        ...prev,
        [key]: {
          ...cur,
          legacy: {
            ...cur.legacy,
            parsed: l.parsed.map((p) => (p.subject === subject ? { ...p, category } : p)),
            designated: l.designated.map((d) => (d.subject === subject ? { ...d, detailedCategory: category } : d)),
            selected: l.selected.map((d) => (d.subject === subject ? { ...d, detailedCategory: category } : d)),
          },
        },
      };
    });
  }, [updateCohorts]);

  const value = useMemo<YearData>(
    () => ({
      parsedCurriculumList: views.parsed, setParsedCurriculumList: setters.parsed,
      subjectMap: views.map, setSubjectMap: setters.map,
      isCurriculumParsed: views.isParsed, setIsCurriculumParsed: setters.isParsed,
      hierarchyRules, setHierarchyRules,
      designatedSubjects: views.designated, setDesignatedSubjects: setters.designated,
      selectedSubjectHours: views.selected, setSelectedSubjectHours: setters.selected,
      applyCurriculumFile,
      setCategoryOverride,
      cohorts, setCohorts,
      hierarchy, setHierarchy,
      workYear, setWorkYear,
      roster, setRoster,
      promotionEntries,
      demandResults, setDemandResults,
      cohortStore, setCohortStore, updateCohortStore,
    }),
    [views, setters, hierarchyRules, setHierarchyRules, applyCurriculumFile, setCategoryOverride, cohorts, setCohorts, hierarchy, workYear, setWorkYear, roster, promotionEntries, demandResults, cohortStore, setCohortStore, updateCohortStore],
  );

  return <YearDataContext.Provider value={value}>{children}</YearDataContext.Provider>;
}

export function useYearData(): YearData {
  const ctx = useContext(YearDataContext);
  if (!ctx) throw new Error("useYearData 는 YearDataProvider 안에서만 쓸 수 있습니다.");
  return ctx;
}
