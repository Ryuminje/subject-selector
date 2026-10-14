// 입결 자료와 학생 성적 비교(순수 함수). 결과는 상담용 "참고" 위치이며 합격 예측이 아닙니다.
//  - 수시: 학생 내신 평균등급 ↔ 합격자 등급 50%·70% 컷 (등급이 낮을수록 좋음)
//  - 정시: 학생 국·수·탐 백분위 평균 ↔ 합격자 백분위 50%·70% 컷 (높을수록 좋음)

import type { AdmKind, AdmRow } from "./admission";

export type Fit = "safe" | "fair" | "reach" | "high";

export const FIT_LABEL: Record<Fit, string> = { safe: "안정", fair: "적정", reach: "소신", high: "상향" };
export const FIT_ORDER: Fit[] = ["safe", "fair", "reach", "high"];

/** 소신으로 보는 범위: 수시는 70% 컷보다 0.5등급 이내, 정시는 70% 컷보다 5점 이내 */
export const REACH_GRADE = 0.5;
export const REACH_PCT = 5;

/** 같은 대학·전형·학과의 연도별 입결을 한 줄로 묶습니다. */
export interface Offer {
  key: string;
  kind: AdmKind;
  univ: string;
  track: string;
  dept: string;
  type: string;
  field: string;
  region: string;
  years: Map<number, AdmRow>;
}

export function groupOffers(rows: AdmRow[]): Offer[] {
  const map = new Map<string, Offer>();
  for (const r of rows) {
    if (r.year == null) continue;
    const key = `${r.univ}|${r.track}|${r.dept}`;
    let o = map.get(key);
    if (!o) {
      o = { key, kind: r.kind, univ: r.univ, track: r.track, dept: r.dept, type: r.type, field: r.field, region: r.region, years: new Map() };
      map.set(key, o);
    }
    o.years.set(r.year, r);
  }
  return [...map.values()];
}

const hasCut = (r: AdmRow) => (r.kind === "susi" ? r.g50 != null || r.g70 != null : r.p50 != null || r.p70 != null);

/** 컷이 있는 가장 최근 연도의 행 */
export function latestWithCut(o: Offer): AdmRow | null {
  const ys = [...o.years.keys()].sort((a, b) => b - a);
  for (const y of ys) {
    const r = o.years.get(y)!;
    if (hasCut(r)) return r;
  }
  return null;
}

export interface Judge {
  fit: Fit;
  /** 기준 연도 */
  year: number;
  /** 양수 = 여유(등급은 컷보다 좋음, 백분위는 컷보다 높음) */
  margin: number;
  /** 판정에 쓴 컷(등급 또는 백분위): 50%, 70% */
  cut50: number | null;
  cut70: number | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * 판정. my 는 수시면 내신 평균등급, 정시면 국·수·탐 백분위 평균.
 * 컷이 없으면 null.
 */
export function judge(o: Offer, my: number | null): Judge | null {
  if (my == null) return null;
  const r = latestWithCut(o);
  if (!r) return null;
  if (r.kind === "susi") {
    const a = r.g50 ?? (r.g70 as number);
    const b = r.g70 ?? (r.g50 as number);
    const bottom = Math.min(a, b); // 더 좋은(작은) 등급
    const top = Math.max(a, b); // 합격자 70% 지점
    const fit: Fit = my <= bottom ? "safe" : my <= top ? "fair" : my <= top + REACH_GRADE ? "reach" : "high";
    return { fit, year: r.year as number, margin: r2(top - my), cut50: r.g50, cut70: r.g70 };
  }
  const a = r.p50 ?? (r.p70 as number);
  const b = r.p70 ?? (r.p50 as number);
  const top = Math.max(a, b);
  const bottom = Math.min(a, b);
  const fit: Fit = my >= top ? "safe" : my >= bottom ? "fair" : my >= bottom - REACH_PCT ? "reach" : "high";
  return { fit, year: r.year as number, margin: r2(my - bottom), cut50: r.p50, cut70: r.p70 };
}

/** 최근 두 해의 컷 변화. 수시는 등급 숫자가 작아지면 "어려워짐", 정시는 백분위가 올라가면 "어려워짐". */
export function trend(o: Offer): { delta: number; harder: boolean } | null {
  const pick = (r: AdmRow) => (r.kind === "susi" ? (r.g70 ?? r.g50) : (r.p70 ?? r.p50));
  const rows = [...o.years.keys()]
    .sort((a, b) => b - a)
    .map((y) => o.years.get(y) as AdmRow)
    .filter((r) => pick(r) != null);
  if (rows.length < 2) return null;
  const d = r2((pick(rows[0]) as number) - (pick(rows[1]) as number));
  if (d === 0) return { delta: 0, harder: false };
  return { delta: d, harder: o.kind === "susi" ? d < 0 : d > 0 };
}
