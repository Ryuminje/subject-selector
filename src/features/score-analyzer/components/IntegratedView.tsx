"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Info, TrendingUp } from "lucide-react";
import { TrendChart } from "./Charts";
import { NotesPanel } from "./NotesPanel";
import type { Note, Notes } from "../lib/saveFile";
import type { NeisStudent } from "../lib/neis";
import type { Report } from "../lib/types";
import type { Options } from "../lib/analyze";
import {
  TENDENCY_GAP,
  TENDENCY_LABEL,
  bandOf,
  buildPeople,
  fitScores,
  metricsOf,
  peopleLabel,
  summarizeTendency,
  type Person,
  type Tendency,
} from "../lib/integrated";

const COLOR: Record<Tendency, string> = { susi: "#047857", balanced: "#b45309", jeongsi: "#6d28d9" };
const BG: Record<Tendency, string> = { susi: "bg-emerald-50 border-emerald-200", balanced: "bg-amber-50 border-amber-200", jeongsi: "bg-violet-50 border-violet-200" };
const FIT_COLORS = ["#047857", "#0369a1", "#b45309", "#6d28d9"];
const f2 = (n: number | null | undefined) => (n == null ? "—" : n.toFixed(2));

interface Props {
  naesin: NeisStudent[];
  reports: Report[];
  opts: Options;
  goTo: (tab: "naesin" | "mock") => void;
  notes: Notes;
  onNote: (key: string, note: Note) => void;
  /** 선택한 학생(번호|이름). 세 탭이 함께 씁니다. */
  selected: string;
  onSelect: (key: string) => void;
}

