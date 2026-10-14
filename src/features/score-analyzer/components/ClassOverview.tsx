"use client";

import { useMemo, useState } from "react";
import { Lock, Users } from "lucide-react";
import type { CourseRecord, NeisStudent } from "../lib/neis";
import { COMBOS, GROUPS, groupOf, isGraded, termsOf, weightedAverage } from "../lib/naesin";

const f2 = (n: number | null | undefined) => (n == null ? "—" : n.toFixed(2));
const keyOf = (s: NeisStudent) => `${s.num}|${s.name}`;
const termName = (year: number, term: number) => `${year}학년 ${term}학기`;
const MINUS = "−";

interface Props {
  students: NeisStudent[];
  selectedKey: string;
  onSelect: (key: string) => void;
}

const gradeBadge = (g: number) =>
  g <= 2
    ? "bg-emerald-100 text-emerald-800"
    : g <= 4
      ? "bg-yellow-100 text-yellow-800"
      : g === 5
        ? "bg-orange-100 text-orange-800"
        : g <= 7
          ? "bg-rose-100 text-rose-800"
          : "bg-red-200 text-red-900";

/** 교사용 "학급 한눈에 보기": 다른 학생의 이름·성적이 나오므로 인쇄하지 않습니다. */
export function ClassOverview({ students, selectedKey, onSelect }: Props) {
  const [threshold, setThreshold] = useState(0.5);
  const [termSel, setTermSel] = useState("");

  const data = useMemo(() => {
    const allCourses = students.flatMap((s) => s.courses);
    const terms = termsOf(allCourses);
    const last = terms[terms.length - 1] ?? null;
    const prev = terms[terms.length - 2] ?? null;
    const kem = COMBOS.find((c) => c.key === "kem")!;
    const rows = students.map((s) => {
      const termAvg = (t: { year: number; term: number } | null) =>
        t ? weightedAverage(s.courses.filter((c) => c.year === t.year && c.term === t.term)).avg : null;
      return {
        student: s,
        key: keyOf(s),
        all: weightedAverage(s.courses).avg,
        kem: weightedAverage(s.courses.filter((c) => kem.has(groupOf(c.subject)))).avg,
        prevAvg: termAvg(prev),
        lastAvg: termAvg(last),
      };
    });
    return { rows, last, prev, terms };
  }, [students]);

  const { rows, last, prev, terms } = data;
  // 과목별 학급 평균 표의 기준 학기: 처음에는 가장 최근 학기, 고른 학기가 없으면 최근으로 돌아갑니다.
  const sel = terms.find((t) => t.key === termSel) ?? last;
  const withAll = rows.filter((r) => r.all != null);
  const mean = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x != null);
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
  };
  const classAll = mean(rows.map((r) => r.all));
  const classKem = mean(rows.map((r) => r.kem));
  const me = rows.find((r) => r.key === selectedKey) ?? null;
  const myRank = me && me.all != null ? 1 + withAll.filter((r) => (r.all as number) < (me.all as number)).length : null;

  // 분포: 0.5등급 간격
  const myAll = me?.all ?? null;
  const bins = useMemo(() => {
    const vals = rows.map((r) => r.all).filter((v): v is number => v != null);
    if (!vals.length) return [] as { lo: number; hi: number; n: number; mine: boolean }[];
    const lo = Math.max(1, Math.floor(Math.min(...vals) * 2) / 2);
    const hi = Math.ceil((Math.max(...vals) + 0.0001) * 2) / 2;
    const out: { lo: number; hi: number; n: number; mine: boolean }[] = [];
    for (let a = lo; a < hi - 0.0001; a += 0.5) {
      const b = a + 0.5;
      const n = vals.filter((v) => v >= a && v < b).length;
      out.push({ lo: a, hi: b, n, mine: myAll != null && myAll >= a && myAll < b });
    }
    return out;
  }, [rows, myAll]);

  // 선택한 학기의 과목별 학급 평균: 선택한 학생이 수강한 과목만 보여 줍니다.
  // 이수/미이수(P) 과목은 표시하지 않고, 석차등급이 없는 성취도(A·B·C) 과목은
  // 평균 등급 대신 성취도 분포로 보여 줍니다.
  const subjectTable = useMemo(() => {
    if (!sel) return [];
    const inTerm = (c: CourseRecord) => c.year === sel.year && c.term === sel.term && !c.passFail;
    const stat = new Map<string, { grades: number[]; dist: Map<string, number> }>();
    for (const s of students)
      for (const c of s.courses) {
        if (!inTerm(c)) continue;
        const e = stat.get(c.subject) ?? { grades: [], dist: new Map<string, number>() };
        if (isGraded(c)) e.grades.push(c.rankGrade as number);
        else if (c.achievement) e.dist.set(c.achievement, (e.dist.get(c.achievement) ?? 0) + 1);
        stat.set(c.subject, e);
      }
    const mineCourses = me?.student.courses.filter(inTerm) ?? [];
    const subjects = me ? [...new Set(mineCourses.map((c) => c.subject))] : [...stat.keys()];
    return subjects
      .map((subject) => {
        const e = stat.get(subject) ?? { grades: [], dist: new Map<string, number>() };
        const mc = mineCourses.find((c) => c.subject === subject);
        const dist = [...e.dist.entries()].sort((a, b) => a[0].localeCompare(b[0], "ko"));
        return {
          subject,
          avg: e.grades.length ? e.grades.reduce((s, g) => s + g, 0) / e.grades.length : null,
          n: e.grades.length || dist.reduce((s, [, n]) => s + n, 0),
          dist,
          mine: mc && isGraded(mc) ? (mc.rankGrade as number) : null,
          mineLabel: mc && !isGraded(mc) ? (mc.achievement ? `성취도 ${mc.achievement}` : null) : null,
        };
      })
      // 등급도 성취도도 없는 줄(자료가 비어 있는 과목)은 보여 줄 것이 없어 뺍니다.
      .filter((r) => r.avg != null || r.dist.length > 0 || r.mineLabel != null)
      .sort((a, b) => GROUPS.indexOf(groupOf(a.subject)) - GROUPS.indexOf(groupOf(b.subject)) || a.subject.localeCompare(b.subject, "ko"));
  }, [students, sel, me]);

  // 직전 학기 대비 급등락
  const moves = useMemo(() => {
    const list = rows
      .filter((r) => r.prevAvg != null && r.lastAvg != null)
      .map((r) => ({ key: r.key, name: r.student.name, from: r.prevAvg as number, to: r.lastAvg as number, delta: (r.prevAvg as number) - (r.lastAvg as number) }));
    const up = list.filter((m) => m.delta >= threshold - 1e-9).sort((a, b) => b.delta - a.delta);
    const down = list.filter((m) => m.delta <= -threshold + 1e-9).sort((a, b) => a.delta - b.delta);
    return { up, down };
  }, [rows, threshold]);

  if (!students.length) return null;

  const maxN = Math.max(1, ...bins.map((b) => b.n));
  const yTicks = Array.from({ length: maxN + 1 }, (_, i) => i).filter((i) => maxN <= 6 || i % Math.ceil(maxN / 6) === 0);
  const W = 1100;
  const H = 300;
  const L = 36;
  const B = 44;
  const T = 12;
  const slot = bins.length ? (W - L - 8) / bins.length : 0;
  const yv = (n: number) => T + ((H - T - B) * (maxN - n)) / maxN;

  return (
    <section className="print:hidden rounded-2xl border border-stone-200 bg-white p-4">
      <h2 className="font-bold flex items-center gap-2">
        <Users className="w-5 h-5 text-stone-500" /> 학급 한눈에 보기
      </h2>
      <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-bold flex items-center gap-1.5">
          <Lock className="w-4 h-4" /> 교사용 화면입니다
        </p>
        <p className="mt-1">다른 학생의 이름과 성적이 나오므로 인쇄하지 않습니다.</p>
      </div>

      <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-2">
        <Stat title="학생 수" value={`${rows.length}`} unit="명" sub="올린 파일 기준" />
        <Stat title="학급 전과목 평균" value={f2(classAll)} sub="학생별 평균의 평균" />
        <Stat title="학급 국영수 평균" value={f2(classKem)} />
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
          <p className="text-xs text-stone-600">{me ? `${me.student.name} 위치` : "선택한 학생 위치"}</p>
          <p className="text-3xl font-bold text-sky-800">
            {myRank ?? "—"}
            <span className="text-base font-medium text-stone-500">/{withAll.length}</span>
          </p>
          <p className="text-xs text-stone-600">전과목 {f2(me?.all)} · 전 과목 기준</p>
        </div>
      </div>

      <h3 className="mt-5 font-bold text-sm">전과목 평균 분포</h3>
      {bins.length === 0 ? (
        <p className="mt-2 text-sm text-stone-600">평균을 낼 수 있는 학생이 없습니다.</p>
      ) : (
        <div className="mt-1 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[640px]" role="img" aria-label="전과목 평균 등급 분포">
            {yTicks.map((n) => (
              <g key={n}>
                <line x1={L} x2={W - 8} y1={yv(n)} y2={yv(n)} stroke="#e7e1d8" />
                <text x={L - 8} y={yv(n)} textAnchor="end" dominantBaseline="middle" className="fill-stone-500 text-[12px]">
                  {n}
                </text>
              </g>
            ))}
            {bins.map((b, i) => {
              const x0 = L + slot * i;
              const bw = slot * 0.72;
              return (
                <g key={b.lo}>
                  <line x1={x0} x2={x0} y1={T} y2={H - B} stroke="#efe9df" />
                  <rect
                    x={x0 + (slot - bw) / 2}
                    y={yv(b.n)}
                    width={bw}
                    height={H - B - yv(b.n)}
                    rx={5}
                    fill={b.mine ? "#1e5a8c" : "#c9d5db"}
                    aria-label={`${b.lo.toFixed(1)}~${b.hi.toFixed(1)}등급 ${b.n}명`}
                  />
                  {b.n > 0 && (
                    <text x={x0 + slot / 2} y={yv(b.n) - 6} textAnchor="middle" className={`text-[12px] font-bold ${b.mine ? "fill-sky-800" : "fill-stone-500"}`}>
                      {b.n}
                    </text>
                  )}
                  <text x={x0 + slot / 2} y={H - B + 18} textAnchor="middle" className="fill-stone-600 text-[12px]">
                    {b.lo.toFixed(1)}~{b.hi.toFixed(1)}
                  </text>
                </g>
              );
            })}
            <text x={(L + W) / 2} y={H - 8} textAnchor="middle" className="fill-stone-600 text-[13px]">
              전과목 평균 등급 (왼쪽이 좋은 등급)
            </text>
          </svg>
        </div>
      )}

      {sel && (
        <>
          <div className="mt-5 flex items-center gap-3 flex-wrap">
            <h3 className="font-bold text-sm">{termName(sel.year, sel.term)} 과목별 학급 평균</h3>
            {terms.length > 1 && (
              <select
                value={sel.key}
                onChange={(e) => setTermSel(e.target.value)}
                className="rounded-lg border border-stone-300 bg-white px-3 py-1 text-sm font-bold text-stone-900"
                aria-label="학기 선택"
              >
                {terms.map((t) => (
                  <option key={t.key} value={t.key}>
                    {termName(t.year, t.term)}
                  </option>
                ))}
              </select>
            )}
          </div>
          <p className="mt-0.5 text-xs text-stone-500">
            {me ? `${me.student.name} 학생이 이 학기에 수강한 과목만 보여 줍니다. ` : "학생을 선택하면 그 학생이 수강한 과목만 보입니다. "}
            이수/미이수(P) 과목은 표시하지 않고, 석차등급이 없는 성취도(A·B·C) 과목은 평균 등급 대신 성취도 분포로 보여 줍니다.
          </p>
          {subjectTable.length === 0 && (
            <p className="mt-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600">
              이 학기에는 표시할 과목이 없습니다(등급이나 성취도가 있는 수강 과목이 없음).
            </p>
          )}
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm border-collapse">
              <thead>
                <tr className="bg-[#f5efe4] text-stone-700">
                  <th className="p-2.5 text-left font-medium">과목</th>
                  <th className="p-2.5 text-center font-medium">학급 평균 등급</th>
                  <th className="p-2.5 text-center font-medium">인원</th>
                  <th className="p-2.5 text-center font-medium">{me?.student.name ?? "선택 학생"}</th>
                  <th className="p-2.5 text-center font-medium">학급 대비</th>
                </tr>
              </thead>
              <tbody>
                {subjectTable.map((r) => {
                  const diff = r.mine != null && r.avg != null ? Math.round((r.avg - r.mine) * 100) / 100 : null;
                  return (
                    <tr key={r.subject} className="border-t border-stone-200">
                      <td className="p-2.5 font-bold text-stone-900">{r.subject}</td>
                      <td className="p-2.5">
                        {r.avg != null ? (
                          <div className="flex items-center gap-3">
                            <div className="h-2.5 flex-1 rounded-full bg-stone-100">
                              <div className="h-full rounded-full bg-sky-300/80" style={{ width: `${(r.avg / 9) * 100}%` }} />
                            </div>
                            <span className="w-12 text-stone-700">{r.avg.toFixed(2)}</span>
                          </div>
                        ) : r.dist.length ? (
                          <p className="text-center text-xs text-stone-700">{r.dist.map(([k, n]) => `${k} ${n}명`).join(" · ")}</p>
                        ) : (
                          <p className="text-center text-xs text-stone-400">—</p>
                        )}
                      </td>
                      <td className="p-2.5 text-center text-stone-700">{r.n}명</td>
                      <td className="p-2.5 text-center">
                        {r.mine != null ? (
                          <span className={`inline-block rounded-lg px-3 py-0.5 font-bold ${gradeBadge(r.mine)}`}>{r.mine}</span>
                        ) : r.mineLabel ? (
                          <span className="inline-block rounded-lg bg-sky-50 px-3 py-0.5 text-xs font-bold text-sky-800">{r.mineLabel}</span>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center font-bold">
                        {diff == null || diff === 0 ? null : diff > 0 ? (
                          <span className="text-emerald-700">↑ {diff.toFixed(2)}</span>
                        ) : (
                          <span className="text-rose-700">↓ {(-diff).toFixed(2)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {last && prev ? (
        <>
          <div className="mt-6 flex items-center gap-3 flex-wrap">
            <h3 className="font-bold text-base">직전 학기 대비 급등락</h3>
            <select
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-bold"
              aria-label="급등락 기준"
            >
              {[0.3, 0.5, 0.7, 1].map((t) => (
                <option key={t} value={t}>
                  ±{t.toFixed(1)}등급
                </option>
              ))}
            </select>
            <span className="text-xs text-stone-500">
              학기 평균 등급 기준 · +는 좋아진 폭 · 이름을 누르면 그 학생을 엽니다 ({termName(prev.year, prev.term)} → {termName(last.year, last.term)})
            </span>
          </div>
          <div className="mt-3 grid gap-3">
            <MoveBox kind="up" list={moves.up} prev={prev} last={last} selectedKey={selectedKey} onSelect={onSelect} />
            <MoveBox kind="down" list={moves.down} prev={prev} last={last} selectedKey={selectedKey} onSelect={onSelect} />
          </div>
        </>
      ) : (
        <p className="mt-5 text-sm text-stone-600">직전 학기와 비교하려면 두 학기 이상의 성적이 필요합니다.</p>
      )}
    </section>
  );
}

function Stat({ title, value, unit, sub }: { title: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
      <p className="text-xs text-stone-600">{title}</p>
      <p className="text-3xl font-bold text-stone-900">
        {value}
        {unit && <span className="ml-0.5 text-base font-medium text-stone-600">{unit}</span>}
      </p>
      {sub && <p className="text-xs text-stone-600">{sub}</p>}
    </div>
  );
}

function MoveBox({
  kind,
  list,
  prev,
  last,
  selectedKey,
  onSelect,
}: {
  kind: "up" | "down";
  list: { key: string; name: string; from: number; to: number; delta: number }[];
  prev: { year: number; term: number };
  last: { year: number; term: number };
  selectedKey: string;
  onSelect: (key: string) => void;
}) {
  const up = kind === "up";
  return (
    <div className={`rounded-2xl border p-3 ${up ? "border-emerald-300 bg-emerald-50/30" : "border-rose-300 bg-rose-50/30"}`}>
      <p className={`font-bold ${up ? "text-emerald-800" : "text-rose-800"}`}>
        {up ? "↑ 상승" : "↓ 하락"} ({list.length}명)
      </p>
      {list.length === 0 ? (
        <p className="mt-2 text-sm text-stone-500">해당하는 학생이 없습니다.</p>
      ) : (
        <ul className="mt-2 max-h-96 overflow-auto divide-y divide-stone-200">
          {list.map((m) => (
            <li key={m.key}>
              <button
                onClick={() => onSelect(m.key)}
                className={`flex w-full items-center gap-4 rounded-lg px-3 py-2 text-left hover:bg-stone-100 ${m.key === selectedKey ? "bg-[#f5efe4]" : ""}`}
              >
                <span className="w-16 font-bold text-stone-900">{m.name}</span>
                <span className={`w-20 text-xl font-bold ${up ? "text-emerald-800" : "text-rose-800"}`}>
                  {up ? "+" : MINUS}
                  {Math.abs(m.delta).toFixed(2)}
                </span>
                <span className="ml-auto text-xs text-stone-500">
                  {prev.year}-{prev.term} {m.from.toFixed(2)} → {last.year}-{last.term} {m.to.toFixed(2)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
