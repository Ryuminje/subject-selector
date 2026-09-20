"use client";

// 구획(타임) 교사 계산 + 배치 화면.
// 위: 반 수·과목·학점·교사(이름/시수) 입력과 최소 교사 수 계산.
// 아래: 그 입력으로 만든 실제 타임 × 반 배치표.
// 계산 전용 화면입니다 — 타임 배정 설정에는 아무것도 반영되지 않습니다.

import React, { useEffect, useMemo, useState } from "react";
import { Calculator, Download, Plus, Trash2, Users, Wand2 } from "lucide-react";
import { exportTeacherPlanXlsx } from "../lib/exportTeacherPlan";
import {
  bandHours,
  buildPlan,
  defaultTeachers,
  minTeachers,
  subjectDemand,
  validatePlan,
  type PlanSubject,
} from "../lib/teacherPlan";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const INITIAL: PlanSubject[] = [
  { name: "논술", credits: 3, teachers: [] },
  { name: "체육", credits: 2, teachers: [] },
  { name: "진로", credits: 1, teachers: [] },
];

const SUBJECT_TINT = ["bg-amber-50", "bg-sky-50", "bg-violet-50", "bg-emerald-50", "bg-rose-50"];

/**
 * 숫자 입력칸. 타이핑 중에는 빈칸을 허용합니다 — 곧바로 숫자로 되돌리면 "0"이 안 지워져
 * 새 값을 넣기 전에 지울 수가 없습니다(실제로 겪음). 비운 채로 칸을 벗어나면 원래 값으로 돌립니다.
 */
function NumberBox({
  value,
  onChange,
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
    // text 를 의존성에 넣으면 타이핑 중 빈칸이 바로 되돌려집니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      type="number"
      min={0}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value !== "" && Number.isFinite(n)) onChange(Math.max(0, n));
      }}
      onBlur={() => setText(String(value))}
      className={className}
    />
  );
}