export function IntegratedView({ naesin, reports, opts, goTo, notes, onNote, selected, onSelect: setSelected }: Props) {
  const [threshold, setThreshold] = useState(TENDENCY_GAP);

  const people = useMemo(() => buildPeople(naesin, reports), [naesin, reports]);
  const activeKey = people.some((p) => p.key === selected)
    ? selected
    : ((people.find((p) => p.naesin && p.mock.length) ?? people[0])?.key ?? "");
  const person = people.find((p) => p.key === activeKey);
  const m = useMemo(() => (person ? metricsOf(person, opts, threshold) : null), [person, opts, threshold]);
  const summary = useMemo(() => summarizeTendency(people, opts, threshold), [people, opts, threshold]);
  const fits = m ? fitScores(m) : [];

  const hasNaesin = naesin.length > 0;
  const hasMock = reports.length > 0;

  return (
    <div className="max-w-[2200px] mx-auto px-4 py-3 space-y-3">
      {(!hasNaesin || !hasMock) && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2 flex-wrap">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="flex-1 min-w-[16rem]">
            <b>자료가 더 필요합니다.</b> 수시·정시 성향은 내신과 모의고사를 함께 비교해서 봅니다.{" "}
            {!hasNaesin && "내신 자료(교과학습발달상황)가 아직 없습니다. "}
            {!hasMock && "모의고사 자료(성적통지표)가 아직 없습니다."}
          </p>
          {!hasNaesin && (
            <button onClick={() => goTo("naesin")} className="px-3 py-1 rounded-lg bg-white border border-amber-300 font-medium hover:bg-amber-100">
              내신 올리러 가기
            </button>
          )}
          {!hasMock && (
            <button onClick={() => goTo("mock")} className="px-3 py-1 rounded-lg bg-white border border-amber-300 font-medium hover:bg-amber-100">
              모의고사 올리러 가기
            </button>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 flex items-start gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          이 화면은 평균등급 두 개를 견준 <b>단순 참고</b>입니다. 실제 지원은 대학별 전형 요강, 반영 영역, 수능 최저 학력 기준, 비교과 활동을 함께 보고 정하세요.
        </p>
      </div>

      {!person || !m ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-600">
          내신과 모의고사 자료를 올리면 학생별 수시·정시 성향이 여기에 나옵니다.
        </div>
      ) : (
        <>
          {/* 스크롤해도 화면 위에 붙어 있어 어디서든 학생을 바꿀 수 있습니다 */}
          <div className="print:hidden sticky top-0 z-20 flex items-center gap-2 flex-wrap rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
            <label htmlFor="istu" className="text-sm font-bold">
              학생
            </label>
            <select
              id="istu"
              value={activeKey}
              onChange={(e) => setSelected(e.target.value)}
              className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm bg-white"
            >
              {people.map((p) => (
                <option key={p.key} value={p.key}>
                  {peopleLabel(p)}
                  {!p.naesin ? " (내신 없음)" : !p.mock.length ? " (모의고사 없음)" : ""}
                </option>
              ))}
            </select>
            <label className="ml-auto inline-flex items-center gap-2 text-sm">
              성향 판정 격차
              <select
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="rounded-lg border border-stone-300 px-2 py-1 text-sm bg-white"
              >
                {[0.3, 0.5, 0.7, 1].map((t) => (
                  <option key={t} value={t}>
                    {t}등급 이상
                  </option>
                ))}
              </select>
            </label>
          </div>

          <NotesPanel pkey={activeKey} name={person.name} notes={notes} onChange={onNote} />

          {/* 1. 성향 판정 */}
          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <h2 className="font-bold mb-3">{person.name} · 수시·정시 성향 판정</h2>
            {m.tendency ? (
              <div className={`rounded-xl border px-4 py-5 text-center ${BG[m.tendency]}`}>
                <TrendingUp className="w-6 h-6 mx-auto" style={{ color: COLOR[m.tendency] }} />
                <p className="mt-1 text-3xl font-bold" style={{ color: COLOR[m.tendency] }}>
                  {TENDENCY_LABEL[m.tendency]}
                </p>
                <p className="mt-1 text-sm text-stone-700">
                  내신 {f2(m.naesinAvg)}등급 · 모의 {f2(m.mockAvg)}등급 ({m.latestLabel}, 반영 영역 기준) · 격차 {m.gap! > 0 ? "+" : ""}
                  {f2(m.gap)}
                </p>
                <div className="relative mt-4 mx-auto max-w-3xl">
                  <div className="h-2.5 rounded-full" style={{ background: "linear-gradient(90deg,#047857,#d6d3d1 50%,#6d28d9)" }} />
                  <div
                    className="absolute -top-1 w-1 h-5 rounded bg-stone-900"
                    style={{ left: `${50 + Math.max(-1, Math.min(1, m.gap! / 2)) * 50}%`, transform: "translateX(-50%)" }}
                    aria-label="이 학생의 위치"
                  />
                  <div className="mt-1 flex justify-between text-[11px] text-stone-600">
                    <span>수시 우위</span>
                    <span>균형</span>
                    <span>정시 우위</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-700">
                {!person.naesin ? "이 학생의 내신 자료가 없어 성향을 판정할 수 없습니다." : "이 학생의 모의고사 자료가 없어 성향을 판정할 수 없습니다."}
              </p>
            )}
            {m.tendency && (
              <ul className="mt-3 space-y-1.5 text-sm text-stone-800 list-disc pl-5">
                <li>
                  {m.gap! > 0
                    ? `모의고사 평균이 내신보다 ${f2(m.gap)}등급 좋습니다 (내신 ${f2(m.naesinAvg)} vs 모의 ${f2(m.mockAvg)}등급).`
                    : m.gap! < 0
                      ? `내신 평균이 모의고사보다 ${f2(-m.gap!)}등급 좋습니다 (내신 ${f2(m.naesinAvg)} vs 모의 ${f2(m.mockAvg)}등급).`
                      : `내신과 모의고사 평균이 같습니다 (${f2(m.naesinAvg)}등급).`}
                </li>
                <li>
                  {m.tendency === "jeongsi"
                    ? "수능 경쟁력이 교과 성적보다 높아, 정시 비중을 키워 보는 것이 좋습니다."
                    : m.tendency === "susi"
                      ? "교과 성적이 수능 모의고사보다 앞서, 학생부 교과·종합 전형(수시) 비중을 높여 보는 것이 좋습니다."
                      : "내신과 모의고사 수준이 비슷해 수시와 정시를 함께 준비해도 좋습니다."}
                </li>
              </ul>
            )}
          </section>

          {/* 2. 내신 vs 모의고사 */}
          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <h2 className="font-bold mb-3">내신 vs 모의고사 대비</h2>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] items-stretch">
              <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-center">
                <p className="text-xs text-stone-600">내신 (학점 가중 평균)</p>
                <p className="text-3xl font-bold text-emerald-700">{f2(m.naesinAvg)}</p>
                <p className="text-xs text-stone-600">{m.naesinTerms.length}개 학기 평균등급</p>
              </div>
              <span className="self-center text-sm font-bold text-stone-500 text-center">VS</span>
              <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-center">
                <p className="text-xs text-stone-600">모의고사 (반영 영역 평균)</p>
                <p className="text-3xl font-bold text-violet-700">{f2(m.mockAvg)}</p>
                <p className="text-xs text-stone-600">{m.latestLabel ?? "자료 없음"} 기준</p>
              </div>
            </div>
            <div className="mt-3">
              {(() => {
                const labels = [...m.naesinTerms.map((t) => t.label), ...m.mockExams.map((e) => e.label)];
                const values = [...m.naesinTerms.map((t) => t.avg), ...m.mockExams.map(() => null as number | null)];
                const mockValues = [...m.naesinTerms.map(() => null as number | null), ...m.mockExams.map((e) => e.avg)];
                const all = [...values, ...mockValues].filter((v): v is number => v != null);
                if (!all.length) return <p className="text-sm text-stone-600">그릴 자료가 없습니다.</p>;
                const lo = Math.max(1, Math.floor((Math.min(...all) - 0.2) * 5) / 5);
                const hi = Math.max(Math.min(9, Math.ceil((Math.max(...all) + 0.2) * 5) / 5), lo + 0.6);
                return (
                  <TrendChart
                    labels={labels}
                    range={[lo, hi]}
                    series={[
                      { label: "내신 학기별 평균등급", color: "#047857", values },
                      { label: "모의고사 평균등급", color: "#6d28d9", values: mockValues },
                    ]}
                  />
                );
              })()}
              <p className="text-xs text-stone-600">위로 갈수록 좋은 등급입니다. 모의고사 점은 회차가 늘어나면 오른쪽에 이어서 찍힙니다.</p>
            </div>
          </section>

          {/* 3. 정시 지원 가능 라인 */}
          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <h2 className="font-bold mb-3">
              정시 지원 가능 라인 <span className="text-xs font-normal text-stone-600">(참고)</span>
            </h2>
            {m.mockPct != null ? (
              <>
                <div className="flex items-center gap-4 flex-wrap rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div>
                    <p className="text-xs text-stone-600">국·수·탐 백분위 평균</p>
                    <p className="text-3xl font-bold text-sky-700">{m.mockPct.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-stone-900">{bandOf(m.mockPct).label}</p>
                    <p className="text-xs text-stone-600">{bandOf(m.mockPct).note}</p>
                  </div>
                </div>
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  모의고사 백분위 평균으로 어림한 구간입니다. 대학마다 반영 영역과 가산점, 표준점수 변환표가 달라 실제 지원 가능선과 차이가 큽니다. 입시 기관의 점수 환산표나
                  전년도 입시 결과와 함께 확인하세요. 탐구는 2과목 평균, 영어·한국사는 등급제라 제외했습니다.
                </p>
              </>
            ) : (
              <p className="text-sm text-stone-600">모의고사 자료가 있어야 계산됩니다.</p>
            )}
          </section>

          {/* 4. 전형별 적합도 */}
          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <h2 className="font-bold mb-3">
              전형별 적합도 <span className="text-xs font-normal text-stone-600">(참고 지표)</span>
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {fits.map((f, i) => (
                <div key={f.key} className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold">{f.label}</p>
                    <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: FIT_COLORS[i] }}>
                      {f.score == null ? "—" : `${f.score}점`}
                    </span>
                  </div>
                  <div className="mt-2 h-2.5 rounded-full bg-stone-200 overflow-hidden">
                    <div className="h-full" style={{ width: `${f.score ?? 0}%`, background: FIT_COLORS[i] }} />
                  </div>
                  <p className="mt-1.5 text-xs text-stone-600">{f.basis}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              1등급을 100점, 9등급을 0점으로 직선 환산한 값입니다. 학교 안에서 학생들을 견주기 위한 지표이며, 합격 가능성을 뜻하지 않습니다. 학생부종합전형의 비교과·면접,
              논술의 실제 실력은 반영하지 못합니다.
            </p>
          </section>
        </>
      )}

      {/* 5. 우리 반 성향 지도 */}
      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="font-bold">우리 반 수시·정시 성향 지도</h2>
        <p className="text-xs text-stone-600 mb-3">
          가로는 내신, 세로는 모의고사 평균등급입니다. 점이 대각선 위쪽(왼쪽 위)에 있으면 모의고사가 더 좋은 정시 우위, 아래쪽이면 내신이 더 좋은 수시 우위입니다. 대각선에서
          ±{threshold}등급 안쪽은 균형형입니다.
        </p>
        {summary.points.length === 0 ? (
          <p className="text-sm text-stone-600">내신과 모의고사가 모두 있는 학생이 없어 그릴 수 없습니다.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-[1fr_320px] items-start">
            <Scatter points={summary.points} threshold={threshold} activeKey={activeKey} onPick={setSelected} />
            <Donut groups={summary.groups} total={summary.points.length} activeKey={activeKey} onPick={setSelected} />
          </div>
        )}
      </section>
    </div>
  );
}

function Scatter({
  points,
  threshold,
  activeKey,
  onPick,
}: {
  points: { person: Person; naesinAvg: number; mockAvg: number; tendency: Tendency }[];
  threshold: number;
  activeKey: string;
  onPick: (k: string) => void;
}) {
  const W = 680;
  const H = 420;
  const L = 48;
  const R = 18;
  const T = 16;
  const B = 44;
  const maxV = Math.max(3, Math.ceil(Math.max(...points.flatMap((p) => [p.naesinAvg, p.mockAvg])) * 2) / 2);
  const minV = 0.5; // 1등급 점이 가장자리에 붙지 않도록 여백을 둡니다
  const x = (g: number) => L + ((W - L - R) * (g - minV)) / (maxV - minV);
  const y = (g: number) => T + ((H - T - B) * (g - minV)) / (maxV - minV);
  const ticks: number[] = [];
  for (let g = 1; g <= maxV + 0.001; g += maxV > 5 ? 1 : 0.5) ticks.push(g);

  // 균형 띠: y = x ± threshold (범위 안으로 자름)
  const clamp = (v: number) => Math.max(minV, Math.min(maxV, v));
  const steps = Array.from({ length: 41 }, (_, i) => minV + ((maxV - minV) * i) / 40);
  const upper = steps.map((g) => `${x(g)},${y(clamp(g - threshold))}`);
  const lower = [...steps].reverse().map((g) => `${x(g)},${y(clamp(g + threshold))}`);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl border border-stone-200 bg-white" role="img" aria-label="우리 반 수시·정시 성향 지도">
      <polygon points={`${x(minV)},${y(minV)} ${x(maxV)},${y(maxV)} ${x(minV)},${y(maxV)}`} fill="#ecfdf5" />
      <polygon points={`${x(minV)},${y(minV)} ${x(maxV)},${y(minV)} ${x(maxV)},${y(maxV)}`} fill="#f5f3ff" />
      <polygon points={[...upper, ...lower].join(" ")} fill="#fef3c7" opacity={0.8} />
      <line x1={x(minV)} y1={y(minV)} x2={x(maxV)} y2={y(maxV)} stroke="#a8a29e" strokeDasharray="5 4" />
      {ticks.map((g) => (
        <g key={g}>
          <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="#e7e5e4" strokeWidth={0.5} />
          <line x1={x(g)} x2={x(g)} y1={T} y2={H - B} stroke="#e7e5e4" strokeWidth={0.5} />
          <text x={L - 6} y={y(g)} textAnchor="end" dominantBaseline="middle" className="fill-stone-500 text-[10px]">
            {g}등급
          </text>
          <text x={x(g)} y={H - B + 14} textAnchor="middle" className="fill-stone-500 text-[10px]">
            {g}
          </text>
        </g>
      ))}
      <text x={(L + W - R) / 2} y={H - 8} textAnchor="middle" className="fill-stone-700 text-[11px] font-medium">
        내신 평균등급 (오른쪽일수록 낮음)
      </text>
      <text x={L + 6} y={T + 12} className="fill-violet-700 text-[11px] font-bold">
        정시 우위 영역
      </text>
      <text x={W - R - 6} y={H - B - 8} textAnchor="end" className="fill-emerald-700 text-[11px] font-bold">
        수시 우위 영역
      </text>
      {points.map((p) => {
        const active = p.person.key === activeKey;
        return (
          <g key={p.person.key} onClick={() => onPick(p.person.key)} className="cursor-pointer">
            <circle cx={x(p.naesinAvg)} cy={y(p.mockAvg)} r={active ? 7 : 4.5} fill={COLOR[p.tendency]} stroke="#fff" strokeWidth={active ? 2.5 : 1} />
            <text
              x={x(p.naesinAvg) + 7}
              y={y(p.mockAvg) - 6}
              className={active ? "fill-stone-900 font-bold text-[11px]" : "fill-stone-600 text-[9px]"}
            >
              {p.person.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Donut({
  groups,
  total,
  activeKey,
  onPick,
}: {
  groups: Record<Tendency, Person[]>;
  total: number;
  activeKey: string;
  onPick: (k: string) => void;
}) {
  const order: Tendency[] = ["susi", "balanced", "jeongsi"];
  const C = 2 * Math.PI * 40;
  let acc = 0;
  return (
    <div className="space-y-3">
      <svg viewBox="0 0 120 120" className="w-40 h-40 mx-auto" role="img" aria-label="성향별 인원 비율">
        <circle cx="60" cy="60" r="40" fill="none" stroke="#e7e5e4" strokeWidth="16" />
        {order.map((t) => {
          const len = total ? (groups[t].length / total) * C : 0;
          const el = (
            <circle
              key={t}
              cx="60"
              cy="60"
              r="40"
              fill="none"
              stroke={COLOR[t]}
              strokeWidth="16"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-acc}
              transform="rotate(-90 60 60)"
            />
          );
          acc += len;
          return el;
        })}
        <text x="60" y="58" textAnchor="middle" className="fill-stone-900 text-[16px] font-bold">
          {total}명
        </text>
        <text x="60" y="73" textAnchor="middle" className="fill-stone-500 text-[8px]">
          판정 가능
        </text>
      </svg>
      {order.map((t) => (
        <div key={t} className={`rounded-xl border p-2.5 ${BG[t]}`}>
          <p className="text-sm font-bold flex items-center justify-between" style={{ color: COLOR[t] }}>
            <span>{TENDENCY_LABEL[t]}</span>
            <span>
              {groups[t].length}명 · {total ? Math.round((groups[t].length / total) * 100) : 0}%
            </span>
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {groups[t].map((p) => (
              <button
                key={p.key}
                onClick={() => onPick(p.key)}
                className={`rounded-md border px-1.5 py-0.5 text-[11px] ${
                  p.key === activeKey ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-700 border-stone-300 hover:bg-stone-100"
                }`}
              >
                {p.name}
              </button>
            ))}
            {groups[t].length === 0 && <span className="text-xs text-stone-500">해당 학생 없음</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
