"use client";

import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { GROUP_COLORS } from "./Charts";
import type { CourseRecord } from "../lib/neis";
import { GROUPS, groupOf, isGraded, weightedAverage, type Group } from "../lib/naesin";

// 졸업까지의 6개 학기를 항상 가로축에 둡니다(아직 안 온 학기는 비어 있음).
const TERMS: [number, number][] = [
  [1, 1],
  [1, 2],
  [2, 1],
  [2, 2],
  [3, 1],
  [3, 2],
];
const SUBJECT_COLORS = ["#0d9488", "#e11d48", "#d97706", "#7c3aed", "#059669", "#ea580c", "#2563eb", "#64748b", "#be185d", "#4d7c0f", "#0891b2", "#a21caf"];

const W = 900;
const H = 360;
const L = 64;
const RT = 40;
const T = 16;
const B = 44;
const x = (i: number) => L + ((W - L - RT) * i) / (TERMS.length - 1);
const y = (g: number) => T + ((H - T - B) * (g - 1)) / 8;
const termName = (i: number) => `${TERMS[i][0]}학년 ${TERMS[i][1]}학기`;
const groupLabel = (g: Group) => (g === "제2외국어" || g === "예체능·기타" ? g : `${g}계열`);
const gradeText = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(2)}등급`;

interface Series {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
}

/** 같은 학기·같은 등급 자리에 겹친 점들을 한 묶음으로 봅니다. */
interface Spot {
  key: string;
  ti: number;
  value: number;
  series: Series[];
}

export function GradeChangeChart({ courses }: { courses: CourseRecord[] }) {
  const graded = useMemo(() => courses.filter(isGraded), [courses]);
  const [tab, setTab] = useState<"all" | Group>("all");
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [pinKey, setPinKey] = useState<string | null>(null);

  const counts = useMemo(() => {
    const m = new Map<Group, number>();
    for (const c of graded) {
      const g = groupOf(c.subject);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  }, [graded]);
  const groupsPresent = GROUPS.filter((g) => (counts.get(g) ?? 0) > 0);
  const activeTab = tab === "all" || groupsPresent.includes(tab) ? tab : "all";

  const series: Series[] = useMemo(() => {
    if (activeTab === "all") {
      return groupsPresent.map((g) => ({
        key: g,
        label: groupLabel(g),
        color: GROUP_COLORS[g],
        values: TERMS.map(([yr, tm]) => {
          const list = graded.filter((c) => c.year === yr && c.term === tm && groupOf(c.subject) === g);
          return list.length ? weightedAverage(list).avg : null;
        }),
      }));
    }
    const names = [...new Set(graded.filter((c) => groupOf(c.subject) === activeTab).map((c) => c.subject))];
    return names.map((n, i) => ({
      key: n,
      label: n,
      color: SUBJECT_COLORS[i % SUBJECT_COLORS.length],
      values: TERMS.map(([yr, tm]) => graded.find((c) => c.year === yr && c.term === tm && c.subject === n)?.rankGrade ?? null),
    }));
  }, [graded, activeTab, groupsPresent]);

  // 같은 학기·같은 등급(소수 둘째 자리까지 같음)인 점은 한 자리로 묶습니다.
  const spots: Spot[] = useMemo(() => {
    const map = new Map<string, Spot>();
    series.forEach((s) =>
      s.values.forEach((v, ti) => {
        if (v == null) return;
        const key = `${ti}|${v.toFixed(2)}`;
        const cur = map.get(key);
        if (cur) cur.series.push(s);
        else map.set(key, { key, ti, value: v, series: [s] });
      }),
    );
    return [...map.values()];
  }, [series]);

  const shownKey = hoverKey ?? pinKey;
  const spot = spots.find((s) => s.key === shownKey) ?? null;
  const pinned = spot != null && spot.key === pinKey;

  const detail = (s: Series, ti: number) => {
    const [yr, tm] = TERMS[ti];
    return graded.filter((c) => c.year === yr && c.term === tm && (activeTab === "all" ? groupOf(c.subject) === s.key : c.subject === s.key));
  };

  return (
    <section className="print:hidden rounded-2xl border border-stone-200 bg-white p-4">
      <h2 className="font-bold flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-stone-500" /> 등급 변화 추이
      </h2>
      <p className="mt-1 text-xs text-stone-600">
        위로 갈수록 좋은 등급입니다. 「전체과목」은 교과마다 그 학기 과목들의 평균을 선 하나로 이어 한 그림에 겹쳐 보여 주고, 점에 올리거나 누르면 그 학기 과목과 등급이 나옵니다. 같은 자리에
        여러 개가 겹쳐 있으면 점 안의 숫자가 겹친 개수이고, 누르면 모두 보입니다. 탭으로 교과 하나만 볼 수도 있습니다. 인쇄에는 들어가지 않습니다 — 인쇄물에서는 「반영 조합별 평균 추이」와
        과목별 성적표가 이 내용을 대신합니다.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => {
            setTab("all");
            setPinKey(null);
          }}
          className={`px-3 py-1.5 rounded-full border-2 text-sm font-bold ${activeTab === "all" ? "bg-slate-700 border-slate-700 text-white" : "bg-white border-slate-400 text-slate-700 hover:bg-slate-50"}`}
        >
          전체과목 ({graded.length})
        </button>
        {groupsPresent.map((g) => {
          const on = activeTab === g;
          const c = GROUP_COLORS[g];
          return (
            <button
              key={g}
              onClick={() => {
                setTab(g);
                setPinKey(null);
              }}
              className="px-3 py-1.5 rounded-full border-2 text-sm font-bold"
              style={on ? { background: c, borderColor: c, color: "#fff" } : { background: "#fff", borderColor: c, color: c }}
            >
              {groupLabel(g)} ({counts.get(g)})
            </button>
          );
        })}
      </div>

      <div className="relative mt-3" onMouseLeave={() => setHoverKey(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="등급 변화 추이 차트">
          {/* 빈 곳을 누르면 고정을 풉니다 */}
          <rect x={0} y={0} width={W} height={H} fill="transparent" onClick={() => setPinKey(null)} />
          {Array.from({ length: 9 }, (_, i) => i + 1).map((g) => (
            <g key={g} pointerEvents="none">
              <line x1={L} x2={W - RT} y1={y(g)} y2={y(g)} className="stroke-stone-200" />
              <text x={L - 8} y={y(g)} textAnchor="end" dominantBaseline="middle" className="fill-stone-600 text-[12px]">
                {g}등급
              </text>
            </g>
          ))}
          {TERMS.map((_, i) => (
            <g key={i} pointerEvents="none">
              <line x1={x(i)} x2={x(i)} y1={T} y2={H - B} className="stroke-stone-200" />
              <text x={x(i)} y={H - B + 18} textAnchor="middle" className="fill-stone-700 text-[12px]">
                {termName(i)}
              </text>
            </g>
          ))}

          {/* 선과 점(보기 전용) */}
          {series.map((s) => {
            const pts = s.values.map((v, i) => (v == null ? null : ([x(i), y(v)] as const)));
            const line = pts
              .filter((p): p is readonly [number, number] => p != null)
              .map((p) => p.join(","))
              .join(" ");
            return (
              <g key={s.key} pointerEvents="none">
                {pts.filter(Boolean).length > 1 && (
                  <polyline points={line} fill="none" stroke={s.color} strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round" />
                )}
                {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={7} fill={s.color} stroke="#fff" strokeWidth={2} />)}
              </g>
            );
          })}

          {/* 겹친 점 묶음: 개수 표시와 클릭·호버 영역 */}
          {spots.map((sp) => {
            const on = sp.key === shownKey;
            const multi = sp.series.length > 1;
            return (
              <g key={sp.key}>
                {multi && (
                  <>
                    <circle cx={x(sp.ti)} cy={y(sp.value)} r={10} fill="#1f2937" stroke="#fff" strokeWidth={2} pointerEvents="none" />
                    <text x={x(sp.ti)} y={y(sp.value)} textAnchor="middle" dominantBaseline="central" className="fill-white text-[11px] font-bold" pointerEvents="none">
                      {sp.series.length}
                    </text>
                  </>
                )}
                {on && <circle cx={x(sp.ti)} cy={y(sp.value)} r={14} fill="none" stroke="#1f2937" strokeWidth={2} pointerEvents="none" />}
                <circle
                  cx={x(sp.ti)}
                  cy={y(sp.value)}
                  r={15}
                  fill="transparent"
                  className="cursor-pointer outline-none"
                  role="button"
                  tabIndex={0}
                  aria-label={`${termName(sp.ti)} ${gradeText(sp.value)} ${sp.series.map((s) => s.label).join(", ")}`}
                  onMouseEnter={() => setHoverKey(sp.key)}
                  onFocus={() => setHoverKey(sp.key)}
                  onBlur={() => setHoverKey(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPinKey((k) => (k === sp.key ? null : sp.key));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setPinKey((k) => (k === sp.key ? null : sp.key));
                    }
                  }}
                />
              </g>
            );
          })}
        </svg>

        {spot && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg bg-stone-900/90 px-3 py-2.5 text-sm text-white shadow-xl"
            style={{
              left: `${(x(spot.ti) / W) * 100}%`,
              top: `${(y(spot.value) / H) * 100}%`,
              transform: `translate(${x(spot.ti) > W * 0.62 ? "calc(-100% - 18px)" : "18px"}, ${y(spot.value) > H * 0.62 ? "-100%" : "-12px"})`,
              minWidth: 190,
              maxWidth: 320,
            }}
            role="status"
          >
            <p className="font-bold">
              {termName(spot.ti)} · {gradeText(spot.value)}
              {pinned && <span className="ml-2 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-medium">고정됨 — 다시 누르면 풀림</span>}
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {spot.series.map((s) => {
                const list = detail(s, spot.ti);
                return (
                  <li key={s.key}>
                    <p className="flex items-center gap-2">
                      <span className="inline-block h-3.5 w-3.5 rounded-sm border border-white/60" style={{ background: s.color }} />
                      <span className="font-semibold">
                        {s.label}
                        {activeTab === "all" && " 평균"} {gradeText(spot.value)}
                      </span>
                    </p>
                    {(activeTab === "all" || list.length > 1) && (
                      <ul className="ml-6 mt-0.5 text-white/90">
                        {list.map((c, i) => (
                          <li key={i}>
                            · {c.subject} {c.rankGrade}등급
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-stone-700">
        {series.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block w-5 h-3 rounded-sm border-2" style={{ borderColor: s.color, background: `${s.color}33` }} />
            {s.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