/** "김OO, 이OO 박OO" → ["김OO", "이OO", "박OO"] */
const parseNames = (raw: string): string[] =>
  raw
    .split(/[,\s\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

/** "1,3 5" → [0, 2, 4] (화면은 1-based, 내부는 0-based) */
const parseClasses = (raw: string): number[] =>
  [...new Set(raw.split(/[,\s]+/).map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n >= 1))]
    .map((n) => n - 1)
    .sort((a, b) => a - b);

export function TeacherPlanStep() {
  const [classes, setClasses] = useState(8);
  const [subjects, setSubjects] = useState<PlanSubject[]>(INITIAL);
  /** 과목별 "여러 명 추가" 입력칸 내용 */
  const [bulk, setBulk] = useState<Record<number, string>>({});

  const hours = bandHours(subjects);
  const problems = useMemo(() => validatePlan({ classes, subjects }), [classes, subjects]);
  const plan = useMemo(
    () => (problems.length ? null : buildPlan({ classes, subjects })),
    [problems, classes, subjects]
  );

  const patchSubject = (i: number, p: Partial<PlanSubject>) =>
    setSubjects((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  /** 자동 채우기 — 인원은 직접 정한 "교사 수"(없으면 최소 인원), 이미 적어 둔 이름·담당 반은 남깁니다. */
  const refill = (s: PlanSubject, hoursOfBand: number): PlanSubject => {
    const filled = defaultTeachers(s, classes, hoursOfBand);
    return {
      ...s,
      teachers: filled.map((t, ti) => ({
        ...t,
        name: s.teachers[ti]?.name?.trim() ? s.teachers[ti].name : t.name,
        classes: s.teachers[ti]?.classes,
      })),
    };
  };
  const fillTeachers = (i: number) =>
    setSubjects((prev) => prev.map((s, idx) => (idx === i ? refill(s, bandHours(prev)) : s)));
  const fillAll = () => setSubjects((prev) => prev.map((s) => refill(s, bandHours(prev))));

  const subjectIndexOf = (name: string) => subjects.findIndex((s) => s.name === name);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-semibold text-stone-900 flex items-center gap-2">
        <Calculator className="w-6 h-6 text-amber-600 shrink-0" />
        구획 교사 수 계산·배치
      </h2>
      <p className="text-sm text-stone-500">
        한 구획에 함께 돌릴 과목·학점과 반 수를 넣으면 과목마다 최소 교사 수를 계산하고, 교사 이름과 시수를 넣으면
        실제 타임 × 반 배치표를 만듭니다. <b>이름이 같으면 같은 사람</b>으로 보아 같은 타임에 두 반에 넣지 않습니다(겸임).
        이 화면의 값은 저장되지 않고 타임 배정 설정에도 반영되지 않습니다.
      </p>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="inline-flex items-center gap-1.5">
          반 수
          <NumberBox
            value={classes}
            onChange={setClasses}
            className="w-20 px-2 py-1 border border-stone-200 rounded-lg text-center"
          />
          개
        </label>
        <span className="text-stone-500">
          구획 시수 <b className="text-stone-800">{hours}시간</b> (학점 합)
        </span>
        <button
          onClick={fillAll}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 text-sm font-semibold rounded-lg"
        >
          <Wand2 className="w-4 h-4" /> 모든 과목 교사 자동 채우기
        </button>
      </div>

      <div className="overflow-auto border border-stone-200 rounded-xl">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-stone-100 text-stone-600 text-xs">
            <tr>
              <th className="border border-stone-200 px-2 py-2 text-left w-40">과목</th>
              <th className="border border-stone-200 px-2 py-2 w-20">학점</th>
              <th className="border border-stone-200 px-2 py-2 w-28">수업 칸</th>
              <th className="border border-stone-200 px-2 py-2 w-24">최소 교사</th>
              <th className="border border-stone-200 px-2 py-2 w-28">교사 수(자동 채우기)</th>
              <th className="border border-stone-200 px-2 py-2 text-left">교사(이름 · 시수)</th>
              <th className="border border-stone-200 px-2 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {subjects.map((s, i) => {
              const demand = subjectDemand(s.credits, classes);
              const given = s.teachers.reduce((a, t) => a + Math.max(0, t.hours), 0);
              const need = minTeachers(s.credits, classes, hours);
              return (
                <tr key={i} className="align-top">
                  <td className="border border-stone-200 px-2 py-2">
                    <input
                      value={s.name}
                      onChange={(e) => patchSubject(i, { name: e.target.value })}
                      placeholder="과목명"
                      className="w-full px-1.5 py-1 border border-stone-200 rounded"
                    />
                  </td>
                  <td className="border border-stone-200 px-2 py-2 text-center">
                    <NumberBox
                      value={s.credits}
                      onChange={(n) => patchSubject(i, { credits: n })}
                      className="w-14 px-1 py-1 border border-stone-200 rounded text-center"
                    />
                  </td>
                  <td className="border border-stone-200 px-2 py-2 text-center text-stone-500 tabular-nums">
                    {s.credits} × {classes} = <b className="text-stone-700">{demand}</b>
                  </td>
                  <td className="border border-stone-200 px-2 py-2 text-center font-bold text-amber-700 tabular-nums">
                    {need ? `${need}명` : "-"}
                  </td>
                  <td className="border border-stone-200 px-2 py-2 text-center">
                    <NumberBox
                      value={s.teacherCount ?? need}
                      onChange={(n) => patchSubject(i, { teacherCount: n })}
                      className={`w-16 px-1 py-1 border rounded text-center ${
                        (s.teacherCount ?? need) < need ? "border-rose-400 bg-rose-50" : "border-stone-200"
                      }`}
                    />
                    <span className="block text-[10px] text-stone-400 mt-0.5">
                      {(s.teacherCount ?? need) < need ? `최소 ${need}명` : "명"}
                    </span>
                  </td>
                  <td className="border border-stone-200 px-2 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {s.teachers.map((t, ti) => {
                        const setTeacher = (p: Partial<typeof t>) =>
                          patchSubject(i, { teachers: s.teachers.map((x, xi) => (xi === ti ? { ...x, ...p } : x)) });
                        return (
                          <span
                            key={ti}
                            className="inline-flex items-center gap-1 bg-stone-50 border border-stone-200 rounded-lg px-1.5 py-1"
                          >
                            <input
                              value={t.name}
                              onChange={(e) => setTeacher({ name: e.target.value })}
                              placeholder="이름"
                              className="w-20 px-1 py-0.5 border border-stone-200 rounded text-xs"
                            />
                            <NumberBox
                              value={t.hours}
                              onChange={(n) => setTeacher({ hours: n })}
                              className="w-12 px-1 py-0.5 border border-stone-200 rounded text-xs text-center"
                            />
                            <span className="text-[10px] text-stone-400">시간</span>
                            <input
                              defaultValue={(t.classes ?? []).map((c) => c + 1).join(",")}
                              onBlur={(e) => setTeacher({ classes: parseClasses(e.target.value) })}
                              placeholder="담당 반"
                              title="이 교사가 꼭 맡을 반(예: 1,3). 비우면 자동으로 정합니다."
                              className="w-16 px-1 py-0.5 border border-stone-200 rounded text-xs text-center"
                            />
                            <button
                              onClick={() => patchSubject(i, { teachers: s.teachers.filter((_, xi) => xi !== ti) })}
                              className="text-stone-400 hover:text-rose-600"
                              title="이 교사 지우기"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                      <span className="inline-flex items-center gap-1">
                        <input
                          value={bulk[i] ?? ""}
                          onChange={(e) => setBulk((prev) => ({ ...prev, [i]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter") return;
                            const names = parseNames(bulk[i] ?? "");
                            if (!names.length) return;
                            patchSubject(i, { teachers: [...s.teachers, ...names.map((name) => ({ name, hours: 0 }))] });
                            setBulk((prev) => ({ ...prev, [i]: "" }));
                          }}
                          placeholder="여러 명 한 번에: 김OO, 이OO"
                          className="w-44 px-1.5 py-1 border border-stone-200 rounded-lg text-xs"
                        />
                        <button
                          onClick={() => {
                            const names = parseNames(bulk[i] ?? "");
                            patchSubject(i, {
                              teachers: [
                                ...s.teachers,
                                ...(names.length ? names.map((name) => ({ name, hours: 0 })) : [{ name: "", hours: 0 }]),
                              ],
                            });
                            setBulk((prev) => ({ ...prev, [i]: "" }));
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-600 text-xs font-medium rounded-lg"
                          title="이름을 쉼표나 띄어쓰기로 구분해 여러 명을 한 번에 추가합니다. 비워 두면 빈 칸 하나를 추가합니다."
                        >
                          <Plus className="w-3 h-3" /> 추가
                        </button>
                      </span>
                      <button
                        onClick={() => fillTeachers(i)}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-medium rounded-lg"
                      >
                        <Wand2 className="w-3 h-3" /> 자동
                      </button>
                      <span className={`text-xs ml-1 ${given === demand ? "text-stone-400" : "font-bold text-rose-600"}`}>
                        시수 합 {given} / {demand}
                      </span>
                    </div>
                  </td>
                  <td className="border border-stone-200 px-1 py-2 text-center">
                    {subjects.length > 1 && (
                      <button
                        onClick={() => setSubjects((prev) => prev.filter((_, idx) => idx !== i))}
                        className="p-1 rounded text-stone-400 hover:text-rose-600 hover:bg-rose-50"
                        title="이 과목 지우기"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        onClick={() => setSubjects((prev) => [...prev, { name: "", credits: 1, teachers: [] }])}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-medium rounded-lg"
      >
        <Plus className="w-4 h-4" /> 과목 추가
      </button>

      {problems.length > 0 && (
        <ul className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 space-y-1">
          {problems.map((p, i) => (
            <li key={i}>· {p.message}</li>
          ))}
        </ul>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-600 shrink-0" /> 배치 결과
          </h3>
          {plan && (
            <button
              onClick={() => exportTeacherPlanXlsx(plan, classes, "구획_교사배치표")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg"
            >
              <Download className="w-4 h-4" /> 엑셀 내려받기
            </button>
          )}
        </div>
        {!plan ? (
          <p className="text-sm text-stone-500">
            {problems.length ? "위 문제를 먼저 해결하면 배치표가 나옵니다." : "이 입력으로는 배치를 만들 수 없습니다."}
          </p>
        ) : (
          <>
            <div className="overflow-auto border border-stone-200 rounded-xl">
              <table className="text-[11px] border-collapse whitespace-nowrap">
                <thead className="bg-stone-100">
                  <tr>
                    <th className="border border-stone-200 px-2 py-1 sticky left-0 bg-stone-100">타임</th>
                    {Array.from({ length: classes }, (_, c) => (
                      <th key={c} className="border border-stone-200 px-2 py-1">
                        {c + 1}반
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plan.grid.map((row, t) => (
                    <tr key={t}>
                      <td className="border border-stone-200 px-2 py-1 font-medium sticky left-0 bg-white">
                        {LETTERS[t] ?? t + 1}타임
                      </td>
                      {row.map((cell, c) => (
                        <td
                          key={c}
                          className={`border border-stone-200 px-2 py-1 text-center ${
                            SUBJECT_TINT[Math.max(0, subjectIndexOf(cell.subject)) % SUBJECT_TINT.length]
                          }`}
                        >
                          <span className="block font-bold text-stone-700">{cell.subject}</span>
                          <span className="block text-[10px] text-stone-500">{cell.teacher}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-1.5 text-xs">
              {[...plan.load.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([name, h]) => (
                  <span
                    key={name}
                    className={`px-2 py-1 rounded-lg border ${
                      plan.multiSubject.includes(name)
                        ? "bg-violet-50 border-violet-300 text-violet-800 font-semibold"
                        : "bg-white border-stone-200 text-stone-600"
                    }`}
                    title={plan.multiSubject.includes(name) ? "두 과목 이상 맡는 겸임 교사" : undefined}
                  >
                    {name} {h}시간{plan.multiSubject.includes(name) ? " · 겸임" : ""}
                  </span>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
