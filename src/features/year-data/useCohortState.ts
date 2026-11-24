"use client";

// 기존 useState<{ pre1; grade1; grade2 }> 를 그대로 바꿔 끼울 수 있는 "입학년도 기준" 상태 훅.
// 화면(학년 자리) 값은 작업 학년도에서 계산하고, 실제 데이터는 공유 저장소(cohortStore)에 입학년도별로 보관됩니다.
// 그래서 작업 학년도를 바꿔도 데이터가 입학년도를 따라가고, 보는 범위 밖으로 밀려난 입학년도의 데이터도 남습니다.

import { useCallback, useMemo, useState } from "react";
import type { GradeKey } from "../../types";
import { useYearData } from "./YearDataContext";
import { buildView, writeView, GRADE_OFFSETS } from "./lib/cohortStore";

/** 학년 자리(K)마다 하나씩 값을 갖는 상태. name 은 저장소의 이름(저장 파일에도 이 이름으로 들어감), offsets 는 학년 자리 → 몇 해 전 입학생. */
export function useCohortState<K extends string, T>(
  name: string,
  offsets: Record<K, number>,
  /** 아직 데이터가 없는 입학년도의 기본값. 학년 자리마다 다른 기본값이 필요하면 (자리) => 값 함수로 준다. */
  defaultValue: T | ((k: K) => T),
): [Record<K, T>, React.Dispatch<React.SetStateAction<Record<K, T>>>] {
  const { workYear, cohortStore, updateCohortStore } = useYearData();
  const [def] = useState(() => defaultValue); // 렌더마다 새로 만든 기본값(예: [])이 와도 같은 참조를 쓰도록 처음 값만 보관
  const map = cohortStore[name];

  const view = useMemo(() => buildView<K, T>(map, workYear, offsets, def), [map, workYear, offsets, def]);

  const setView = useCallback<React.Dispatch<React.SetStateAction<Record<K, T>>>>(
    (u) =>
      updateCohortStore(name, (cur, W) => {
        const v = buildView<K, T>(cur, W, offsets, def);
        const next = typeof u === "function" ? (u as (p: Record<K, T>) => Record<K, T>)(v) : u;
        return writeView(cur, W, offsets, v, next);
      }),
    [name, offsets, def, updateCohortStore],
  );

  return [view, setView];
}

/**
 * 학년 이름이 앞에 붙은 키를 쓰는 평평한 맵(예: "grade1_1학기_문학" → 값)을 입학년도 기준으로 보관한다.
 * prefixes: 학년 자리 → 키 앞부분("grade1" 또는 "2"). 화면에는 예전과 같은 평평한 맵으로 보이고, 저장은 입학년도별 맵으로 한다.
 */
export function usePrefixedCohortMap<V>(
  name: string,
  prefixes: Record<GradeKey, string>,
): [Record<string, V>, React.Dispatch<React.SetStateAction<Record<string, V>>>] {
  const { workYear, cohortStore, updateCohortStore } = useYearData();
  const map = cohortStore[name];

  const flatOf = useCallback(
    (m: Record<string, unknown> | undefined, W: number) => {
      const out: Record<string, V> = {};
      (Object.keys(GRADE_OFFSETS) as GradeKey[]).forEach((g) => {
        const sub = m?.[String(W - GRADE_OFFSETS[g])] as Record<string, V> | undefined;
        if (sub) Object.entries(sub).forEach(([k, v]) => (out[`${prefixes[g]}_${k}`] = v));
      });
      return out;
    },
    [prefixes],
  );
  const flat = useMemo(() => flatOf(map, workYear), [flatOf, map, workYear]);

  const setFlat = useCallback<React.Dispatch<React.SetStateAction<Record<string, V>>>>(
    (u) =>
      updateCohortStore(name, (cur, W) => {
        const before = flatOf(cur, W);
        const next = typeof u === "function" ? (u as (p: Record<string, V>) => Record<string, V>)(before) : u;
        if (next === before) return cur;
        let out = cur;
        (Object.keys(GRADE_OFFSETS) as GradeKey[]).forEach((g) => {
          const pre = `${prefixes[g]}_`;
          const nextSub: Record<string, V> = {};
          Object.entries(next).forEach(([k, v]) => {
            if (k.startsWith(pre)) nextSub[k.slice(pre.length)] = v;
          });
          const key = String(W - GRADE_OFFSETS[g]);
          const curSub = (cur?.[key] ?? {}) as Record<string, V>;
          const same = Object.keys(nextSub).length === Object.keys(curSub).length && Object.entries(nextSub).every(([k, v]) => curSub[k] === v);
          if (!same) {
            if (out === cur) out = { ...(cur ?? {}) };
            (out as Record<string, unknown>)[key] = nextSub;
          }
        });
        return out;
      }),
    [name, prefixes, flatOf, updateCohortStore],
  );

  return [flat, setFlat];
}
